import { useEffect, useState, type ReactElement } from 'react';

import { FieldError } from '~/components/ui/field-error';
import { SelectField, type SelectOption } from '~/components/ui/select-field';
import type {
  ShowcaseFilters,
  ShowcaseSex,
  ShowcaseSize,
} from '~/pages/showcase/showcase-filters';
import type { CatalogCityOption, CatalogSpeciesOption } from '~/services/api/catalog-api';
import { MESSAGES } from '~/utils/messages';
import { useDebouncedValue } from '~/utils/use-debounced-value';

interface ShowcaseFilterBarProps {
  readonly filters: ShowcaseFilters;
  readonly onChange: (filters: ShowcaseFilters) => void;
  readonly speciesOptions: ReadonlyArray<CatalogSpeciesOption>;
  readonly cityOptions: ReadonlyArray<CatalogCityOption>;
  /** Falha ao carregar as opcoes: o campo exibe o aviso em vez de aparecer vazio. */
  readonly speciesError?: boolean;
  readonly cityError?: boolean;
  readonly hasActiveFilters: boolean;
  readonly onClear: () => void;
}

/** 350 ms: rapido o bastante para nao parecer travado, longo o bastante para colapsar uma digitacao. */
const ATRASO_DA_DIGITACAO = 350;

const IDADE_MAXIMA_ACEITA = 30;

const OPCOES_DE_PORTE: ReadonlyArray<SelectOption> = [
  { value: 'pequeno', label: 'Pequeno' },
  { value: 'medio', label: 'Médio' },
  { value: 'grande', label: 'Grande' },
];

const OPCOES_DE_SEXO: ReadonlyArray<SelectOption> = [
  { value: 'macho', label: 'Macho' },
  { value: 'femea', label: 'Fêmea' },
];

const CLASSES_DO_CAMPO_DE_TEXTO =
  'w-full rounded-field border-[1.5px] border-hairline bg-surface-input px-4 py-[13px] text-[0.875rem] font-semibold text-ink outline-none transition-colors placeholder:font-semibold placeholder:text-ink-mid focus:border-brand-purple focus:shadow-focus-ring';

/**
 * Antepoe a opcao NEUTRA — "Todas as espécies", "Todos os portes" — como uma
 * opcao de verdade, e nao como `placeholder`.
 *
 * ============ POR QUE NAO E O `placeholder` DO `SelectField` ============
 *
 * Aquele renderiza `<option value="" disabled>`, e o `disabled` e deliberado la:
 * no formulario de cadastro, "Selecione" nao e um valor valido, e permitir
 * escolhe-lo de volta faria o administrador desfazer um campo obrigatorio.
 *
 * Aqui e o CONTRARIO. "Todas as espécies" E um valor valido — significa "filtro
 * nao aplicado" —, e o visitante precisa poder voltar a ele. Com o `placeholder`
 * desabilitado, quem escolhesse "Gato" nunca mais conseguiria remover so aquele
 * filtro: teria de usar "Limpar filtros" e perder os outros junto.
 */
function comOpcaoNeutra(
  opcoes: ReadonlyArray<SelectOption>,
  rotuloNeutro: string,
): ReadonlyArray<SelectOption> {
  return [{ value: '', label: rotuloNeutro }, ...opcoes];
}

/**
 * Acrescenta o valor APLICADO as opcoes quando ele nao esta na lista recebida.
 *
 * ============ POR QUE ELE NAO PODE SUMIR ============
 *
 * O endereco pode trazer uma especie que ja nao tem animal disponivel — e portanto
 * saiu das opcoes. Deixar o campo em branco esconderia do visitante o motivo de a
 * lista estar vazia: ele veria "Todas as espécies" selecionado e nenhum resultado,
 * uma combinacao que nao faz sentido (RN-33, CA-21, CT-53).
 *
 * O rotulo da opcao adicional nao tem o nome — a tela nao o conhece —, e por isso
 * ele diz o que se sabe: e um filtro aplicado que nao esta mais na lista.
 */
function comValorAplicado(
  opcoes: ReadonlyArray<SelectOption>,
  aplicado: string | null,
): ReadonlyArray<SelectOption> {
  if (aplicado === null || opcoes.some((opcao) => opcao.value === aplicado)) {
    return opcoes;
  }

  return [...opcoes, { value: aplicado, label: MESSAGES.SHOWCASE.FILTER_UNLISTED }];
}

/**
 * A barra de sete controles.
 *
 * ============ TODO CONTROLE TEM ROTULO VISIVEL E ASSOCIADO ============
 *
 * A captura identifica a busca e a cidade apenas por texto de apoio. Texto de
 * apoio NAO E ROTULO: ele some ao primeiro caractere digitado, nao e anunciado de
 * forma confiavel e deixa o campo preenchido sem identificacao nenhuma (RNF-21,
 * CA-51, CT-119). Aqui os seis tem `<label>` de verdade.
 *
 * ============ A ESPERA VALE SO PARA O QUE E DIGITADO ============
 *
 * Busca e idade maxima passam pelo atraso; os quatro campos de selecao aplicam
 * IMEDIATAMENTE (RN-52). O estado local existe por causa disso: o campo precisa
 * responder a cada tecla enquanto o callback espera.
 *
 * ============ TODA MUDANCA REPOE `pagina` EM 1 ============
 *
 * E a reposicao vive em UMA funcao, e nao espalhada por sete manipuladores
 * (RN-36, CA-23, CT-79): filtrar estando na pagina 3 mostraria a pagina 3 de um
 * conjunto novo, que quase sempre esta vazia.
 *
 * A barra NUNCA e desabilitada em bloco durante o carregamento da grade (CA-38,
 * CT-94): quem esta esperando um resultado e justamente quem pode querer mudar o
 * filtro.
 */
export function ShowcaseFilterBar({
  filters,
  onChange,
  speciesOptions,
  cityOptions,
  speciesError,
  cityError,
  hasActiveFilters,
  onClear,
}: ShowcaseFilterBarProps): ReactElement {
  const [buscaDigitada, setBuscaDigitada] = useState(filters.busca);
  const [idadeDigitada, setIdadeDigitada] = useState(
    filters.idadeMax === null ? '' : String(filters.idadeMax),
  );

  const buscaAtrasada = useDebouncedValue(buscaDigitada, ATRASO_DA_DIGITACAO);
  const idadeAtrasada = useDebouncedValue(idadeDigitada, ATRASO_DA_DIGITACAO);

  /** Reposição de `pagina` em UM lugar só. */
  function aplicar(mudanca: Partial<ShowcaseFilters>): void {
    onChange({ ...filters, ...mudanca, pagina: 1 });
  }

  useEffect(() => {
    if (buscaAtrasada !== filters.busca) {
      onChange({ ...filters, busca: buscaAtrasada, pagina: 1 });
    }
    // `filters` e `onChange` mudam a cada render do pai; depender deles reenviaria
    // a busca em laço. O gatilho é o valor atrasado, e só ele.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaAtrasada]);

  /**
   * Valor fora de 0–30 NAO E ENVIADO: o campo sinaliza o problema e a grade
   * mantém o último resultado válido (Ação 3 da spec). Campo vazio é "filtro não
   * aplicado", e não erro.
   */
  const idadeInvalida =
    idadeDigitada !== '' &&
    (!/^\d+$/.test(idadeDigitada) || Number(idadeDigitada) > IDADE_MAXIMA_ACEITA);

  useEffect(() => {
    if (idadeAtrasada !== '' && (!/^\d+$/.test(idadeAtrasada) || Number(idadeAtrasada) > IDADE_MAXIMA_ACEITA)) {
      return;
    }

    const valor = idadeAtrasada === '' ? null : Number(idadeAtrasada);

    if (valor !== filters.idadeMax) {
      onChange({ ...filters, idadeMax: valor, pagina: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idadeAtrasada]);

  const opcoesDeEspecie = comValorAplicado(
    speciesOptions.map((opcao) => ({ value: opcao.id, label: opcao.name })),
    filters.especie,
  );

  const opcoesDeCidade = comValorAplicado(
    // "Cidade - UF" é composto AQUI: o servidor devolve dado, não texto.
    cityOptions.map((opcao) => ({
      value: opcao.id,
      label: `${opcao.name} - ${opcao.stateUf}`,
    })),
    filters.cidade,
  );

  return (
    <section
      aria-label="Filtros da vitrine"
      className="rounded-card bg-surface-card p-4 shadow-card"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div>
          <label
            htmlFor="busca"
            className="mb-1.5 block text-[0.8rem] font-extrabold text-ink"
          >
            Buscar
          </label>
          <input
            id="busca"
            type="search"
            value={buscaDigitada}
            placeholder={MESSAGES.SHOWCASE.SEARCH_PLACEHOLDER}
            onChange={(evento) => {
              setBuscaDigitada(evento.target.value);
            }}
            className={CLASSES_DO_CAMPO_DE_TEXTO}
          />
        </div>

        <SelectField
          id="especie"
          label={MESSAGES.SHOWCASE.SPECIES_LABEL}
          options={comOpcaoNeutra(opcoesDeEspecie, MESSAGES.SHOWCASE.FILTER_ANY_SPECIES)}
          value={filters.especie ?? ''}
          {...(speciesError === true ? { error: MESSAGES.SHOWCASE.OPTIONS_LOAD_ERROR } : {})}
          onChange={(evento) => {
            aplicar({ especie: evento.target.value === '' ? null : evento.target.value });
          }}
        />

        <SelectField
          id="porte"
          label={MESSAGES.SHOWCASE.SIZE_LABEL}
          options={comOpcaoNeutra(OPCOES_DE_PORTE, MESSAGES.SHOWCASE.FILTER_ANY_SIZE)}
          value={filters.porte ?? ''}
          onChange={(evento) => {
            aplicar({ porte: (evento.target.value || null) as ShowcaseSize | null });
          }}
        />

        <SelectField
          id="sexo"
          label={MESSAGES.SHOWCASE.SEX_LABEL}
          options={comOpcaoNeutra(OPCOES_DE_SEXO, MESSAGES.SHOWCASE.FILTER_ANY_SEX)}
          value={filters.sexo ?? ''}
          onChange={(evento) => {
            aplicar({ sexo: (evento.target.value || null) as ShowcaseSex | null });
          }}
        />

        <div>
          <label
            htmlFor="idadeMax"
            className="mb-1.5 block text-[0.8rem] font-extrabold text-ink"
          >
            {MESSAGES.SHOWCASE.MAX_AGE_LABEL}
          </label>
          <input
            id="idadeMax"
            type="text"
            inputMode="numeric"
            value={idadeDigitada}
            placeholder={MESSAGES.SHOWCASE.FILTER_ANY_AGE}
            /*
              O aviso é PERMANENTE e associado por `aria-describedby` — não é
              tooltip nem condicional. O filtro OMITE quem não tem data de
              nascimento (RN-42), e sem dizê-lo o visitante conclui que o animal
              sumiu do catálogo (RN-43, CA-29, CT-71).
            */
            aria-describedby="idadeMax-hint"
            {...(idadeInvalida ? { 'aria-invalid': true } : {})}
            onChange={(evento) => {
              setIdadeDigitada(evento.target.value);
            }}
            className={CLASSES_DO_CAMPO_DE_TEXTO}
          />
          <p id="idadeMax-hint" className="mt-1 text-[0.72rem] font-semibold text-ink-mid">
            {MESSAGES.SHOWCASE.MAX_AGE_HINT}
          </p>
          {idadeInvalida && (
            <FieldError id="idadeMax-error" message={MESSAGES.SHOWCASE.INVALID_MAX_AGE} />
          )}
        </div>

        <SelectField
          id="cidade"
          label={MESSAGES.SHOWCASE.CITY_LABEL}
          options={comOpcaoNeutra(opcoesDeCidade, MESSAGES.SHOWCASE.FILTER_ANY_CITY)}
          value={filters.cidade ?? ''}
          {...(cityError === true ? { error: MESSAGES.SHOWCASE.OPTIONS_LOAD_ERROR } : {})}
          onChange={(evento) => {
            aplicar({ cidade: evento.target.value === '' ? null : evento.target.value });
          }}
        />
      </div>

      <div className="mt-3 flex justify-end">
        {/*
          VISIVEL E DESABILITADO quando não há filtro, e não oculto: esconder o
          botão faria a linha saltar quando o primeiro filtro fosse aplicado
          (CT-90).
        */}
        <button
          type="button"
          disabled={!hasActiveFilters}
          onClick={() => {
            setBuscaDigitada('');
            setIdadeDigitada('');
            onClear();
          }}
          className="rounded-field border-[1.5px] border-brand-purple px-4 py-2 text-[0.8rem] font-extrabold text-brand-purple transition-colors hover:bg-brand-purple-light focus-visible:shadow-focus-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {MESSAGES.SHOWCASE.CLEAR_FILTERS}
        </button>
      </div>
    </section>
  );
}
