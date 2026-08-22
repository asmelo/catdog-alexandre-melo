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
        hairline: '#e4e2f0', // --border  borda de 1.5px dos campos
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
        'focus-ring': '0 0 0 3px rgba(124, 58, 237, 0.10)', // .field input:focus
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
