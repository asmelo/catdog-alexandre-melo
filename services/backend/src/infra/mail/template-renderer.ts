import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Renderizador dos templates de e-mail. Substituicao de `{{chave}}` e escape de
 * HTML, sem engine de template: Handlebars ou EJS trariam parser, helpers e
 * compilacao para resolver dois arquivos estaticos e quatro variaveis.
 */

/** Par renderizado. `text` acompanha `html` sempre — ver `MailMessage`. */
export interface RenderedTemplate {
  readonly html: string;
  readonly text: string;
}

/**
 * `__dirname` e nao `process.cwd()`: em producao o processo sobe de
 * `dist/index.js` e o diretorio de trabalho depende de quem invoca. Os arquivos
 * chegam aqui pelo script `copy:templates`, ja que o `tsc` copia apenas `.ts`.
 */
const DIRETORIO_DE_TEMPLATES = path.join(__dirname, 'templates');

/**
 * O nome do template compoe um caminho de arquivo. A lista branca de
 * caracteres impede que um `../` (hoje impossivel, porque quem chama passa
 * literal — amanha nao necessariamente) escape do diretorio de templates.
 */
const NOME_DE_TEMPLATE_VALIDO = /^[a-z0-9-]+$/;

/** Aceita `{{chave}}` com ou sem espacos internos. */
const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

interface TemplateBruto {
  readonly html: string;
  readonly text: string;
}

/**
 * Cache por nome de template. Os arquivos sao estaticos e pequenos: reler a
 * cada e-mail seria I/O sincrono no caminho de uma requisicao HTTP.
 */
const cacheDeTemplates = new Map<string, TemplateBruto>();

/**
 * Escape das cinco entidades. A ordem importa: `&` primeiro, senao os `&` das
 * proprias entidades geradas depois seriam escapados de novo.
 */
function escaparHtml(valor: string): string {
  return valor
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function lerArquivo(templateName: string, extensao: 'html' | 'txt'): string {
  const caminho = path.join(DIRETORIO_DE_TEMPLATES, `${templateName}.${extensao}`);

  // Mensagem explicita em vez do ENOENT cru: a causa provavel e o
  // `copy:templates` nao ter rodado, falha que aparece somente no ambiente
  // empacotado e cujo sintoma (ENOENT em `dist/`) nao aponta para o script.
  if (!existsSync(caminho)) {
    throw new Error(
      `Template de e-mail nao encontrado em ${caminho}. ` +
        'Em ambiente compilado isto costuma significar que o script "copy:templates" ' +
        'do package.json nao copiou src/infra/mail/templates para dist/.',
    );
  }

  return readFileSync(caminho, 'utf-8');
}

function carregarTemplate(templateName: string): TemplateBruto {
  const emCache = cacheDeTemplates.get(templateName);

  if (emCache !== undefined) {
    return emCache;
  }

  const bruto: TemplateBruto = {
    html: lerArquivo(templateName, 'html'),
    text: lerArquivo(templateName, 'txt'),
  };

  cacheDeTemplates.set(templateName, bruto);

  return bruto;
}

/**
 * Substitui os placeholders. `escapar` distingue os dois corpos: no `.html`
 * cada valor injetado passa por `escaparHtml`, no `.txt` nenhum passa — escapar
 * o texto puro faria o usuario ler `&amp;` literalmente e quebraria a URL
 * copiavel.
 */
function preencher(
  conteudo: string,
  variables: Readonly<Record<string, string>>,
  templateName: string,
  escapar: boolean,
): string {
  // `replaceAll` com regex exige a flag `g`, que `PLACEHOLDER` tem.
  return conteudo.replaceAll(PLACEHOLDER, (_ocorrencia: string, chave: string): string => {
    const valor = variables[chave];

    // Placeholder sem valor e bug de programacao, nao entrada invalida de
    // cliente: por isso um `Error` comum e nao um `AppError`, que carrega
    // `statusCode`/`isOperational: true` e faria o error handler responder a
    // mensagem interna como se fosse erro previsto. Assim cai no ramo generico
    // (500 + log de stack). Renderizar `{{userName}}` cru para o usuario final
    // seria pior que falhar.
    if (valor === undefined) {
      throw new Error(
        `Variavel "${chave}" exigida pelo template de e-mail "${templateName}" ` +
          'nao foi informada em `variables`.',
      );
    }

    return escapar ? escaparHtml(valor) : valor;
  });
}

export function renderTemplate(
  templateName: string,
  variables: Readonly<Record<string, string>>,
): RenderedTemplate {
  if (!NOME_DE_TEMPLATE_VALIDO.test(templateName)) {
    throw new Error(
      `Nome de template invalido: "${templateName}". Use apenas letras minusculas, digitos e hifens.`,
    );
  }

  const bruto = carregarTemplate(templateName);

  return {
    html: preencher(bruto.html, variables, templateName, true),
    text: preencher(bruto.text, variables, templateName, false),
  };
}
