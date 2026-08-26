import type { ReactElement, ReactNode } from 'react';

type DataListProps<T> = {
  readonly items: readonly T[];
  /**
   * Identidade estavel do item. OBRIGATORIA e tipada: o indice do array NAO
   * serve como `key` aqui. A lista se reordena depois de um renomear, e com o
   * indice o React remontaria a linha errada — o campo em edicao passaria a
   * pertencer a outro registro e o foco saltaria de lugar.
   */
  readonly getKey: (item: T) => string;
  /** Conteudo da linha. O componente nao decide o que a linha mostra. */
  readonly renderRow: (item: T) => ReactNode;
  /** Nome da regiao, anunciado pelo leitor de tela ao entrar na lista. */
  readonly ariaLabel: string;
};

/**
 * `<li>` da linha.
 *
 * `min-h-[56px]` garante que a linha comporte o alvo de toque de 44px das acoes
 * sem que elas encostem na borda. `last:border-b-0` evita o fio solto embaixo do
 * ultimo item, que brigaria com o arredondamento do cartao.
 */
const CLASSES_DA_LINHA =
  'flex min-h-[56px] items-center justify-between gap-4 border-b border-hairline px-4 py-2 last:border-b-0';

/**
 * Lista generica de uma coluna de dado com acoes a direita.
 *
 * `<ul>`/`<li>` e NAO `<table>`: a lista tem um unico dado por linha e duas
 * acoes. Uma tabela de uma coluna acrescentaria semantica de grade — o leitor de
 * tela anunciaria linhas e colunas de uma grade que nao existe, e a navegacao
 * por celula passaria a ser oferecida sem ter para onde ir. O `aria-label` na
 * `<ul>` nomeia a regiao, que e a informacao que a tabela daria de util.
 *
 * O componente e deliberadamente ignorante do dominio: nao ordena, nao filtra e
 * nao sabe o que e uma especie. A ordem em que os itens chegam e a ordem em que
 * sao exibidos — quem monta a lista e responsavel por ordena-la (e, tratando-se
 * de texto com acento, por usar `localeCompare` e nao comparacao binaria).
 */
export function DataList<T>({
  items,
  getKey,
  renderRow,
  ariaLabel,
}: DataListProps<T>): ReactElement {
  return (
    <ul
      aria-label={ariaLabel}
      className="overflow-hidden rounded-card bg-surface-card shadow-card"
    >
      {items.map((item) => (
        <li key={getKey(item)} className={CLASSES_DA_LINHA}>
          {renderRow(item)}
        </li>
      ))}
    </ul>
  );
}
