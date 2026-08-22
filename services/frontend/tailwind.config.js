/**
 * Design tokens da identidade CatDog.
 *
 * Fonte NORMATIVA de todos os valores: `.makuco/resources/reference.html`. O
 * mockup e referencia de VALORES, nao codigo a reaproveitar — nenhuma regra CSS
 * dele e copiada para dentro do projeto; apenas os numeros migram para ca.
 *
 * Os tokens vivem em namespaces proprios (`brand`, `ink`, `surface`,
 * `hairline`, `paw`) em vez de sobrescrever `purple`/`gray`: assim nenhuma
 * escala padrao do Tailwind e destruida e cada token permanece rastreavel ate a
 * variavel CSS de origem, mapeada no comentario ao lado.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: '#7c3aed', //         --purple        botao, foco e links
          'purple-hover': '#6d28d9', // --purple-hover  hover do botao e do link
          'purple-light': '#ede9fe', //  --purple-light  realce de superficie
          orange: '#e05a1e', //         --orange        logo CatDog
          'orange-dark': '#c44a10', //  focinho do logo (fill do <ellipse>)
        },
        ink: {
          DEFAULT: '#1e1b2e', // --text-dark   titulos e valor digitado
          mid: '#4b4869', //     --text-mid    texto corrido
          muted: '#9896b0', //   --text-muted  placeholder e texto auxiliar
        },
        surface: {
          card: '#ffffff', //   --card      fundo do cartao
          input: '#f8f7fc', //  --input-bg  fundo dos campos
          canvas: '#dde0ea', // --bg        fundo da pagina
        },
        /*
         * DIVERGENCIA DELIBERADA DO MOCKUP, por acessibilidade.
         *
         * O `--border: #e4e2f0` do `reference.html` rende apenas 1.20:1 contra o
         * fundo do campo (`surface.input`) e 1.28:1 contra o cartao branco. O
         * WCAG 2.1 SC 1.4.11 exige 3:1 para o que identifica um componente de
         * interface, e a borda e o unico contorno do campo — o fundo do input
         * fica a 1.06:1 do cartao, praticamente invisivel.
         *
         * Escurecido preservando o matiz do mockup (hue 249) com a saturacao
         * levemente reduzida, para ler como cinza-lavanda e nao como lilas:
         * 3.14:1 sobre `surface.input` e 3.34:1 sobre branco. Nenhum token
         * existente servia — `ink.muted` da 2.69:1 e `paw` 2.02:1 (ambos
         * reprovam), e `ink.mid` passaria a 8.11:1, pesado demais para um fio.
         *
         * Afeta os dois unicos usos: a borda de repouso do campo e a borda da
         * variante `info` do AlertMessage.
         */
        hairline: '#8e87b5', // --border escurecido  borda de 1.5px dos campos
        paw: '#b0aec8', //      cor das pegadas decorativas do fundo
      },
      borderRadius: {
        field: '14px', // --radius  campos e botao
        card: '22px', //  border-radius do .card
      },
      boxShadow: {
        card: '0 8px 40px rgba(100, 80, 180, 0.13)', //  --shadow
        button: '0 4px 16px rgba(124, 58, 237, 0.30)', // .btn-submit
        'button-hover': '0 6px 20px rgba(124, 58, 237, 0.40)', // .btn-submit:hover
        /*
         * DIVERGENCIA DELIBERADA DO MOCKUP, consequencia do `hairline` escurecido.
         *
         * O mockup usa 10% de opacidade, o que rende 1.16:1 contra o cartao — um
         * brilho decorativo, nao um indicador. Enquanto a borda de repouso era
         * quase invisivel (#e4e2f0), o proprio roxo da borda sinalizava o foco a
         * 4.46:1. Com a borda escurecida esse delta caiu para 1.70:1, e nenhuma
         * cor resolve os dois criterios ao mesmo tempo: o SC 1.4.11 exige
         * luminancia <= 0.278 para a borda de repouso e o SC 2.4.11 exige >= 0.503
         * para o contraste entre focado e nao-focado. As faixas nao se cruzam.
         *
         * Por isso o ANEL passa a ser o indicador de foco, a 80% de opacidade:
         * 3.97:1 contra o cartao branco. Trocar a borda de foco para `ink` seria a
         * alternativa, mas custaria o roxo da marca no unico estado em que ele
         * comunica algo.
         */
        'focus-ring': '0 0 0 3px rgba(124, 58, 237, 0.80)', // .field input:focus (reforcado)
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', '-apple-system', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(28px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      // `both` preserva o estado inicial antes de comecar e o final ao terminar,
      // evitando o flash de conteudo posicionado que ocorreria sem fill mode.
      animation: {
        fadeUp: 'fadeUp 0.55s cubic-bezier(.22,1,.36,1) both',
      },
      maxWidth: {
        card: '420px', // max-width do .card
      },
      spacing: {
        card: '44px', // padding do .card (topo e laterais; a base usa 36px)
      },
    },
  },
  plugins: [],
};
