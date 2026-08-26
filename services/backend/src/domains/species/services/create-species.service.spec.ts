import { SpeciesNameAlreadyExistsError } from '~/domains/species/errors/species.errors';
import { CreateSpeciesService } from '~/domains/species/services/create-species.service';
import { createSpeciesSchema } from '~/domains/species/species.validators';

import {
  ArmazemDeEspecies,
  InMemorySpeciesRepository,
  erroDeNomeDuplicado,
  erroDeTransacaoExpirada,
} from '../../../../tests/fakes/in-memory-species.repository';
import { reiniciarSequenciaDeUuid } from '../../../../tests/fakes/restauravel';

/**
 * HU-02 — criacao de especie (CT-01 a CT-12).
 *
 * DOIS niveis convivem neste arquivo, e a divisao nao e arbitraria:
 *
 * - CT-02 a CT-07 e CT-10 sao a RN-02 e a RN-03, que vivem na UNICA fronteira de
 *   validacao do projeto (`createSpeciesSchema`). O service jamais recebe um
 *   nome vazio, curto ou nao aparado — afirmar o contrario aqui seria testar um
 *   caminho que a aplicacao nao tem. Por isso esses casos sao exercitados pelo
 *   `safeParse` do schema, e nao pelo `execute`.
 * - CT-01, CT-08, CT-09, CT-11 e CT-12 sao regra do caso de uso e passam pelo
 *   service com o repositorio em memoria.
 *
 * O contrato HTTP dessas mesmas falhas (status, `code`, `details`) e verificado
 * em `tests/integration/species-routes.spec.ts`.
 */

/**
 * O caminho de producao inteiro do nome: o `validateRequest` parseia o corpo e
 * REATRIBUI `req.body`, entao o service so recebe nome ja higienizado e
 * normalizado. Passar a entrada crua direto ao `execute` pularia essa etapa e o
 * teste mediria um cenario que a rota nao produz.
 */
function corpoValidado(bruto: unknown): { name: string } {
  const resultado = createSpeciesSchema.safeParse(bruto);

  if (!resultado.success) {
    throw new Error(
      `Entrada rejeitada pelo schema: ${resultado.error.issues.map((i) => i.message).join(' | ')}`,
    );
  }

  return { name: resultado.data.name };
}

/** Mensagens produzidas pelo schema, por campo. */
function problemasDe(bruto: unknown): ReadonlyArray<string> {
  const resultado = createSpeciesSchema.safeParse(bruto);

  return resultado.success ? [] : resultado.error.issues.map((problema) => problema.message);
}

const NOME_COM_60_CARACTERES = 'A'.repeat(60);
const NOME_COM_61_CARACTERES = 'A'.repeat(61);

/**
 * `I` MAIUSCULO COM PONTO, U+0130. E o unico caractere do teste que precisa ser
 * escrito por code point e nao literalmente: `'İ'.toLowerCase()` devolve DOIS
 * code units (`i` + combinante U+0307), entao 60 deles ocupam 60 posicoes em
 * `name` e 120 em `name_normalized`.
 */
const I_MAIUSCULO_COM_PONTO = '\u0130';
const NOME_QUE_SO_ESTOURA_DEPOIS_DE_MINUSCULO = I_MAIUSCULO_COM_PONTO.repeat(60);

/** Espaco de LARGURA ZERO, U+200B. Invisivel e ignorado pelo `\s` da RN-03. */
const ESPACO_DE_LARGURA_ZERO = '\u200B';

/**
 * OS OITO code points de `CARACTERES_INVISIVEIS` (`species.validators.ts`), um a
 * um e nomeados.
 *
 * A tabela e exaustiva de proposito: com casos avulsos, a faixa `\u200B-\u200F`
 * podia perder QUATRO membros (U+200C a U+200F — nao-juntor, juntor e os dois
 * marcadores de direcao de texto) sem que nada reprovasse, porque nenhum caso os
 * alcancava. Um por linha, encolher a regex passa a reprovar o membro exato que
 * sumiu, e a mensagem do `it.each` nomeia qual.
 */
const INVISIVEIS_REMOVIDOS: ReadonlyArray<readonly [string, string]> = [
  ['U+00AD (hifen suave)', '\u00AD'],
  ['U+200B (espaco de largura zero)', '\u200B'],
  ['U+200C (nao-juntor de largura zero)', '\u200C'],
  ['U+200D (juntor de largura zero)', '\u200D'],
  ['U+200E (marca esquerda-para-direita)', '\u200E'],
  ['U+200F (marca direita-para-esquerda)', '\u200F'],
  ['U+2060 (colador de palavras)', '\u2060'],
  ['U+FEFF (BOM)', '\uFEFF'],
];

describe('createSpeciesSchema (fronteira de validação da criação)', () => {
  it('CT-02: nome vazio é recusado com "Este campo é obrigatório." e nada mais', () => {
    // Arrange & Act
    const problemas = problemasDe({ name: '' });

    // Assert — uma mensagem por campo: o `superRefine` único do validador existe
    // para que o vazio não saia também como "mínimo 2 caracteres".
    expect(problemas).toEqual(['Este campo é obrigatório.']);
  });

  it('CT-02: nome ausente no corpo é recusado como campo obrigatório, em PT-BR', () => {
    // Arrange & Act — o default do Zod para campo ausente é o literal inglês
    // "Required", proibido pela RNF-12.
    const problemas = problemasDe({});

    // Assert
    expect(problemas).toEqual(['Este campo é obrigatório.']);
  });

  it('CT-03: nome com apenas espaços é recusado como obrigatório, e não como curto demais', () => {
    // Arrange & Act — a normalização roda ANTES da medição (CA-07), então "   "
    // chega ao medidor como "".
    const problemas = problemasDe({ name: '   ' });

    // Assert
    expect(problemas).toEqual(['Este campo é obrigatório.']);
  });

  it('CT-04: nome com 1 caractere é recusado com "O nome da espécie deve ter no mínimo 2 caracteres."', () => {
    // Arrange & Act
    const problemas = problemasDe({ name: 'G' });

    // Assert
    expect(problemas).toEqual(['O nome da espécie deve ter no mínimo 2 caracteres.']);
  });

  it('CT-05: nome com exatamente 2 caracteres é ACEITO — o limite é inclusivo', () => {
    // Arrange & Act
    const problemas = problemasDe({ name: 'Ov' });

    // Assert
    expect(problemas).toEqual([]);
  });

  it('CT-06: nome com exatamente 60 caracteres é ACEITO — o limite é inclusivo', () => {
    // Arrange & Act
    const problemas = problemasDe({ name: NOME_COM_60_CARACTERES });

    // Assert
    expect(problemas).toEqual([]);
  });

  it('CT-07: nome com 61 caracteres é recusado com "O nome da espécie deve ter no máximo 60 caracteres."', () => {
    // Arrange & Act
    const problemas = problemasDe({ name: NOME_COM_61_CARACTERES });

    // Assert
    expect(problemas).toEqual(['O nome da espécie deve ter no máximo 60 caracteres.']);
  });

  it('CT-07: os 60 caracteres são contados DEPOIS da normalização, não sobre o texto cru', () => {
    // Arrange — 60 caracteres úteis cercados por espaços: cru tem 64, normalizado
    // tem 60. Medir o cru recusaria uma entrada válida (CA-07).
    const bruto = `  ${NOME_COM_60_CARACTERES}  `;

    // Act
    const problemas = problemasDe({ name: bruto });

    // Assert
    expect(bruto.length).toBeGreaterThan(60);
    expect(problemas).toEqual([]);
  });

  it('CT-10: " Cão   Pastor " é normalizado para "Cão Pastor" antes de chegar ao service (RN-03)', () => {
    // Arrange & Act
    const corpo = corpoValidado({ name: ' Cão   Pastor ' });

    // Assert
    expect(corpo.name).toBe('Cão Pastor');
  });

  it('CT-07: nome de 60 caracteres cuja CHAVE passa de 60 é recusado como longo demais, e não vira 500', () => {
    // Arrange — `İ` (U+0130) cresce ao virar minúsculo. São 60 caracteres, então
    // o nome cabe no `VARCHAR(60)` de `name`; a chave derivada tem 120 e NÃO
    // cabe no de `name_normalized`. Sem a segunda medição do validador, a
    // requisição passaria pelo 400 e morreria no `INSERT` como erro de
    // infraestrutura — 500 para uma entrada que é apenas comprida demais.
    const chave = NOME_QUE_SO_ESTOURA_DEPOIS_DE_MINUSCULO.toLowerCase();

    // Act
    const problemas = problemasDe({ name: NOME_QUE_SO_ESTOURA_DEPOIS_DE_MINUSCULO });

    // Assert — a premissa do caso vem junto: se um dia `toLowerCase()` deixar de
    // crescer, é este par de expectativas que avisa que o teste virou decorativo.
    expect(NOME_QUE_SO_ESTOURA_DEPOIS_DE_MINUSCULO).toHaveLength(60);
    expect(chave.length).toBeGreaterThan(60);
    expect(problemas).toEqual(['O nome da espécie deve ter no máximo 60 caracteres.']);
  });

  it('RN-04: caracteres invisíveis são REMOVIDOS antes da normalização, e não sobrevivem na chave', () => {
    // Arrange & Act — "Ga<U+200B>to" é indistinguível de "Gato" na tela. Sem a
    // remoção, ele produziria uma chave de unicidade diferente e o cadastro
    // exibiria duas linhas visualmente idênticas — a duplicata que a RN-04
    // existe para impedir.
    const corpo = corpoValidado({ name: `Ga${ESPACO_DE_LARGURA_ZERO}to` });

    // Assert
    expect(corpo.name).toBe('Gato');
  });

  it('CT-02: nome feito só de caracteres invisíveis é recusado como obrigatório, e não gravado', () => {
    // Arrange & Act — dois U+200B passariam pelo mínimo de 2 caracteres se não
    // fossem removidos, e uma espécie de nome invisível entraria no cadastro.
    const problemas = problemasDe({ name: ESPACO_DE_LARGURA_ZERO.repeat(2) });

    // Assert
    expect(problemas).toEqual(['Este campo é obrigatório.']);
  });

  it.each(INVISIVEIS_REMOVIDOS)(
    'RN-04: %s é removido do nome, e a lista de invisíveis não perde este membro em silêncio',
    (_nome, invisivel) => {
      // Arrange — o invisível vai no MEIO da palavra: nas extremidades o `trim()`
      // da RN-03 poderia mascarar a falta da remoção em alguns dos oito, e o
      // caso deixaria de discriminar.
      const bruto = `Ga${invisivel}to`;

      // Act
      const corpo = corpoValidado({ name: bruto });

      // Assert
      expect(corpo.name).toBe('Gato');
    },
  );

  it('CT-33: chave não prevista no corpo é recusada apontando o campo (RN-13)', () => {
    // Arrange & Act
    const resultado = createSpeciesSchema.safeParse({ name: 'Gato', ordem: 1 });

    // Assert — o `field` do `details` precisa nomear a chave extra; um `path`
    // vazio não marcaria campo nenhum na tela.
    expect(resultado.success).toBe(false);
    expect(resultado.success ? [] : resultado.error.issues).toEqual([
      expect.objectContaining({
        path: ['ordem'],
        message: 'Campo não permitido nesta requisição.',
      }),
    ]);
  });
});

describe('CreateSpeciesService', () => {
  let armazem: ArmazemDeEspecies;
  let especies: InMemorySpeciesRepository;
  let servico: CreateSpeciesService;

  beforeEach(() => {
    reiniciarSequenciaDeUuid();

    armazem = new ArmazemDeEspecies();
    especies = new InMemorySpeciesRepository(armazem);
    servico = new CreateSpeciesService(especies);
  });

  it('CT-01: nome válido e inédito grava a espécie e devolve a representação pública', async () => {
    // Arrange
    const entrada = corpoValidado({ name: 'Cachorro' });

    // Act
    const criada = await servico.execute(entrada);

    // Assert
    expect(armazem.linhas).toHaveLength(1);
    expect(armazem.linhas[0]).toMatchObject({
      name: 'Cachorro',
      nameNormalized: 'cachorro',
    });
    expect(criada).toMatchObject({ name: 'Cachorro' });
  });

  it('CT-01: a representação devolvida NÃO expõe `nameNormalized` e traz as datas em ISO-8601', async () => {
    // Arrange
    const entrada = corpoValidado({ name: 'Cachorro' });

    // Act
    const criada = await servico.execute(entrada);

    // Assert — a chave de unicidade é detalhe de persistência e a spec proíbe
    // expô-la; o contrato das datas é a string ISO, não um `Date`.
    expect(Object.keys(criada).sort()).toEqual(['createdAt', 'id', 'name', 'updatedAt']);
    expect(criada.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('CT-10: a espécie é gravada com os espaços já colapsados, do jeito que a lista vai exibir', async () => {
    // Arrange
    const entrada = corpoValidado({ name: ' Cão   Pastor ' });

    // Act
    const criada = await servico.execute(entrada);

    // Assert
    expect(criada.name).toBe('Cão Pastor');
    expect(armazem.linhas[0]?.nameNormalized).toBe('cão pastor');
  });

  it('CT-08: "gato" com "Gato" já cadastrado é recusado com SPECIES_NAME_ALREADY_EXISTS e nada é criado (RN-04)', async () => {
    // Arrange
    armazem.semear({ name: 'Gato' });

    // Act
    const desfecho = servico.execute(corpoValidado({ name: 'gato' }));

    // Assert
    await expect(desfecho).rejects.toBeInstanceOf(SpeciesNameAlreadyExistsError);
    expect(armazem.linhas).toHaveLength(1);
  });

  it('CT-09: "  Gato  " com "Gato" já cadastrado também colide — espaços não criam nome novo', async () => {
    // Arrange
    armazem.semear({ name: 'Gato' });

    // Act
    const desfecho = servico.execute(corpoValidado({ name: '  Gato  ' }));

    // Assert
    await expect(desfecho).rejects.toBeInstanceOf(SpeciesNameAlreadyExistsError);
    expect(armazem.linhas).toHaveLength(1);
  });

  it('CT-08: o erro carrega o `code` e a mensagem exatos do contrato', async () => {
    // Arrange
    armazem.semear({ name: 'Gato' });

    // Act
    const motivo = await servico.execute(corpoValidado({ name: 'GATO' })).catch(
      (erro: unknown) => erro,
    );

    // Assert — o frontend ramifica pelo `code`; a mensagem é comparada
    // caractere a caractere pelos critérios de aceite.
    expect(motivo).toBeInstanceOf(SpeciesNameAlreadyExistsError);
    expect(motivo).toMatchObject({
      code: 'SPECIES_NAME_ALREADY_EXISTS',
      message: 'Já existe uma espécie com este nome.',
      statusCode: 409,
    });
  });

  it('CT-11: "Reptil" convive com "Réptil" — a unicidade é sensível a acento (RN-05)', async () => {
    // Arrange
    armazem.semear({ name: 'Réptil' });

    // Act
    const criada = await servico.execute(corpoValidado({ name: 'Reptil' }));

    // Assert
    expect(criada.name).toBe('Reptil');
    expect(armazem.linhas).toHaveLength(2);
    expect(armazem.linhas.map((especie) => especie.nameNormalized)).toEqual([
      'réptil',
      'reptil',
    ]);
  });

  it('CT-12 (a): conflito detectado pela consulta prévia recusa antes de tentar gravar', async () => {
    // Arrange — o caso comum: a espécie já está no armazém quando a criação
    // começa, então `findByNameKey` a encontra.
    armazem.semear({ name: 'Gato' });

    const gravar = jest.spyOn(especies, 'create');

    // Act
    const motivo = await servico.execute(corpoValidado({ name: 'Gato' })).catch(
      (erro: unknown) => erro,
    );

    // Assert
    expect(motivo).toBeInstanceOf(SpeciesNameAlreadyExistsError);
    expect(gravar).not.toHaveBeenCalled();
  });

  it('CT-12 (b): conflito vindo do P2002 do repositório produz o MESMO erro da consulta prévia (RN-16)', async () => {
    // Arrange — a corrida: a consulta prévia não encontra nada (o armazém está
    // vazio) e é o índice único que recusa a gravação. Sem a tradução do
    // `P2002`, o perdedor da corrida receberia 500.
    jest.spyOn(especies, 'create').mockRejectedValue(erroDeNomeDuplicado());

    // Act
    const porCorrida = await servico.execute(corpoValidado({ name: 'Gato' })).catch(
      (erro: unknown) => erro,
    );

    jest.restoreAllMocks();
    armazem.semear({ name: 'Gato' });

    const porConsulta = await servico.execute(corpoValidado({ name: 'Gato' })).catch(
      (erro: unknown) => erro,
    );

    // Assert — as duas origens respondem exatamente a mesma coisa: é essa
    // igualdade que a RN-16 exige para que duas criações simultâneas do mesmo
    // nome não produzam respostas diferentes.
    expect(porCorrida).toBeInstanceOf(SpeciesNameAlreadyExistsError);
    expect(porConsulta).toBeInstanceOf(SpeciesNameAlreadyExistsError);
    expect(porCorrida).toMatchObject({
      code: 'SPECIES_NAME_ALREADY_EXISTS',
      message: 'Já existe uma espécie com este nome.',
      statusCode: 409,
    });
    expect(porConsulta).toMatchObject({
      code: 'SPECIES_NAME_ALREADY_EXISTS',
      message: 'Já existe uma espécie com este nome.',
      statusCode: 409,
    });
  });

  it('CT-12: duas criações SIMULTÂNEAS do mesmo nome produzem exatamente uma espécie e um conflito (RNF-03)', async () => {
    // Arrange — a corrida de verdade, sem dublê de erro: as duas execuções
    // atravessam `findByNameKey` antes de qualquer gravação existir, e quem
    // recusa a segunda é a constraint de unicidade reproduzida pelo armazém.
    const entrada = corpoValidado({ name: 'Gato' });

    // Act
    const desfechos = await Promise.allSettled([
      servico.execute(entrada),
      servico.execute(entrada),
    ]);

    // Assert
    const cumpridos = desfechos.filter((desfecho) => desfecho.status === 'fulfilled');
    const rejeitados = desfechos.filter(
      (desfecho): desfecho is PromiseRejectedResult => desfecho.status === 'rejected',
    );

    expect(cumpridos).toHaveLength(1);
    expect(rejeitados).toHaveLength(1);
    expect(rejeitados[0]?.reason).toBeInstanceOf(SpeciesNameAlreadyExistsError);
    expect(armazem.linhas).toHaveLength(1);
  });

  it('erro do Prisma que NÃO é violação de unicidade continua subindo, e não vira 409', async () => {
    // Arrange — `P2028` é um `PrismaClientKnownRequestError` de código ALHEIO
    // (transação estourada no pooler). É ele que discrimina a guarda: um `Error`
    // comum reprova já no `instanceof`, então uma guarda degenerada para
    // `instanceof` puro continuaria passando e uma indisponibilidade de banco
    // sairia para o administrador como "Já existe uma espécie com este nome.".
    const falhaDeInfraestrutura = erroDeTransacaoExpirada();

    jest.spyOn(especies, 'create').mockRejectedValue(falhaDeInfraestrutura);

    // Act
    const desfecho = servico.execute(corpoValidado({ name: 'Gato' }));

    // Assert
    await expect(desfecho).rejects.toBe(falhaDeInfraestrutura);
  });

  it('erro que nem do Prisma é (falha de rede) também continua subindo intacto', async () => {
    // Arrange — o outro lado da guarda: o `instanceof` precisa continuar
    // reprovando o que não vem do Prisma.
    const falhaDeRede = new Error('conexão perdida');

    jest.spyOn(especies, 'create').mockRejectedValue(falhaDeRede);

    // Act
    const desfecho = servico.execute(corpoValidado({ name: 'Gato' }));

    // Assert
    await expect(desfecho).rejects.toBe(falhaDeRede);
  });
});
