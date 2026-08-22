import type { ReactElement } from 'react';

type PosicaoDePegada = {
  /** Distancia da borda esquerda da viewport, em porcentagem. */
  readonly left: number;
  /** Distancia do topo da viewport, em porcentagem. */
  readonly top: number;
  /** Rotacao em graus. */
  readonly rotation: number;
};

/**
 * As 16 pegadas do fundo, com posicao E rotacao fixas.
 *
 * DIVERGENCIA DELIBERADA DO MOCKUP: o `reference.html` sorteia a rotacao com
 * `Math.random() * 60 - 30` a cada carregamento. Aqui as rotacoes sao literais,
 * dentro da mesma faixa (-30..30 graus), por tres motivos:
 *
 * 1. render aleatorio produz layout diferente a cada montagem, o que impede
 *    qualquer snapshot de teste (TASK-FRONTEND-013);
 * 2. sob `StrictMode` o React monta o componente duas vezes em
 *    desenvolvimento — com sorteio, as pegadas "saltariam" na primeira pintura;
 * 3. decoracao instavel entre navegacoes e ruido visual, nao charme.
 *
 * As coordenadas sao exatamente as do mockup; so as rotacoes foram congeladas.
 */
const POSICOES_DAS_PEGADAS: readonly PosicaoDePegada[] = [
  { left: 5, top: 5, rotation: -22 },
  { left: 15, top: 75, rotation: 18 },
  { left: 25, top: 40, rotation: -7 },
  { left: 40, top: 10, rotation: 26 },
  { left: 55, top: 80, rotation: -14 },
  { left: 70, top: 20, rotation: 9 },
  { left: 80, top: 60, rotation: -28 },
  { left: 90, top: 5, rotation: 13 },
  { left: 90, top: 85, rotation: -4 },
  { left: 10, top: 50, rotation: 24 },
  { left: 60, top: 50, rotation: -18 },
  { left: 35, top: 90, rotation: 6 },
  { left: 48, top: 30, rotation: 29 },
  { left: 75, top: 40, rotation: -11 },
  { left: 20, top: 20, rotation: 21 },
  { left: 65, top: 70, rotation: -25 },
];

/**
 * Camada decorativa de pegadas atras do conteudo.
 *
 * `aria-hidden` + `pointer-events-none` sao requisitos, nao enfeite: sem o
 * primeiro, um leitor de tela anunciaria 16 imagens sem significado antes do
 * formulario; sem o segundo, a camada `fixed inset-0` cobriria a tela inteira e
 * engoliria qualquer clique, inclusive o do botao de submit.
 *
 * A animacao de entrada do cartao e desativada globalmente sob
 * `prefers-reduced-motion` em `src/styles/index.css`; esta camada e estatica e
 * nao precisa de tratamento proprio.
 */
export function PawBackground(): ReactElement {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 text-paw">
      {POSICOES_DAS_PEGADAS.map((pegada) => (
        <div
          key={`${pegada.left}-${pegada.top}`}
          className="absolute opacity-[0.18]"
          style={{
            left: `${pegada.left}%`,
            top: `${pegada.top}%`,
            transform: `rotate(${pegada.rotation}deg)`,
          }}
        >
          <svg viewBox="0 0 100 100" className="h-14 w-14 fill-current" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="50" cy="62" rx="20" ry="25" />
            <ellipse cx="22" cy="38" rx="9" ry="12" transform="rotate(-20 22 38)" />
            <ellipse cx="78" cy="38" rx="9" ry="12" transform="rotate(20 78 38)" />
            <ellipse cx="34" cy="22" rx="8" ry="10" transform="rotate(-10 34 22)" />
            <ellipse cx="66" cy="22" rx="8" ry="10" transform="rotate(10 66 22)" />
          </svg>
        </div>
      ))}
    </div>
  );
}
