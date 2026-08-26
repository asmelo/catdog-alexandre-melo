import type { ReactElement } from 'react';

type EmptyStateProps = {
  readonly message: string;
};

type LoadingIndicatorProps = {
  readonly label: string;
};

type ErrorStateProps = {
  readonly message: string;
  /**
   * OBRIGATORIO. Um estado de erro sem saida e exatamente o defeito que este
   * componente existe para impedir: sem nova tentativa, resta ao usuario
   * recarregar a pagina por conta propria ou concluir que o sistema quebrou.
   */
  readonly onRetry: () => void;
  readonly retryLabel: string;
};

/**
 * Moldura comum aos tres estados.
 *
 * Repete o cartao do `DataList` porque os tres ocupam o MESMO lugar da tela que
 * a lista ocuparia: sem ela, a troca entre carregando, vazio, erro e lista
 * mudaria tambem o fundo, o raio e a sombra do bloco a cada transicao.
 *
 * O que a moldura NAO estabiliza e a altura, e o comentario nao promete isso: o
 * cartao de feedback tem `py-10` fixo e o `DataList` cresce `min-h-[56px]` por
 * linha, entao o salto vertical entre um estado e a lista continua existindo.
 * Emparelhar as alturas depende de quantos itens a lista tera, o que so a tela
 * sabe — nao a primitiva.
 */
const CLASSES_DO_CARTAO = 'rounded-card bg-surface-card px-4 py-10 shadow-card';

/**
 * Lista sem nenhum item.
 *
 * Nenhum texto vem embutido: a mensagem chega por prop, do catalogo de mensagens
 * de quem consome. Uma primitiva que soubesse dizer "Nenhuma especie cadastrada"
 * deixaria de ser reaproveitavel pela proxima tela do modulo.
 */
export function EmptyState({ message }: EmptyStateProps): ReactElement {
  return (
    <p className={`${CLASSES_DO_CARTAO} text-center text-[0.875rem] font-semibold text-ink-mid`}>
      {message}
    </p>
  );
}

/**
 * Espera pelo carregamento da lista.
 *
 * `role="status"` e NAO `role="alert"`: carregamento e informacao educada. O
 * papel assertivo interromperia o que o leitor de tela estivesse falando para
 * anunciar "Carregando", que e justamente o que o usuario nao precisa ouvir com
 * prioridade.
 *
 * O rotulo aparece DUAS vezes de proposito, e cada uma serve a um momento:
 * o `aria-label` da nome acessivel a regiao para quem navega ate ela depois de
 * ela ja existir, e o texto `sr-only` e o CONTEUDO da regiao viva — e conteudo
 * que o leitor anuncia quando o bloco e montado. So o `aria-label` nao produz
 * anuncio nenhum (a regiao entraria vazia); so o texto nao produz nome
 * acessivel, porque `status` nao compoe nome a partir do proprio conteudo.
 */
export function LoadingIndicator({ label }: LoadingIndicatorProps): ReactElement {
  return (
    <div role="status" aria-label={label} className={CLASSES_DO_CARTAO}>
      <span className="sr-only">{label}</span>
      {/*
        Esqueleto puramente decorativo: nao acrescenta informacao ao que o
        `sr-only` acima ja diz, entao fica fora da arvore de acessibilidade.
      */}
      <div aria-hidden="true" className="flex flex-col items-center gap-3">
        <span className="h-3 w-full max-w-[220px] animate-pulse rounded-field bg-brand-purple-light" />
        <span className="h-3 w-full max-w-[160px] animate-pulse rounded-field bg-brand-purple-light" />
      </div>
    </div>
  );
}

/**
 * Falha ao carregar, com a saida obrigatoria.
 *
 * O botao e um `<button>` de verdade, e nao um link ou um `<div>` clicavel: e
 * assim que ele entra na ordem de tabulacao e responde a Enter e Espaco sem
 * nenhum tratador de teclado escrito a mao (RNF-06).
 *
 * Ele e clone estilistico do botao secundario do `login-page.tsx`, entao repete
 * tambem o foco daquele botao: `shadow-focus-ring` mais `outline-none`, a
 * tecnica dominante da base. Sobre o cartao branco o anel roxo a 80% rende
 * 3.97:1, acima dos 3:1 do SC 1.4.11.
 */
export function ErrorState({ message, onRetry, retryLabel }: ErrorStateProps): ReactElement {
  return (
    <div className={`${CLASSES_DO_CARTAO} flex flex-col items-center gap-4 text-center`}>
      <p className="text-[0.875rem] font-semibold text-ink">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-field border-[1.5px] border-brand-purple px-4 py-2 text-[0.82rem] font-extrabold text-brand-purple transition-colors hover:bg-brand-purple-light focus-visible:shadow-focus-ring focus-visible:outline-none"
      >
        {retryLabel}
      </button>
    </div>
  );
}
