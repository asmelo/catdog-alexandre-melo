import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactElement } from 'react';

import { IconButton } from '~/components/ui/icon-button';
import { PencilIcon, TrashIcon } from '~/components/ui/icons';
import { SubmitButton } from '~/components/ui/submit-button';
import { TextField } from '~/components/ui/text-field';
import type { Species } from '~/services/api/species-api';
import { MESSAGES } from '~/utils/messages';
import { hasFieldErrors, validateSpeciesNameForm, type FieldErrors } from '~/utils/validation';

type SpeciesRowProps = {
  readonly species: Species;
  /** Quem decide e a PAGINA: `idEmEdicao` e um unico valor, entao no maximo uma linha recebe `true`. */
  readonly isEditing: boolean;
  /** Enquanto verdadeiro, salvar e cancelar ficam desabilitados. */
  readonly isSubmitting: boolean;
  /**
   * Erro da API referente a ESTA renomeacao, ja escolhido pela pagina
   * (`VALIDATION_ERROR` ou `SPECIES_NAME_ALREADY_EXISTS`). String vazia significa
   * ausencia de erro, na mesma convencao que o `TextField` ja adota.
   */
  readonly error: string;
  readonly onStartEdit: (especie: Species) => void;
  readonly onCancelEdit: () => void;
  readonly onSave: (especie: Species, nome: string) => void;
  readonly onDelete: (especie: Species) => void;
};

const SEM_ERROS: FieldErrors = {};

/**
 * Botao de cancelar da edicao em linha.
 *
 * DUPLICACAO REGISTRADA: as classes sao as mesmas do botao de cancelar do
 * `ConfirmDialog` (`confirm-dialog.tsx`, L28 e L31-32) — neutro sobre o cartao
 * branco, com o anel de foco `shadow-focus-ring` da base. Elas sao repetidas, e
 * nao importadas, porque aquele arquivo nao as exporta e pertence a
 * TASK-FRONTEND-006, ja commitada e fora da tabela *Files* desta task. E a mesma
 * divida que o `status-message.tsx` registrou em relacao ao `alert-message.tsx`,
 * pelo mesmo motivo, e a extracao cabe a primeira task que abrir aquele arquivo
 * por um motivo legitimo proprio.
 *
 * `py-3` e `text-[0.95rem]` alinham a altura com a do `SubmitButton` ao lado
 * (27px de caixa contra 28px): o botao neutro nao pode parecer menor que o
 * primario dentro da mesma linha.
 */
const CLASSES_DO_BOTAO_DE_CANCELAR =
  'w-full rounded-field border-[1.5px] border-hairline bg-surface-card py-3 text-[0.95rem] font-extrabold text-ink transition-colors hover:bg-surface-input focus-visible:shadow-focus-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60';

type FormularioDeEdicaoProps = {
  readonly species: Species;
  readonly isSubmitting: boolean;
  readonly error: string;
  readonly onSave: (especie: Species, nome: string) => void;
  readonly onCancelEdit: () => void;
};

/**
 * Modo de EDICAO da linha (HU-04) — campo, salvar e cancelar no lugar dos dois
 * icones.
 *
 * COMPONENTE SEPARADO, e nao um ramo de `if` dentro do `SpeciesRow`, e a razao e
 * o ciclo de vida do estado. O texto digitado vive AQUI: montar e o que o
 * inicializa com o nome atual e DESMONTAR e o que descarta o rascunho. Cancelar
 * passa a ser exatamente "sair do modo de edicao" — sem copia de seguranca do
 * nome original, sem `setNome(species.name)` de limpeza e sem chance de o
 * rascunho de uma edicao anterior reaparecer na proxima (CT-21 / CA-12).
 *
 * Como `SpeciesRow` permanece montado enquanto a linha existe (o `DataList`
 * chaveia por `id`), um `useState` declarado la sobreviveria ao cancelamento e
 * exigiria justamente a limpeza manual que este arranjo dispensa.
 *
 * A LINHA NAO CHAMA A API. Ela valida, e quem chama e a pagina — e por isso este
 * arquivo nao importa `species-api`. E o que permite exercita-lo sem espionar
 * `fetch`.
 */
function FormularioDeEdicao({
  species,
  isSubmitting,
  error,
  onSave,
  onCancelEdit,
}: FormularioDeEdicaoProps): ReactElement {
  const [nome, setNome] = useState(species.name);
  const [errosDeCampo, setErrosDeCampo] = useState<FieldErrors>(SEM_ERROS);

  /**
   * `ref` no WRAPPER e nao no `<input>`: o `TextField` nao e `forwardRef` e
   * transforma-lo esta fora do escopo desta task (nenhum arquivo de
   * `src/components/ui/` e alterado aqui). O wrapper contem um unico `<input>`,
   * entao a busca e deterministica — e continua sendo `ref`, e nao
   * `getElementById` global, como a task pede.
   */
  const refDoCampo = useRef<HTMLDivElement | null>(null);

  /**
   * Foco no campo ao ENTRAR em edicao, com o cursor no FIM do texto (HU-04
   * cenario 1): o administrador abre a edicao para ajustar o nome, nao para
   * reescreve-lo. `focus()` sozinho em campo pre-preenchido seleciona ou
   * posiciona o cursor de forma que varia por navegador, e a primeira tecla
   * digitada apagaria o nome inteiro.
   *
   * Dependencias vazias porque o componente so existe enquanto a linha esta em
   * edicao: montar E entrar em edicao sao o mesmo evento.
   */
  useEffect(() => {
    const campo = refDoCampo.current?.querySelector('input');

    if (campo === null || campo === undefined) {
      return;
    }

    campo.focus();

    const fimDoTexto = campo.value.length;
    campo.setSelectionRange(fimDoTexto, fimDoTexto);
  }, []);

  function aoSubmeter(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();

    const erros = validateSpeciesNameForm({ name: nome });

    setErrosDeCampo(erros);

    // Validacao local ANTES de avisar a pagina: e a AUSENCIA da requisicao que o
    // CT-19 cobra, e a linha PERMANECE em edicao — nada aqui chama `onCancelEdit`.
    if (hasFieldErrors(erros)) {
      return;
    }

    // Vai o texto DIGITADO. A RN-03 e aplicada pelo servidor, que e a autoridade
    // sobre a forma gravada — mesma decisao do `species-create-form.tsx`.
    onSave(species, nome);
  }

  /**
   * `Escape` no campo tem o MESMO efeito de cancelar (CT-37), inclusive a
   * recusa enquanto a gravacao esta em voo: com o `PATCH` em andamento nao ha o
   * que cancelar, e sair da edicao deixaria a resposta chegar sobre uma linha
   * que ja voltou ao modo de exibicao.
   */
  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>): void {
    if (evento.key !== 'Escape' || isSubmitting) {
      return;
    }

    onCancelEdit();
  }

  const idDoCampo = `species-edit-${species.id}`;

  return (
    <form
      noValidate
      onSubmit={aoSubmeter}
      // `items-start` pelo mesmo motivo da linha de criacao: o campo cresce para
      // baixo ao exibir a mensagem de erro e os botoes nao devem descer junto.
      className="flex w-full items-start gap-3"
    >
      <div ref={refDoCampo} className="flex-1">
        {/*
          PRECEDENCIA DO ERRO: o local vence o da API. Um erro de campo recem
          calculado ("Este campo é obrigatório.") descreve o que o usuario acabou
          de fazer; o erro da API descreve a tentativa ANTERIOR, que nem chegou a
          ser refeita — a requisicao nao saiu. Exibir o antigo por cima do novo
          responderia a submissao errada.
        */}
        <TextField
          id={idDoCampo}
          label={MESSAGES.SPECIES.NAME_PLACEHOLDER}
          type="text"
          autoComplete="off"
          placeholder={MESSAGES.SPECIES.NAME_PLACEHOLDER}
          value={nome}
          error={errosDeCampo.name ?? error}
          onChange={(evento) => {
            setNome(evento.target.value);
          }}
          onKeyDown={aoTeclar}
        />
      </div>

      {/*
        `SubmitButton` dentro de `<form onSubmit>`, e nao `onClick`: e o que faz o
        Enter no campo salvar sem mouse (RNF-06 / CT-37). O `isLoading` cuida do
        `disabled` e do `aria-busy`, e com o botao padrao do formulario
        desabilitado a submissao implicita por Enter tambem nao ocorre — as duas
        travas do CT-35 valendo tambem para a renomeacao.
      */}
      <div className="w-24 shrink-0">
        <SubmitButton isLoading={isSubmitting}>{MESSAGES.SPECIES.SAVE_BUTTON}</SubmitButton>
      </div>

      <div className="w-24 shrink-0">
        <button
          type="button"
          onClick={onCancelEdit}
          disabled={isSubmitting}
          className={CLASSES_DO_BOTAO_DE_CANCELAR}
        >
          {MESSAGES.SPECIES.CANCEL_BUTTON}
        </button>
      </div>
    </form>
  );
}

/**
 * Linha da lista de especies — modo de EXIBICAO (nome a esquerda, lapis e
 * lixeira a direita) ou modo de EDICAO, conforme `isEditing`.
 *
 * A linha nao decide qual dos dois exibe e nao chama API nenhuma: ela avisa a
 * pagina (`onStartEdit`, `onSave`, `onDelete`) e recebe de volta o estado. A
 * LIXEIRA APENAS SELECIONA — nenhuma requisicao parte daqui, e e isso que
 * garante que nao existe exclusao em um unico acionamento (CA-13).
 *
 * O `<li>` e a moldura vem do `DataList` — a linha entrega apenas o conteudo.
 *
 * VARIANTES DOS DOIS BOTOES: `default` no lapis e `danger` na lixeira.
 *
 * A CAPTURA NAO USA NENHUMA COR DA MARCA nos dois icones — medido pixel a pixel
 * em `assets/current-state-admin-especies.png`, nos tres pares de icones da
 * lista:
 *
 * - lapis: o pixel mais saturado de cada linha fica entre `(116,144,186)` e
 *   `(130,147,198)`, matiz 216 a 227 — um AZUL-ARDOSIA, com o verde sempre
 *   ACIMA do vermelho;
 * - lixeira: `(174,79,98)` no mais saturado, matiz 348 nas tres linhas — um
 *   VERMELHO-ROSADO, com o azul entre 98 e 115.
 *
 * Nenhum dos dois tem token CatDog correspondente. `brand.purple` (`#7c3aed`) e
 * matiz 262 com o verde MUITO abaixo do vermelho (58 contra 124), o inverso do
 * que o lapis mostra; `brand.orange-dark` (`#c44a10`) e matiz 19 com o azul
 * quase nulo (16), contra os ~100 da lixeira. A divergencia nao e artefato do
 * antialiasing sobre o cartao branco: misturar uma cor com branco multiplica a
 * saturacao e a distancia entre canais pelo mesmo fator e PRESERVA o matiz
 * exatamente, entao 216-227 nao pode ser um 262 desbotado.
 *
 * Sem token equivalente, `default` (`ink.mid`) e `danger` (`brand.orange-dark`)
 * sao os vizinhos mais proximos dentro do que a TASK-FRONTEND-006 entregou, e o
 * `default` ainda ganha contraste sobre o cartao branco. Criar variante nova
 * exigiria alterar `src/components/ui/icon-button.tsx`, fora do escopo desta
 * task — e NAO HA "variante roxa da captura" a reproduzir, porque a captura
 * nunca mostrou uma. O roxo da marca entra aqui so pelo `hover` e pelo anel de
 * foco, ambos vindos do proprio `IconButton`.
 */
export function SpeciesRow({
  species,
  isEditing,
  isSubmitting,
  error,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: SpeciesRowProps): ReactElement {
  const refDasAcoes = useRef<HTMLSpanElement | null>(null);
  const estavaEditando = useRef(false);

  /**
   * DEVOLVE O FOCO AO LAPIS ao sair da edicao.
   *
   * Ao cancelar, ao salvar com sucesso e ao perder a especie para outra pessoa, o
   * campo de texto — que e onde o foco estava — DESMONTA. O navegador nao tem
   * para onde levar o foco e o joga no <body>: a proxima tabulacao recomeca do
   * topo da pagina e quem navega so por teclado perde o lugar na lista (RNF-06 /
   * CT-37). O lapis desta mesma linha e o destino natural, porque e exatamente
   * de onde a edicao partiu.
   *
   * A GUARDA `document.body` E O PONTO. O efeito so age quando o foco esta no
   * <body>, que e a assinatura de "o foco caiu porque o meu campo sumiu". Sem
   * ela, o cenario do HU-04 cenario 8 quebraria: ao acionar o lapis de uma
   * SEGUNDA linha, esta aqui sai da edicao e, se roubasse o foco, o tiraria do
   * campo que a outra linha acabou de focar — e a ordem entre os dois efeitos
   * depende da posicao alfabetica das linhas, entao o defeito apareceria em
   * metade dos casos. Com a guarda, o foco ja esta no lapis da outra linha
   * (clique) e este efeito nao faz nada.
   *
   * `querySelector` sobre o `ref` do wrapper pela mesma razao do campo: o
   * `IconButton` nao e `forwardRef` e altera-lo esta fora do escopo. O lapis e o
   * PRIMEIRO `<button>` do wrapper, na ordem que a captura estabelece.
   */
  useEffect(() => {
    const saiuDaEdicao = estavaEditando.current && !isEditing;
    estavaEditando.current = isEditing;

    if (!saiuDaEdicao || document.activeElement !== document.body) {
      return;
    }

    refDasAcoes.current?.querySelector('button')?.focus();
  }, [isEditing]);

  if (isEditing) {
    return (
      <FormularioDeEdicao
        species={species}
        isSubmitting={isSubmitting}
        error={error}
        onSave={onSave}
        onCancelEdit={onCancelEdit}
      />
    );
  }

  return (
    <>
      <span className="font-semibold text-ink">{species.name}</span>

      {/*
        O nome acessivel de cada acao inclui o NOME DA ESPECIE, e e este ponto
        que satisfaz o RNF-07 / CT-38: "Editar" repetido em cada linha nao
        identifica nada para quem navega por leitor de tela, e a lista viraria
        uma sequencia de botoes homonimos.

        A composicao e `${verbo} ${nome}` — "Editar Gato" —, e nao "Editar
        espécie Gato": os literais do catalogo sao verbos soltos exatamente por
        isso, conforme o comentario de `MESSAGES.SPECIES.EDIT_ACTION`.
      */}
      <span ref={refDasAcoes} className="flex shrink-0 items-center gap-1">
        <IconButton
          label={`${MESSAGES.SPECIES.EDIT_ACTION} ${species.name}`}
          icon={<PencilIcon />}
          onClick={() => {
            onStartEdit(species);
          }}
        />
        <IconButton
          label={`${MESSAGES.SPECIES.DELETE_ACTION} ${species.name}`}
          icon={<TrashIcon />}
          variant="danger"
          onClick={() => {
            onDelete(species);
          }}
        />
      </span>
    </>
  );
}
