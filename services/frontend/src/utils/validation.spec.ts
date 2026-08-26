import { readFileSync } from 'node:fs';
import path from 'node:path';

import { MESSAGES } from '~/utils/messages';
import {
  hasFieldErrors,
  normalizeSpeciesName,
  validateEmailOnlyForm,
  validateLoginForm,
  validateRegisterForm,
  validateSpeciesNameForm,
} from '~/utils/validation';

/**
 * Specs das regras de validacao de formulario.
 *
 * Cada regra e exercitada CHAMANDO A FUNCAO, e nao montando uma arvore, digitando
 * num campo e lendo o DOM. Foi para isso que a TASK-FRONTEND-008 as deixou puras:
 * uma regra verificada por consulta ao DOM e uma regra verificada de forma
 * indireta, e o teste passaria a falhar por mudanca de marcacao.
 *
 * As mensagens sao comparadas contra `MESSAGES`, nao contra literais repetidas
 * aqui. Duplicar as frases criaria uma segunda fonte de verdade para o mesmo texto
 * — exatamente o que o catalogo existe para evitar.
 */

const SENHA_VALIDA = 'Abc12345';

describe('validateLoginForm', () => {
  it('aceita e-mail e senha preenchidos', () => {
    expect(validateLoginForm({ email: 'pessoa@catdog.test', password: SENHA_VALIDA })).toEqual({});
  });

  it('exige e-mail e senha, e a obrigatoriedade vence o formato', () => {
    const erros = validateLoginForm({ email: '', password: '' });

    // Campo vazio recebe "Este campo é obrigatório.", nao "Informe um e-mail
    // válido.": o problema a resolver primeiro e o de preencher.
    expect(erros).toEqual({
      email: MESSAGES.VALIDATION.FIELD_REQUIRED,
      password: MESSAGES.VALIDATION.FIELD_REQUIRED,
    });
  });

  it('trata campo com apenas espacos como em branco', () => {
    // O `nameSchema`/`loginSchema` do backend tambem aparam antes de exigir
    // conteudo; sem o `.trim()` aqui, " " passaria e voltaria como
    // `VALIDATION_ERROR` do servidor.
    expect(validateLoginForm({ email: '   ', password: '   ' })).toEqual({
      email: MESSAGES.VALIDATION.FIELD_REQUIRED,
      password: MESSAGES.VALIDATION.FIELD_REQUIRED,
    });
  });

  it('reprova e-mail sem arroba, sem dominio ou com espaco', () => {
    for (const email of ['sem-arroba', 'pessoa@sem-ponto', 'pessoa @catdog.test', '@catdog.test']) {
      expect(validateLoginForm({ email, password: SENHA_VALIDA })).toEqual({
        email: MESSAGES.VALIDATION.EMAIL_INVALID,
      });
    }
  });

  it('NAO aplica o tamanho minimo de senha no login', () => {
    /**
     * Omissao deliberada. Responder "A senha deve ter pelo menos 8 caracteres."
     * na tela de login informaria a quem sonda o sistema qual e o formato aceito
     * e, para uma conta antiga com senha mais curta, bloquearia o login em vez de
     * recusar a credencial. E a mesma decisao do `loginSchema` do backend.
     */
    expect(validateLoginForm({ email: 'pessoa@catdog.test', password: 'curta' })).toEqual({});
  });
});

describe('validateRegisterForm', () => {
  const validos = {
    name: 'Caio Cliente',
    email: 'pessoa@catdog.test',
    password: SENHA_VALIDA,
    passwordConfirmation: SENHA_VALIDA,
  };

  it('aceita o formulario completo e valido', () => {
    expect(validateRegisterForm(validos)).toEqual({});
  });

  it('CT-18: senha com exatamente 8 caracteres e aceita', () => {
    // Borda inferior da RN-04: 8 passa, 7 nao.
    expect(validateRegisterForm({ ...validos, password: 'Abc12345', passwordConfirmation: 'Abc12345' })).toEqual({});
  });

  it('reprova senha com 7 caracteres', () => {
    expect(validateRegisterForm({ ...validos, password: 'Abc1234', passwordConfirmation: 'Abc1234' })).toEqual({
      password: MESSAGES.VALIDATION.PASSWORD_TOO_SHORT,
    });
  });

  it('avalia TODAS as regras em uma passada, e nao apenas a primeira que falha', () => {
    const erros = validateRegisterForm({
      name: '',
      email: 'invalido',
      password: 'curta',
      passwordConfirmation: 'outra',
    });

    // Um formulario que aponta um problema por vez obriga o usuario a submeter
    // quatro vezes para descobrir os quatro erros.
    expect(erros).toEqual({
      name: MESSAGES.VALIDATION.FIELD_REQUIRED,
      email: MESSAGES.VALIDATION.EMAIL_INVALID,
      password: MESSAGES.VALIDATION.PASSWORD_TOO_SHORT,
      passwordConfirmation: MESSAGES.VALIDATION.PASSWORDS_DO_NOT_MATCH,
    });
  });

  it('senha vazia e ausencia, nao senha curta', () => {
    expect(validateRegisterForm({ ...validos, password: '', passwordConfirmation: '' })).toEqual({
      password: MESSAGES.VALIDATION.FIELD_REQUIRED,
      passwordConfirmation: MESSAGES.VALIDATION.FIELD_REQUIRED,
    });
  });

  it('NAO apara a senha: espaco e caractere valido de segredo', () => {
    // Aparar mudaria em silencio o segredo escolhido. Oito espacos e uma senha
    // ruim, nao uma senha ausente.
    expect(validateRegisterForm({ ...validos, password: '        ', passwordConfirmation: '        ' })).toEqual({});
  });

  it('confirmacao em branco recebe obrigatoriedade, nao divergencia', () => {
    // Emitir "As senhas não coincidem." para um campo vazio culparia o usuario por
    // algo que ele ainda nao fez.
    expect(validateRegisterForm({ ...validos, passwordConfirmation: '' })).toEqual({
      passwordConfirmation: MESSAGES.VALIDATION.FIELD_REQUIRED,
    });
  });

  it('RN-12: a confirmacao divergente e reportada no proprio campo', () => {
    expect(validateRegisterForm({ ...validos, passwordConfirmation: `${SENHA_VALIDA}x` })).toEqual({
      passwordConfirmation: MESSAGES.VALIDATION.PASSWORDS_DO_NOT_MATCH,
    });
  });
});

describe('validateEmailOnlyForm', () => {
  it('aceita e-mail valido e reprova em branco e mal formado', () => {
    expect(validateEmailOnlyForm('pessoa@catdog.test')).toEqual({});
    expect(validateEmailOnlyForm('')).toEqual({ email: MESSAGES.VALIDATION.FIELD_REQUIRED });
    expect(validateEmailOnlyForm('invalido')).toEqual({ email: MESSAGES.VALIDATION.EMAIL_INVALID });
  });
});

describe('hasFieldErrors', () => {
  it('distingue mapa vazio de mapa com ao menos um campo', () => {
    expect(hasFieldErrors({})).toBe(false);
    expect(hasFieldErrors({ email: MESSAGES.VALIDATION.EMAIL_INVALID })).toBe(true);
  });
});

/**
 * O NOME DE ESPECIE (MODULE-002) — CT-02 a CT-07 e CT-10.
 *
 * Cada regra continua sendo exercitada CHAMANDO A FUNCAO, pelo mesmo motivo
 * registrado no topo do arquivo. As mensagens saem de `MESSAGES`; repetir as
 * frases aqui criaria uma segunda fonte de verdade para textos que a spec compara
 * caractere a caractere.
 */

/** Nome com EXATAMENTE `tamanho` caracteres, sem espaco (que o colapso mexeria). */
function nomeComTamanho(tamanho: number): string {
  return 'A'.repeat(tamanho);
}

describe('validateSpeciesNameForm — tabela de tamanhos e obrigatoriedade', () => {
  /**
   * Tabela dos casos de teste da spec, um `it` por linha.
   *
   * Tabela e nao sete testes escritos a mao: o que se afirma e a PRECEDENCIA
   * entre os tres degraus e o valor exato das duas bordas, e uma tabela deixa
   * essas duas coisas visiveis lado a lado. Um `undefined` em `mensagem` significa
   * "mapa vazio", ou seja, nome aceito.
   */
  const casos: ReadonlyArray<{
    readonly ct: string;
    readonly rotulo: string;
    readonly entrada: string;
    readonly mensagem: string | undefined;
  }> = [
    { ct: 'CT-02', rotulo: 'campo vazio', entrada: '', mensagem: MESSAGES.VALIDATION.FIELD_REQUIRED },
    {
      ct: 'CT-03',
      rotulo: 'apenas espacos',
      entrada: '   ',
      // Cai no degrau da OBRIGATORIEDADE, e nao no do tamanho minimo: a medicao
      // acontece sobre o valor ja higienizado e normalizado, e `"   "` chega la
      // como `""`.
      mensagem: MESSAGES.VALIDATION.FIELD_REQUIRED,
    },
    { ct: 'CT-04', rotulo: 'um caractere', entrada: 'G', mensagem: MESSAGES.VALIDATION.NAME_TOO_SHORT },
    { ct: 'CT-05', rotulo: 'exatamente dois caracteres', entrada: 'Ov', mensagem: undefined },
    {
      ct: 'CT-06',
      rotulo: 'exatamente sessenta caracteres',
      entrada: nomeComTamanho(60),
      mensagem: undefined,
    },
    {
      ct: 'CT-07',
      rotulo: 'sessenta e um caracteres',
      entrada: nomeComTamanho(61),
      mensagem: MESSAGES.VALIDATION.NAME_TOO_LONG,
    },
    {
      ct: 'CT-10',
      rotulo: 'espacos nas pontas e internos',
      entrada: ' Cão   Pastor ',
      // `"Cão Pastor"` tem dez caracteres depois da RN-03 — dentro dos limites.
      mensagem: undefined,
    },
  ];

  for (const caso of casos) {
    it(`${caso.ct}: ${caso.rotulo}`, () => {
      // Arrange
      const valores = { name: caso.entrada };

      // Act
      const erros = validateSpeciesNameForm(valores);

      // Assert
      expect(erros).toEqual(caso.mensagem === undefined ? {} : { name: caso.mensagem });
    });
  }

  it('CT-10: a normalizacao PRESERVA caixa e acentos — o nome e exibido como foi digitado', () => {
    // Arrange
    const bruto = ' Cão   Pastor ';

    // Act
    const normalizado = normalizeSpeciesName(bruto);

    // Assert
    expect(normalizado).toBe('Cão Pastor');
    expect(normalizado).toHaveLength(10);
  });

  it('CT-10: o colapso alcanca tabulacao e quebra de linha, e nao apenas o espaco', () => {
    // Arrange
    const colado = ' Cão\t\n  Pastor ';

    // Act
    const normalizado = normalizeSpeciesName(colado);

    // Assert
    // O campo aceita COLAGEM de texto: `\s+` e nao `' +'`.
    expect(normalizado).toBe('Cão Pastor');
  });

  it('CT-06: a contagem e feita sobre o nome JA normalizado, e nao sobre o texto cru', () => {
    // Arrange
    // Sessenta caracteres uteis cercados por seis espacos: cru tem 66, normalizado
    // tem 60. Sem a normalizacao antes de medir, a tela recusaria um nome que o
    // servidor aceita.
    const comEspacosNasPontas = `   ${nomeComTamanho(60)}   `;

    // Act
    const erros = validateSpeciesNameForm({ name: comEspacosNasPontas });

    // Assert
    expect(erros).toEqual({});
  });

  it('CT-11: nomes que diferem apenas por acento sao ambos aceitos pela validacao local', () => {
    // Arrange & Act & Assert
    // A RN-05 e do servidor; o que esta camada nao pode fazer e recusar um dos
    // dois por conta propria.
    expect(validateSpeciesNameForm({ name: 'Réptil' })).toEqual({});
    expect(validateSpeciesNameForm({ name: 'Reptil' })).toEqual({});
  });
});

/**
 * CONTRATO DE FONTE ENTRE OS DOIS LADOS — o unico teste do projeto que abre um
 * arquivo do backend.
 *
 * A regra de higienizacao dos caracteres invisiveis existe DUAS vezes, copiada
 * literalmente de um lado para o outro:
 *
 * - `services/backend/src/domains/species/species.validators.ts` (`higienizar`);
 * - `services/frontend/src/utils/validation.ts` (`higienizarNomeDeEspecie`).
 *
 * Nada no build cruza os dois arquivos. Sem este teste, a divergencia volta calada
 * — e o modo de deriva provavel e o SERVIDOR ACRESCENTAR um code point: o cliente
 * passaria a contar A MAIS que o backend e recusaria um nome que o servidor
 * aceita, por causa de um caractere que o usuario nao ve e nao tem como apagar. E
 * a direcao PROIBIDA, a que o comentario de `FORMATO_DE_EMAIL` declara ser o pior
 * defeito possivel nesta camada.
 *
 * POR QUE LER O ARQUIVO, e nao fixar um caso de fronteira: um teste que so
 * afirmasse `"Ga​to"` continuaria VERDE depois de o backend acrescentar,
 * digamos, `U+180E` — o caso fixado nao mudaria de resultado e a divergencia
 * escaparia inteira. Ler o literal e comparar os dois e o que fecha o buraco na
 * direcao que importa.
 *
 * A constante do frontend e PRIVADA do modulo (nao e exportada, e exporta-la
 * seria alterar arquivo de producao), entao os dois lados sao lidos do mesmo
 * jeito: do texto do fonte.
 */

/**
 * Raiz do monorepo a partir deste spec (`services/frontend/src/utils`).
 *
 * `__dirname` e nao `process.cwd()`: o `roots` do Jest e relativo ao `rootDir`,
 * mas o comando pode ser disparado da raiz do repositorio ou de `services/frontend`
 * — e o caminho do backend precisa resolver nos dois casos.
 */
const RAIZ_DO_MONOREPO = path.resolve(__dirname, '..', '..', '..', '..');

const FONTE_DO_BACKEND = path.join(
  RAIZ_DO_MONOREPO,
  'services',
  'backend',
  'src',
  'domains',
  'species',
  'species.validators.ts',
);

const FONTE_DO_FRONTEND = path.join(__dirname, 'validation.ts');

/**
 * O literal da constante homonima nos dois arquivos.
 *
 * A ancora e o NOME da constante (`CARACTERES_INVISIVEIS`), identico dos dois
 * lados por ser copia deliberada. Renomear a constante em um dos lados reprova
 * aqui, o que tambem e desejavel: a copia so e rastreavel enquanto os dois nomes
 * coincidem.
 */
function literalDosInvisiveis(caminho: string): string {
  const fonte = readFileSync(caminho, 'utf8');
  const encontrado = /^const CARACTERES_INVISIVEIS = (\/\[[^\n]+\]\/g);$/m.exec(fonte);

  if (encontrado === null) {
    throw new Error(
      `Constante CARACTERES_INVISIVEIS nao encontrada em ${caminho}. ` +
        'A regra de higienizacao mudou de forma e o contrato entre os dois lados deixou de ser verificavel.',
    );
  }

  return encontrado[1] ?? '';
}

/** Reconstroi a expressao a partir do literal lido, para poder EXECUTA-LA. */
function regexDoLiteral(literal: string): RegExp {
  const corpo = literal.slice(1, literal.lastIndexOf('/'));

  return new RegExp(corpo, 'g');
}

describe('higienizacao de nome de especie — contrato de fonte com o backend', () => {
  it('a regex de caracteres invisiveis e LITERALMENTE a mesma nos dois lados', () => {
    // Arrange
    const noBackend = literalDosInvisiveis(FONTE_DO_BACKEND);

    // Act
    const noFrontend = literalDosInvisiveis(FONTE_DO_FRONTEND);

    // Assert
    // Qualquer code point a mais ou a menos em um dos lados devolve a divergencia
    // de contagem que a copia existe para fechar.
    expect(noFrontend).toBe(noBackend);
  });

  it('nenhum code point removido pelo servidor sobrevive no cliente — varredura do BMP inteiro', () => {
    // Arrange
    const doBackend = regexDoLiteral(literalDosInvisiveis(FONTE_DO_BACKEND));
    const doFrontend = regexDoLiteral(literalDosInvisiveis(FONTE_DO_FRONTEND));
    const divergentes: string[] = [];

    // Act — a varredura pega a deriva mesmo que a formatacao do literal mude
    // (ordem das faixas, notacao de escape), o que a comparacao textual acima nao
    // pegaria.
    for (let codePoint = 0; codePoint <= 0xffff; codePoint += 1) {
      const caractere = String.fromCharCode(codePoint);

      doBackend.lastIndex = 0;
      doFrontend.lastIndex = 0;

      if (doBackend.test(caractere) !== doFrontend.test(caractere)) {
        divergentes.push(`U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`);
      }
    }

    // Assert
    expect(divergentes).toEqual([]);
  });

  it('os invisiveis sao removidos ANTES do colapso, e nao contados como caractere', () => {
    // Arrange
    // Sessenta letras com um invisivel entre cada duas: 119 code points crus, 60
    // depois da higienizacao. Sem a remocao, a tela recusaria por tamanho um nome
    // que o servidor aceita.
    //
    // O SEPARADOR E `U+FEFF`, E A ESCOLHA E O TESTE. Ele e o unico da classe de
    // invisiveis que o `\s` do JavaScript tambem casa, e e isso que torna as duas
    // ordens distinguiveis: remover-e-depois-normalizar da 60 caracteres, enquanto
    // normalizar-e-depois-remover transforma cada um deles em espaco ANTES de
    // poder remove-lo e da 119 — `NAME_TOO_LONG`. Com `U+200B` no lugar, que o
    // `\s` nao casa, as duas ordens dao 60 e o teste ficaria verde com a inversao
    // presente. (Verificado por mutacao.)
    const comInvisiveis = nomeComTamanho(60).split('').join('﻿');

    // Act
    const erros = validateSpeciesNameForm({ name: comInvisiveis });

    // Assert
    expect(comInvisiveis.length).toBeGreaterThan(60);
    expect(erros).toEqual({});
  });

  it('o BOM e REMOVIDO e nao convertido em espaco: a ordem entre os dois passos e o ponto', () => {
    // Arrange
    // O `\s` do JavaScript CASA `U+FEFF`. Normalizar primeiro transformaria o BOM
    // em espaco em vez de remove-lo, e "Ga﻿to" viraria "Ga to" — dois nomes
    // diferentes no cliente e no servidor.
    const comBom = 'Ga﻿to';
    // A INVERSAO DA ORDEM SO E OBSERVAVEL NUMA BORDA, porque a unica saida
    // desta camada e a mensagem: entre 2 e 60 caracteres, `"Gato"` e `"Ga to"`
    // dao os dois o mapa vazio. Esta e a borda de BAIXO — uma letra so, com o
    // BOM preso no interior por um `U+200B`, que o `\s` NAO casa e por isso
    // impede o `.trim()` de alcancar o BOM. Removendo antes do colapso sobra
    // `"A"`, uma letra, e o nome e reprovado por curto como o servidor
    // reprovaria; normalizando antes, o BOM vira espaco e `"A "` passa por dois
    // caracteres — a tela aceitaria um nome que o servidor recusa. O teste
    // acima cobre a borda de CIMA e a direcao oposta, a proibida: recusar no
    // cliente o que o servidor aceita.
    const umaLetraComBomPresoNoInterior = 'A﻿​';

    // Act
    const erros = validateSpeciesNameForm({ name: comBom });
    const errosDaBordaDeBaixo = validateSpeciesNameForm({
      name: umaLetraComBomPresoNoInterior,
    });

    // Assert
    expect(erros).toEqual({});
    // O texto ENVIADO continua sendo o digitado: a higienizacao so muda o que e
    // MEDIDO antes da requisicao.
    expect(normalizeSpeciesName(comBom)).toBe('Ga to');
    // Uma letra continua sendo UMA letra: o BOM nao pode virar o segundo
    // caractere que o minimo exige.
    expect(errosDaBordaDeBaixo).toEqual({ name: MESSAGES.VALIDATION.NAME_TOO_SHORT });
  });

  it('um nome que so tem caracteres invisiveis e tratado como campo em branco', () => {
    // Arrange
    const invisivel = '​­⁠﻿';

    // Act
    const erros = validateSpeciesNameForm({ name: invisivel });

    // Assert
    expect(erros).toEqual({ name: MESSAGES.VALIDATION.FIELD_REQUIRED });
  });
});
