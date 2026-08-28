import type { ChangeEvent, ReactElement } from 'react';

interface ToggleFieldProps {
  readonly id: string;
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean;
}

/**
 * Alternancia liga/desliga dos dois indicadores do animal (RN-24).
 *
 * `<input type="checkbox">` REAL, apenas estilizado como alternancia — e nao uma
 * `div` com `role="switch"` construida a mao. O input nativo ja e focavel na
 * ordem de tabulacao, ja alterna com a barra de espaco, ja e anunciado com o
 * estado correto pelo leitor de tela e ja participa do formulario. A versao com
 * `div` exige reimplementar os quatro comportamentos, e o que costuma faltar e o
 * espaco — que ninguem testa no mouse.
 *
 * `role="switch"` SOBRE o checkbox nativo, e nao no lugar dele: o papel muda o
 * anuncio de "marcado/nao marcado" para "ligado/desligado", que e o vocabulario
 * correto para uma alternancia, sem abrir mao de nada do comportamento nativo.
 *
 * CONTROLADO, sem estado proprio: os dois indicadores nascem `false` (RN-24) e
 * quem os guarda e o formulario. Um estado interno aqui faria o "cancelar" da
 * tela deixar o controle ligado.
 *
 * ============ O ESTADO NAO E COMUNICADO SO POR COR (RNF-17) ============
 *
 * Tres canais independentes carregam a informacao:
 *
 * 1. a POSICAO do disco (esquerda/direita), visivel em monocromatico;
 * 2. o estado nativo do checkbox, que o leitor de tela anuncia sem que nada
 *    precise ser escrito;
 * 3. o rotulo associado.
 *
 * O roxo e o quarto canal, e nao o unico.
 *
 * ============ POR QUE O INPUT FICA DENTRO DO `<label>` ============
 *
 * O trilho precisa ser IRMAO DIRETO do input para que o `peer-focus-visible`
 * alcance: a variante `peer` do Tailwind gera um combinador de irmaos (`~`), que
 * nao atravessa para dentro de outro elemento. Com o trilho aninhado num label
 * irmao, o anel de foco simplesmente nao apareceria — e o teclado ficaria sem
 * indicador de foco, que e a falha de acessibilidade mais facil de nao notar,
 * porque no mouse tudo funciona.
 *
 * Envolvendo os tres num unico `<label>`, o trilho e irmao do input E o clique em
 * qualquer ponto da linha alterna o controle.
 */
export function ToggleField({
  id,
  label,
  checked,
  onChange,
  disabled,
}: ToggleFieldProps): ReactElement {
  const estaDesabilitado = disabled === true;

  return (
    <label
      htmlFor={id}
      className={[
        'inline-flex items-center gap-3 text-[0.85rem] font-semibold text-ink',
        estaDesabilitado ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      ].join(' ')}
    >
      {/*
        `sr-only` e nao `hidden` nem `display: none`: o input PERMANECE na ordem
        de tabulacao e continua sendo quem recebe o foco. Escondido de verdade,
        o campo ficaria inalcancavel por teclado.
      */}
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        disabled={estaDesabilitado}
        onChange={(evento: ChangeEvent<HTMLInputElement>) => {
          onChange(evento.target.checked);
        }}
      />
      {/*
        Trilho e disco puramente decorativos: `aria-hidden` porque o estado ja e
        anunciado pelo input real. Sem isso o leitor de tela leria a alternancia
        duas vezes.
      */}
      <span
        aria-hidden="true"
        className={[
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-[1.5px] transition-colors peer-focus-visible:shadow-focus-ring',
          checked ? 'border-brand-purple bg-brand-purple' : 'border-hairline bg-surface-input',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-[3px]',
          ].join(' ')}
        />
      </span>
      {label}
    </label>
  );
}
