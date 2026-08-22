import type { ReactElement } from 'react';

type CatDogLogoProps = {
  /** Aresta do icone em pixels. O padrao 36 e o `.logo-icon` do mockup. */
  readonly size?: number;
};

/**
 * Assinatura da marca: icone do cachorro + palavra "CatDog".
 *
 * As cores vivem em `fill`/`stroke` literais DENTRO do SVG de proposito. Elas
 * descrevem uma ilustracao (corpo, orelhas, olhos, focinho, rabo), nao estilo de
 * layout: nenhum token de tema deve ser capaz de recolorir o focinho do
 * cachorro. Fora do SVG, nenhuma cor literal aparece.
 *
 * O componente NAO carrega margem externa. O mockup tem `margin-bottom: 22px`
 * no `.logo`, mas esse espacamento pertence ao cartao que o contem — o
 * `AuthCard` o aplica. Sem isso o logo ficaria inutilizavel em cabecalhos de
 * layout (TASK-FRONTEND-011), que precisam de outro espacamento.
 */
export function CatDogLogo({ size = 36 }: CatDogLogoProps): ReactElement {
  return (
    <div className="flex items-center justify-center gap-[9px]">
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        role="img"
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>CatDog</title>
        <ellipse cx="20" cy="26" rx="11" ry="9" fill="#e05a1e" />
        <ellipse cx="13" cy="18" rx="4" ry="5.5" fill="#e05a1e" transform="rotate(-15 13 18)" />
        <ellipse cx="27" cy="18" rx="4" ry="5.5" fill="#e05a1e" transform="rotate(15 27 18)" />
        <circle cx="20" cy="20" r="8" fill="#e05a1e" />
        <circle cx="17.5" cy="19" r="1.2" fill="#fff" />
        <circle cx="22.5" cy="19" r="1.2" fill="#fff" />
        <ellipse cx="20" cy="22" rx="2.5" ry="1.5" fill="#c44a10" />
        <path
          d="M31 28 Q37 22 34 18"
          stroke="#e05a1e"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      {/*
        O nome acessivel da marca ja e anunciado pelo `<title>` do SVG acima.
        Repetir a palavra aqui como texto visivel e proposital (o mockup mostra
        icone + wordmark), mas expor as duas coisas ao leitor de tela faria ele
        ler "CatDog CatDog". O `aria-hidden` remove a duplicata, nao a
        informacao.
      */}
      <span aria-hidden="true" className="text-[1.45rem] font-extrabold tracking-[-0.3px] text-ink">
        CatDog
      </span>
    </div>
  );
}
