import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { AlertMessage } from '~/components/ui/alert-message';
import { DateField } from '~/components/ui/date-field';
import { ErrorState, LoadingIndicator } from '~/components/ui/feedback-states';
import { ImageUploadField } from '~/components/ui/image-upload-field';
import { SecondaryButton } from '~/components/ui/secondary-button';
import { SelectField, type SelectOption } from '~/components/ui/select-field';
import { SubmitButton } from '~/components/ui/submit-button';
import { TextInputField } from '~/components/ui/text-input-field';
import { TextareaField } from '~/components/ui/textarea-field';
import { ToggleField } from '~/components/ui/toggle-field';
import { ANIMAL_SEX_LABELS, ANIMAL_SIZE_LABELS } from '~/domains/animals/animal-labels';
import {
  keepImageIdsOf,
  stagedFilesOf,
  type AnimalImageItem,
} from '~/domains/animals/animal-images';
import type { Animal, AnimalSex, AnimalSize } from '~/domains/animals/animal.types';
import { useStateCities } from '~/pages/admin/animais/use-state-cities';
import { ROUTE_PATHS } from '~/routes/route-paths';
import { ApiError, fieldErrorsOf } from '~/services/api/api-error';
import * as animalsApi from '~/services/api/animals-api';
import * as speciesApi from '~/services/api/species-api';
import { MESSAGES } from '~/utils/messages';
import {
  hasFieldErrors,
  validateAnimalForm,
  type AnimalFormValues,
  type FieldErrors,
} from '~/utils/validation';

const OPCOES_DE_PORTE: ReadonlyArray<SelectOption> = (
  ['pequeno', 'medio', 'grande'] as ReadonlyArray<AnimalSize>
).map((porte) => ({ value: porte, label: ANIMAL_SIZE_LABELS[porte] }));

const OPCOES_DE_SEXO: ReadonlyArray<SelectOption> = (
  ['macho', 'femea'] as ReadonlyArray<AnimalSex>
).map((sexo) => ({ value: sexo, label: ANIMAL_SEX_LABELS[sexo] }));

/**
 * Os `code` cuja mensagem pertence a AREA DE IMAGENS, e nao ao topo do
 * formulario. Exibi-los no alerta geral faria o administrador procurar o problema
 * nos campos de texto.
 */
const CODIGOS_DE_IMAGEM: ReadonlySet<string> = new Set([
  'ANIMAL_IMAGE_LIMIT_EXCEEDED',
  'ANIMAL_IMAGE_TOO_LARGE',
  'ANIMAL_IMAGE_TYPE_NOT_ALLOWED',
  'ANIMAL_IMAGE_EMPTY',
  'REQUEST_BODY_TOO_LARGE',
  'IMAGE_STORAGE_UNAVAILABLE',
  'MULTIPART_BODY_REQUIRED',
]);

const VALORES_VAZIOS: AnimalFormValues = {
  name: '',
  speciesId: '',
  size: '',
  sex: '',
  cityId: '',
  birthDate: '',
  description: '',
};

type EstadoDaCarga = 'loading' | 'error' | 'ready';

/**
 * Formulario de cadastro e edicao de animal — `/admin/animais/novo` e
 * `/admin/animais/:id/editar`.
 *
 * UM COMPONENTE PARA OS DOIS MODOS, distinguidos pela presenca de `:id`. Dois
 * componentes teriam quinze campos, uma montagem de `FormData` e um tratamento de
 * erro por `code` duplicados — e a duplicacao divergiria no primeiro campo novo.
 *
 * ============ O FORMULARIO NUNCA PERDE O QUE FOI PREENCHIDO ============
 *
 * Nenhum caminho de erro limpa estado de campo. Perder um formulario longo — com
 * ate cinco imagens ja escolhidas — por causa de um `503` do armazenamento e o
 * defeito que faz o administrador desistir da tela (CT-55, CT-66, CA-29).
 */
/**
 * Aviso de falha de uma carga de APOIO, com a saida obrigatoria.
 *
 * Usado pelos estados e pelas cidades, que tem exatamente o mesmo contrato: a
 * falha nao pode se apresentar como campo de selecao vazio, o restante do
 * formulario continua preenchivel, e precisa haver como tentar de novo sem
 * recarregar a pagina e perder o que ja foi digitado.
 */
function FalhaDeCarga({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry: () => void;
}): ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 rounded-field border-[1.5px] border-brand-orange bg-surface-input px-4 py-3">
      <p className="text-[0.8rem] font-semibold text-ink">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded-field border-[1.5px] border-brand-purple px-3 py-1.5 text-[0.78rem] font-extrabold text-brand-purple transition-colors hover:bg-brand-purple-light focus-visible:shadow-focus-ring focus-visible:outline-none"
      >
        {MESSAGES.ANIMALS.RETRY_BUTTON}
      </button>
    </div>
  );
}

export function AnimalFormPage(): ReactElement {
  const navigate = useNavigate();
  const { id } = useParams<{ readonly id: string }>();
  const modoDeEdicao = id !== undefined;

  const [valores, setValores] = useState<AnimalFormValues>(VALORES_VAZIOS);
  const [aceitaOutros, setAceitaOutros] = useState(false);
  const [precisaEspaco, setPrecisaEspaco] = useState(false);
  const [imagens, setImagens] = useState<ReadonlyArray<AnimalImageItem>>([]);
  const [erros, setErros] = useState<FieldErrors>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [erroDeImagens, setErroDeImagens] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [carga, setCarga] = useState<EstadoDaCarga>('loading');
  const [especies, setEspecies] = useState<ReadonlyArray<SelectOption>>([]);
  const [ufGravada, setUfGravada] = useState('');
  const [cidadeGravada, setCidadeGravada] = useState<{ id: string; name: string } | null>(null);

  /**
   * Token de concorrencia da edicao (RN-47): o `updatedAt` que o `GET` devolveu.
   * `ref` e nao estado — ele nao participa de nenhuma renderizacao, e como estado
   * provocaria um render a mais por carga.
   */
  const marcaDeAlteracao = useRef<string | null>(null);
  const formularioRef = useRef<HTMLFormElement>(null);

  const descartarCidade = useCallback((): void => {
    setValores((atuais) => ({ ...atuais, cityId: '' }));
  }, []);

  const geografia = useStateCities({
    ...(ufGravada === '' ? {} : { initialUf: ufGravada }),
    onCityDiscarded: descartarCidade,
  });

  /** Carga inicial: especies sempre; o animal so no modo de edicao. */
  useEffect(() => {
    let ativo = true;

    async function carregar(): Promise<void> {
      try {
        const listaDeEspecies = await speciesApi.listSpecies();

        if (!ativo) {
          return;
        }

        setEspecies(
          listaDeEspecies.items.map((especie) => ({ value: especie.id, label: especie.name })),
        );

        if (id === undefined) {
          setCarga('ready');
          return;
        }

        const animal = await animalsApi.getAnimal(id);

        if (!ativo) {
          return;
        }

        preencherCom(animal);
        setCarga('ready');
      } catch {
        if (ativo) {
          setCarga('error');
        }
      }
    }

    void carregar();

    return () => {
      ativo = false;
    };
    // `preencherCom` fecha apenas sobre setters estaveis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function preencherCom(animal: Animal): void {
    setValores({
      name: animal.name,
      speciesId: animal.species.id,
      size: animal.size,
      sex: animal.sex,
      cityId: animal.city.id,
      birthDate: animal.birthDate ?? '',
      description: animal.description ?? '',
    });
    setAceitaOutros(animal.acceptsOtherAnimals);
    setPrecisaEspaco(animal.needsLargeSpace);
    setImagens(
      animal.images.map((imagem) => ({ kind: 'stored', id: imagem.id, url: imagem.url })),
    );
    marcaDeAlteracao.current = animal.updatedAt;
    setUfGravada(animal.city.stateUf);
    setCidadeGravada({ id: animal.city.id, name: animal.city.name });
  }

  function alterar<C extends keyof AnimalFormValues>(campo: C, valor: string): void {
    setValores((atuais) => ({ ...atuais, [campo]: valor }));
  }

  /**
   * As opcoes do campo Cidade.
   *
   * ============ A CIDADE GRAVADA NUNCA E APAGADA EM SILENCIO ============
   *
   * Se ela nao constar da lista ativa — municipio renomeado, reorganizado ou
   * simplesmente fora do recorte atual —, ela e ACRESCENTADA as opcoes em vez de
   * sumir (RN-56, CT-41, CA-47). Sem isso, o `<select>` renderizaria com valor
   * que nenhuma `<option>` casa, o navegador o exibiria em branco, e o
   * administrador salvaria o animal sem perceber que perdeu a localizacao.
   *
   * O administrador so perde aquele valor se escolher outro deliberadamente.
   */
  function opcoesDeCidade(): ReadonlyArray<SelectOption> {
    const daLista = geografia.cities.map((cidade) => ({
      value: cidade.id,
      label: cidade.name,
    }));

    if (cidadeGravada === null || valores.cityId !== cidadeGravada.id) {
      return daLista;
    }

    return daLista.some((opcao) => opcao.value === cidadeGravada.id)
      ? daLista
      : [{ value: cidadeGravada.id, label: cidadeGravada.name }, ...daLista];
  }

  /**
   * Os tres estados do campo Cidade que a HU-04 exige, decididos aqui e nao no
   * componente: e a tela que conhece o vocabulario.
   */
  function textoDoPlaceholderDeCidade(): string {
    if (geografia.selectedUf === '') {
      return MESSAGES.ANIMALS.CITY_NEEDS_STATE;
    }

    return geografia.citiesStatus === 'loading'
      ? MESSAGES.ANIMALS.CITIES_LOADING
      : MESSAGES.ANIMALS.SELECT_PLACEHOLDER;
  }

  function cidadeDesabilitada(): boolean {
    return (
      salvando ||
      geografia.selectedUf === '' ||
      geografia.citiesStatus === 'loading' ||
      geografia.citiesStatus === 'error'
    );
  }

  /**
   * Move o foco para o primeiro campo com problema (CT-09, CA-12).
   *
   * A ordem e a do DOM, e nao a das chaves do mapa de erros: e a ordem em que o
   * administrador percorre o formulario, e mandar o foco para o terceiro campo
   * quando o primeiro tambem esta errado o faria rolar a tela para tras.
   */
  function focarPrimeiroCampoComErro(errosDoEnvio: FieldErrors): void {
    const formulario = formularioRef.current;

    if (formulario === null) {
      return;
    }

    for (const controle of formulario.elements) {
      if (
        (controle instanceof HTMLInputElement ||
          controle instanceof HTMLSelectElement ||
          controle instanceof HTMLTextAreaElement) &&
        controle.name !== '' &&
        errosDoEnvio[controle.name] !== undefined
      ) {
        controle.focus();
        return;
      }
    }
  }

  /**
   * Monta o corpo multipart.
   *
   * `birthDate` e `description` sao OMITIDOS quando vazios, e nao enviados como
   * texto vazio: texto vazio e um VALOR, e um valor invalido — o schema do
   * backend o recusaria com `400` em vez de tratar o campo como ausente.
   *
   * `status` NUNCA entra, nem no cadastro nem na edicao (RN-16, CT-14, CT-68): a
   * situacao do animal so muda pela coluna ALTERAR STATUS da listagem, e um campo
   * de status aqui criaria um segundo caminho de escrita para ela.
   */
  function montarCorpo(): FormData {
    const corpo = new FormData();

    corpo.append('name', valores.name);
    corpo.append('speciesId', valores.speciesId);
    corpo.append('cityId', valores.cityId);
    corpo.append('size', valores.size);
    corpo.append('sex', valores.sex);
    corpo.append('acceptsOtherAnimals', String(aceitaOutros));
    corpo.append('needsLargeSpace', String(precisaEspaco));

    if (valores.birthDate !== '') {
      corpo.append('birthDate', valores.birthDate);
    }

    if (valores.description !== '') {
      corpo.append('description', valores.description);
    }

    for (const arquivo of stagedFilesOf(imagens)) {
      corpo.append('images', arquivo);
    }

    if (modoDeEdicao) {
      // NA ORDEM EM QUE APARECEM: é ela que o backend usa para reposicionar (RN-35).
      corpo.append('keepImageIds', JSON.stringify(keepImageIdsOf(imagens)));
      corpo.append('updatedAt', marcaDeAlteracao.current ?? '');
    }

    return corpo;
  }

  /**
   * Distribui a falha, SEMPRE pelo `code` e nunca pelo texto (CA-22).
   *
   * Nenhum ramo limpa campo nenhum: o formulario segue aberto com tudo o que
   * estava preenchido, imagens em preparo inclusive.
   */
  function tratarFalha(motivo: unknown): void {
    if (!(motivo instanceof ApiError)) {
      setErroGeral(MESSAGES.FORM.UNEXPECTED_ERROR);
      return;
    }

    if (motivo.code === 'VALIDATION_ERROR') {
      const porCampo = fieldErrorsOf(motivo);

      setErros(porCampo);

      // Um `VALIDATION_ERROR` sem `details` utilizável não pode ficar mudo.
      if (!hasFieldErrors(porCampo)) {
        setErroGeral(motivo.message);
      }

      focarPrimeiroCampoComErro(porCampo);
      return;
    }

    if (CODIGOS_DE_IMAGEM.has(motivo.code)) {
      setErroDeImagens(motivo.message);
      return;
    }

    if (motivo.code === 'ANIMAL_NOT_FOUND') {
      // O animal já não existe: manter o formulário aberto sobre ele não leva a
      // lugar nenhum. A listagem recarregada é o destino correto.
      navigate(ROUTE_PATHS.ADMIN_ANIMALS, { replace: true });
      return;
    }

    // `ANIMAL_STALE_UPDATE`, `SPECIES_NOT_FOUND`, `CITY_NOT_FOUND` e o resto: a
    // mensagem do backend, com o formulário intacto.
    setErroGeral(motivo.message);
  }

  async function enviar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();

    // Segundo acionamento ignorado: apenas um animal é criado (CT-93).
    if (salvando) {
      return;
    }

    setErroGeral(null);
    setErroDeImagens(null);

    const errosLocais = validateAnimalForm(valores);

    setErros(errosLocais);

    if (hasFieldErrors(errosLocais)) {
      // Nenhuma requisição sai: todos os problemas são sinalizados de uma vez.
      focarPrimeiroCampoComErro(errosLocais);
      return;
    }

    setSalvando(true);

    try {
      const corpo = montarCorpo();

      if (id === undefined) {
        await animalsApi.createAnimal(corpo);
      } else {
        await animalsApi.updateAnimal(id, corpo);
      }

      navigate(ROUTE_PATHS.ADMIN_ANIMALS, {
        replace: true,
        state: {
          message: modoDeEdicao
            ? MESSAGES.ANIMALS.UPDATE_SUCCESS
            : MESSAGES.ANIMALS.CREATE_SUCCESS,
        },
      });
    } catch (motivo: unknown) {
      tratarFalha(motivo);
    } finally {
      setSalvando(false);
    }
  }

  const titulo = modoDeEdicao ? MESSAGES.ANIMALS.EDIT_TITLE : MESSAGES.ANIMALS.CREATE_TITLE;

  if (carga === 'loading') {
    return <LoadingIndicator label={MESSAGES.ANIMALS.FORM_LOADING_LABEL} />;
  }

  if (carga === 'error') {
    return (
      <ErrorState
        message={MESSAGES.ANIMALS.FORM_LOAD_ERROR}
        retryLabel={MESSAGES.ANIMALS.RETRY_BUTTON}
        onRetry={() => {
          navigate(0);
        }}
      />
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <h1 className="text-[1.35rem] font-extrabold text-ink">{titulo}</h1>

      {erroGeral !== null && <AlertMessage variant="error">{erroGeral}</AlertMessage>}

      {/*
        `<form onSubmit>` de verdade: e o que faz o Enter enviar, o foco funcionar
        e o botao de tipo `submit` participar do formulario (RNF-16).
      */}
      <form
        ref={formularioRef}
        noValidate
        onSubmit={(evento) => {
          void enviar(evento);
        }}
        className="flex flex-col gap-4 rounded-card bg-surface-card p-6 shadow-card"
      >
        {/* Duas colunas, na ordem da captura. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInputField
            id="name"
            name="name"
            label={MESSAGES.ANIMALS.NAME_LABEL}
            required
            value={valores.name}
            disabled={salvando}
            {...(erros.name === undefined ? {} : { error: erros.name })}
            onChange={(evento) => {
              alterar('name', evento.target.value);
            }}
          />
          <DateField
            id="birthDate"
            name="birthDate"
            label={MESSAGES.ANIMALS.BIRTH_DATE_LABEL}
            value={valores.birthDate}
            disabled={salvando}
            {...(erros.birthDate === undefined ? {} : { error: erros.birthDate })}
            onChange={(evento) => {
              alterar('birthDate', evento.target.value);
            }}
          />

          <SelectField
            id="speciesId"
            name="speciesId"
            label={MESSAGES.ANIMALS.SPECIES_LABEL}
            required
            options={especies}
            placeholder={MESSAGES.ANIMALS.SELECT_PLACEHOLDER}
            value={valores.speciesId}
            disabled={salvando}
            {...(erros.speciesId === undefined ? {} : { error: erros.speciesId })}
            onChange={(evento) => {
              alterar('speciesId', evento.target.value);
            }}
          />
          <SelectField
            id="size"
            name="size"
            label={MESSAGES.ANIMALS.SIZE_LABEL}
            required
            options={OPCOES_DE_PORTE}
            placeholder={MESSAGES.ANIMALS.SELECT_PLACEHOLDER}
            value={valores.size}
            disabled={salvando}
            {...(erros.size === undefined ? {} : { error: erros.size })}
            onChange={(evento) => {
              alterar('size', evento.target.value);
            }}
          />

          <SelectField
            id="sex"
            name="sex"
            label={MESSAGES.ANIMALS.SEX_LABEL}
            required
            options={OPCOES_DE_SEXO}
            placeholder={MESSAGES.ANIMALS.SELECT_PLACEHOLDER}
            value={valores.sex}
            disabled={salvando}
            {...(erros.sex === undefined ? {} : { error: erros.sex })}
            onChange={(evento) => {
              alterar('sex', evento.target.value);
            }}
          />
          {/*
            O ESTADO NAO E CAMPO DO CONTRATO: ele nao entra no `FormData` e nao e
            validado no envio. Existe para reduzir a lista de cidades, e so a
            cidade trafega (RN-26a). Por isso `name` fica de fora — o `<form>` nao
            deve conhece-lo.
          */}
          <SelectField
            id="state"
            label={MESSAGES.ANIMALS.STATE_LABEL}
            required
            options={geografia.states.map((estado) => ({
              value: estado.uf,
              label: estado.uf,
            }))}
            placeholder={MESSAGES.ANIMALS.SELECT_PLACEHOLDER}
            value={geografia.selectedUf}
            disabled={salvando}
            onChange={(evento) => {
              geografia.selectUf(evento.target.value);
            }}
          />
        </div>

        {/*
          A falha de ESTADOS pelo mesmo criterio da de cidades: um campo Estado sem
          opcoes se leria como "nao ha estados", que e absurdo, e deixaria o
          administrador sem entender por que nao consegue escolher a cidade.
        */}
        {geografia.statesError && (
          <FalhaDeCarga
            message={MESSAGES.ANIMALS.STATES_LOAD_ERROR}
            onRetry={geografia.retryStates}
          />
        )}

        <SelectField
          id="cityId"
          name="cityId"
          label={MESSAGES.ANIMALS.CITY_LABEL}
          required
          options={opcoesDeCidade()}
          placeholder={textoDoPlaceholderDeCidade()}
          value={valores.cityId}
          disabled={cidadeDesabilitada()}
          {...(erros.cityId === undefined ? {} : { error: erros.cityId })}
          onChange={(evento) => {
            alterar('cityId', evento.target.value);
          }}
        />

        {/*
          A falha de cidades NUNCA se apresenta como campo vazio, que se leria como
          "este estado nao tem cidades" (RN-58, CT-39, CA-16). O restante do
          formulario continua preenchivel.
        */}
        {geografia.citiesStatus === 'error' && (
          <FalhaDeCarga
            message={MESSAGES.ANIMALS.CITIES_LOAD_ERROR}
            onRetry={geografia.retryCities}
          />
        )}

        <TextareaField
          id="description"
          name="description"
          label={MESSAGES.ANIMALS.DESCRIPTION_LABEL}
          maxLength={1000}
          showCounter
          value={valores.description}
          disabled={salvando}
          {...(erros.description === undefined ? {} : { error: erros.description })}
          onChange={(evento) => {
            alterar('description', evento.target.value);
          }}
        />

        <div className="flex flex-wrap gap-8">
          <ToggleField
            id="acceptsOtherAnimals"
            label={MESSAGES.ANIMALS.ACCEPTS_OTHER_ANIMALS_LABEL}
            checked={aceitaOutros}
            disabled={salvando}
            onChange={setAceitaOutros}
          />
          <ToggleField
            id="needsLargeSpace"
            label={MESSAGES.ANIMALS.NEEDS_LARGE_SPACE_LABEL}
            checked={precisaEspaco}
            disabled={salvando}
            onChange={setPrecisaEspaco}
          />
        </div>

        <ImageUploadField items={imagens} onChange={setImagens} disabled={salvando} />

        {erroDeImagens !== null && (
          <p className="text-[0.78rem] font-semibold text-brand-orange-dark">{erroDeImagens}</p>
        )}

        <div className="flex justify-end gap-3">
          {/*
            "Cancelar" volta a listagem sem gravar nada e SEM REMOVER IMAGEM
            ALGUMA: a marcacao de remocao vive no estado do formulario e e
            descartada junto com ele (RN-49, CT-59, CT-65, CA-25).
          */}
          <SecondaryButton
            className="w-auto px-5"
            disabled={salvando}
            onClick={() => {
              navigate(ROUTE_PATHS.ADMIN_ANIMALS);
            }}
          >
            {MESSAGES.ANIMALS.CANCEL_BUTTON}
          </SecondaryButton>
          <SubmitButton
            className="w-auto px-6"
            isLoading={salvando}
            loadingLabel={MESSAGES.ANIMALS.SAVING}
          >
            {MESSAGES.ANIMALS.SAVE_BUTTON}
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
