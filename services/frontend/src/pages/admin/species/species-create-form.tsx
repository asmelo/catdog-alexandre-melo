import { useState, type FormEvent, type ReactElement } from 'react';

import { SubmitButton } from '~/components/ui/submit-button';
import { TextField } from '~/components/ui/text-field';
import { ApiError, fieldErrorsOf } from '~/services/api/api-error';
import * as speciesApi from '~/services/api/species-api';
import type { Species } from '~/services/api/species-api';
import { MESSAGES } from '~/utils/messages';
import { hasFieldErrors, validateSpeciesNameForm, type FieldErrors } from '~/utils/validation';

/**
 * Resultado de uma operacao da tela, no formato que o `StatusMessage` da pagina
 * consome.
 *
 * Tipo ESTRUTURAL e nao importado da pagina: a pagina importa este componente, e
 * um `import` de volta fecharia um ciclo. Como a forma e identica a do estado da
 * pagina, o `setResultado` dela e diretamente atribuivel a `onResult`.
 */
type ResultadoDaOperacao = {
  readonly variant: 'success' | 'error';
  readonly message: string;
};

type SpeciesCreateFormProps = {
  /** Chamado com a especie recem-criada, para a lista absorve-la sem recarregar. */
  readonly onCreated: (especie: Species) => void;
  /**
   * Canal UNICO do aviso de resultado da pagina. `null` LIMPA o aviso, e a
   * limpeza nao e cosmetica: `StatusMessage` e regiao viva, e um aviso que
   * permanece montado entre duas operacoes nao e reanunciado quando o texto se
   * repete. Desmontar no inicio da operacao e o que garante o anuncio do RNF-09
   * na segunda criacao seguida.
   */
  readonly onResult: (resultado: ResultadoDaOperacao | null) => void;
};

const SEM_ERROS: FieldErrors = {};

/**
 * O `id` e constante de modulo porque e usado em DOIS lugares: no `TextField`
 * (que o repassa ao `<input>` e ao `htmlFor` do rotulo) e na devolucao do foco
 * apos a criacao.
 */
const ID_DO_CAMPO = 'species-create-name';

/**
 * Linha de criacao de especie (HU-02) — campo a esquerda, "Criar" a direita.
 *
 * `<form onSubmit>` de verdade, e nao `onClick` no botao: e o que faz o Enter
 * dentro do campo submeter, sem mouse (RNF-06 / CT-37). Um `onClick` jogaria fora
 * um comportamento que o navegador da de graça.
 *
 * `noValidate` desliga as bolhas nativas do navegador — nao sao estilizaveis,
 * aparecem no idioma do sistema operacional e impediriam a submissao antes de o
 * catalogo de mensagens da spec ser aplicado. Mesma decisao do `login-page.tsx`.
 */
export function SpeciesCreateForm({ onCreated, onResult }: SpeciesCreateFormProps): ReactElement {
  const [nome, setNome] = useState('');
  const [errosDeCampo, setErrosDeCampo] = useState<FieldErrors>(SEM_ERROS);
  const [enviando, setEnviando] = useState(false);

  /**
   * Ramifica por `code`, NUNCA por `message` nem por `status` (CA-22).
   *
   * `VALIDATION_ERROR` -> o `details` do backend vira mapa `campo -> mensagem`
   * pelo `fieldErrorsOf`, na MESMA forma que `validateSpeciesNameForm` produz.
   * As duas origens alimentam um unico estado de erro de campo, e por isso a tela
   * nao precisa de um caminho de exibicao para cada uma.
   *
   * `SPECIES_NAME_ALREADY_EXISTS` -> `erro.message` sob o campo, com o texto
   * digitado PRESERVADO. Manter o que o usuario escreveu e exigencia explicita da
   * spec (CT-08 / CT-09 / CA-08): a lista nao muda e ele precisa poder corrigir a
   * palavra em vez de redigitar. A mensagem e a que o servidor enviou — este
   * arquivo nao possui copia dela.
   *
   * QUALQUER OUTRO `code` -> `MESSAGES.FORM.UNEXPECTED_ERROR`, conforme a
   * TASK-FRONTEND-009 prescreve. E uma DIVERGENCIA CONSCIENTE do
   * `login-page.tsx`, que no ramo final exibe `erro.message`: aqui um `FORBIDDEN`
   * (403) perde a frase "Você não tem permissão..." que o backend mandou pronta.
   * O caso e residual — a tela so e alcançavel por sessao `admin` viva, e um
   * `SESSION_EXPIRED` (401) e absorvido antes por `http-client`/`AuthProvider`,
   * que derrubam a sessao e levam ao login. Nenhuma comparacao de texto acontece
   * em nenhum dos ramos.
   */
  function tratarFalhaDaCriacao(erro: unknown): void {
    if (erro instanceof ApiError && erro.code === 'VALIDATION_ERROR') {
      setErrosDeCampo(fieldErrorsOf(erro));

      return;
    }

    if (erro instanceof ApiError && erro.code === 'SPECIES_NAME_ALREADY_EXISTS') {
      setErrosDeCampo({ name: erro.message });

      return;
    }

    onResult({ variant: 'error', message: MESSAGES.FORM.UNEXPECTED_ERROR });
  }

  async function aoSubmeter(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();

    // Toda submissao comeca zerando o aviso da pagina — inclusive a que vai
    // parar na validacao local. Sem isso, o "Espécie criada com sucesso." da
    // criacao anterior continuaria na tela contradizendo o erro do campo.
    onResult(null);

    const erros = validateSpeciesNameForm({ name: nome });

    setErrosDeCampo(erros);

    // Validacao local ANTES de qualquer requisicao: e a AUSENCIA da chamada que
    // os criterios CT-02, CT-03, CT-04 e CT-07 cobram, nao apenas a mensagem.
    if (hasFieldErrors(erros)) {
      return;
    }

    setEnviando(true);

    try {
      // O que vai para a API e o texto DIGITADO. A RN-03 (aparar e colapsar
      // espacos) e aplicada pelo servidor, que e a autoridade sobre a forma
      // gravada; normalizar aqui deslocaria essa autoridade para o cliente.
      const especie = await speciesApi.createSpecies(nome);

      setNome('');

      /**
       * Devolver o foco ao campo e o que permite cadastrar varias especies em
       * sequencia sem tocar no mouse (RNF-06).
       *
       * `getElementById` e nao `ref`: o `TextField` nao e `forwardRef` e
       * altera-lo esta fora do escopo desta task (nenhum componente de
       * `src/components/ui/` e criado ou modificado aqui). O `id` e o mesmo que
       * o campo ja recebe por contrato e a tela monta um unico formulario de
       * criacao, entao a busca e deterministica.
       */
      document.getElementById(ID_DO_CAMPO)?.focus();

      onCreated(especie);
      onResult({ variant: 'success', message: MESSAGES.SPECIES.CREATE_SUCCESS });
    } catch (erro) {
      tratarFalhaDaCriacao(erro);
    } finally {
      /**
       * `finally` e nao uma linha no fim do `try`: e ele que garante que o botao
       * volta a responder em QUALQUER desfecho — sucesso, `ApiError`, falha de
       * rede ou defeito de programacao dentro do proprio tratador. Um `enviando`
       * que ficasse preso em `true` deixaria a tela sem forma de criar especie
       * alguma ate a pagina ser recarregada.
       */
      setEnviando(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(evento) => {
        void aoSubmeter(evento);
      }}
      // `items-start` porque o campo cresce para baixo quando exibe a mensagem de
      // erro: alinhados pelo topo, o botao nao desce junto com o texto do erro.
      className="flex items-start gap-3"
    >
      {/*
        O wrapper e que define a largura, e nao uma classe no `SubmitButton`.
        O botao carrega `w-full` na propria base e o Tailwind resolve conflito de
        utilitarios pela ordem da folha GERADA, nao pela ordem da string de
        classes — um `w-auto` passado por `className` perderia de forma
        silenciosa. Constranger o pai e deterministico. Mesmo raciocinio ja
        registrado no `admin-layout.tsx` sobre os utilitarios de `hover`.
      */}
      <div className="flex-1">
        <TextField
          id={ID_DO_CAMPO}
          label={MESSAGES.SPECIES.NAME_PLACEHOLDER}
          type="text"
          autoComplete="off"
          placeholder={MESSAGES.SPECIES.NAME_PLACEHOLDER}
          value={nome}
          error={errosDeCampo.name ?? ''}
          onChange={(evento) => {
            setNome(evento.target.value);
          }}
        />
      </div>

      {/*
        `isLoading` cuida do `disabled` e do `aria-busy`. E ele, e nao um
        `debounce`, o mecanismo do CT-35: com o botao desabilitado o segundo
        acionamento nao dispara evento de clique, e a submissao implicita por
        Enter tambem nao ocorre quando o botao padrao do formulario esta
        desabilitado. Duas travas para o mesmo estado divergiriam.

        O rotulo "Criar" e contrato de interface (CA-02), copiado da captura de
        tela que serve de fonte da verdade do layout.
      */}
      <div className="w-28 shrink-0">
        <SubmitButton isLoading={enviando}>{MESSAGES.SPECIES.CREATE_BUTTON}</SubmitButton>
      </div>
    </form>
  );
}
