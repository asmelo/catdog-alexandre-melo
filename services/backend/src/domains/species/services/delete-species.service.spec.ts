import type { PrismaClient } from '@prisma/client';
import type { DeepMockProxy } from 'jest-mock-extended';

import {
  SpeciesInUseError,
  SpeciesNotFoundError,
} from '~/domains/species/errors/species.errors';
import { PrismaSpeciesUsageCounter } from '~/domains/species/repositories/species-usage-counter';
import { DeleteSpeciesService } from '~/domains/species/services/delete-species.service';

import { FakeSpeciesUsageCounter } from '../../../../tests/fakes/fake-species-usage-counter';
import {
  ArmazemDeEspecies,
  InMemorySpeciesRepository,
  erroDeRegistroAusente,
  erroDeTransacaoExpirada,
  erroDeVinculoDeAnimal,
} from '../../../../tests/fakes/in-memory-species.repository';
import {
  criarPrismaComTransacao,
  executorDaTransacaoDe,
} from '../../../../tests/fakes/prisma-double';
import { proximoUuid, reiniciarSequenciaDeUuid } from '../../../../tests/fakes/restauravel';

/**
 * HU-05 e HU-06 — exclusao de especie (CT-22, CT-24, CT-25, CT-26, CT-27).
 *
 * ================== O QUE ESTA SOBRE DUBLE, E POR QUE ==================
 *
 * A entidade `Animal` NAO EXISTE. Nao ha tabela `animals`, nao ha chave
 * estrangeira `animals.species_id` e o `@prisma/client` gerado nao exporta o
 * modelo. Isso significa que, hoje, NENHUM dado real e capaz de produzir os dois
 * desfechos centrais desta feature:
 *
 *   - CAMADA 1 da RN-09 (a verificacao da aplicacao): `PrismaSpeciesUsageCounter`
 *     devolve `0` sem tocar o banco. Nao existe estado de banco que a faca
 *     devolver outra coisa. Coberta aqui pelo `FakeSpeciesUsageCounter`, que e
 *     exatamente a porta declarada pelo service.
 *   - CAMADA 2 da RN-09 (a integridade referencial): o `P2003` e literalmente
 *     inalcancavel — nao ha constraint que possa ser violada. Coberta aqui por um
 *     repositorio que rejeita com `PrismaClientKnownRequestError` de codigo
 *     `P2003`, no formato exato que o Prisma produz.
 *
 * A alternativa seria criar a tabela `animals` so para testar, o que anteciparia
 * uma decisao de modelagem da feature seguinte e criaria uma migration orfa.
 * A spec resolve isso de forma explicita: a TASK-010 da feature de Cadastro de
 * pets REEXECUTA CT-24, CT-25, CT-26 e CT-32 contra a tabela e a constraint
 * reais. Ate la, a RN-08 esta verificada apenas por duble — risco residual ja
 * registrado na spec, no changelog e no `TODO` de `species-usage-counter.ts`.
 *
 * O que NAO esta sobre duble: a ordem das verificacoes, o desfecho de cada ramo,
 * o `code` e a mensagem de cada erro, e o fato de o erro ser lancado de DENTRO da
 * transacao. Esses sao codigo de producao rodando de verdade.
 */

/**
 * Nomeia QUAL objeto um colaborador recebeu em `withTransaction(...)`. Fora do
 * corpo do teste de proposito: a asserçao continua sendo uma comparaçao unica, e
 * o que esta funçao acrescenta e a legibilidade da FALHA — dizer "cliente global
 * (FORA da transaçao)" e o que transforma um mutante morto em um diagnostico.
 */
function origemDoExecutor(recebido: unknown, executor: unknown, cliente: unknown): string {
  if (recebido === executor) {
    return 'executor da transação';
  }

  if (recebido === cliente) {
    return 'cliente global (FORA da transação)';
  }

  return 'objeto não identificado';
}

describe('DeleteSpeciesService', () => {
  let armazem: ArmazemDeEspecies;
  let especies: InMemorySpeciesRepository;
  let contador: FakeSpeciesUsageCounter;
  let cliente: DeepMockProxy<PrismaClient>;
  let servico: DeleteSpeciesService;

  beforeEach(() => {
    reiniciarSequenciaDeUuid();

    armazem = new ArmazemDeEspecies();
    especies = new InMemorySpeciesRepository(armazem);
    contador = new FakeSpeciesUsageCounter();
    // O `PrismaClient` entra APENAS para abrir a transação: o dublê registra o
    // estado dos armazéns e o restaura se a callback lançar (CT-25). Ele fica em
    // variável própria porque a RN-09 precisa comparar o executor entregue à
    // callback com ESTE cliente.
    cliente = criarPrismaComTransacao(armazem);
    servico = new DeleteSpeciesService(especies, contador, cliente);
  });

  it('CT-22: espécie sem vínculos é removida definitivamente (RN-10)', async () => {
    // Arrange
    const gato = armazem.semear({ name: 'Gato' });

    armazem.semear({ name: 'Sapo' });

    // Act
    await servico.execute({ id: gato.id });

    // Assert — sem inativação, sem arquivamento e sem lixeira: a linha some.
    expect(armazem.linhas.map((especie) => especie.name)).toEqual(['Sapo']);
    expect(armazem.buscarPorId(gato.id)).toBeNull();
  });

  it('CT-27: excluir espécie inexistente responde "Espécie não encontrada." (RN-14)', async () => {
    // Arrange — identificador bem formado que não corresponde a linha nenhuma.
    const idDeEspecieExcluida = proximoUuid();

    // Act
    const motivo = await servico
      .execute({ id: idDeEspecieExcluida })
      .catch((erro: unknown) => erro);

    // Assert — a RN-14 não distingue "nunca existiu" de "já foi excluída".
    expect(motivo).toBeInstanceOf(SpeciesNotFoundError);
    expect(motivo).toMatchObject({
      code: 'SPECIES_NOT_FOUND',
      message: 'Espécie não encontrada.',
      statusCode: 404,
    });
  });

  it('CT-24 [SOBRE DUBLÊ]: contador em 1 recusa a exclusão com SPECIES_IN_USE (RN-08 / camada 1)', async () => {
    // Arrange — o dublê responde "1 animal vinculado". Não existe estado de
    // banco capaz de produzir isto hoje: a tabela `animals` não existe.
    const gato = armazem.semear({ name: 'Gato' });

    contador.definirContagem(gato.id, 1);

    // Act
    const motivo = await servico.execute({ id: gato.id }).catch((erro: unknown) => erro);

    // Assert — mensagem literal do contrato, comparada caractere a caractere.
    expect(motivo).toBeInstanceOf(SpeciesInUseError);
    expect(motivo).toMatchObject({
      code: 'SPECIES_IN_USE',
      message: 'Não é possível excluir esta espécie porque existem animais vinculados a ela.',
      statusCode: 409,
    });
  });

  it('CT-25 [SOBRE DUBLÊ]: após a exclusão bloqueada, o armazém contém EXATAMENTE os mesmos registros (RNF-02)', async () => {
    // Arrange
    const gato = armazem.semear({ name: 'Gato' });
    const sapo = armazem.semear({ name: 'Sapo' });

    contador.definirContagem(gato.id, 1);

    const antes = [...armazem.linhas];

    // Act
    await servico.execute({ id: gato.id }).catch(() => undefined);

    // Assert — asserção sobre o ESTADO e não sobre a chamada: verificar que
    // `deleteById` não foi chamado provaria menos, porque uma exclusão feita por
    // outro caminho passaria despercebida.
    expect(armazem.linhas).toEqual(antes);
    expect(armazem.buscarPorId(gato.id)).not.toBeNull();
    expect(armazem.buscarPorId(sapo.id)).not.toBeNull();
  });

  it('CT-26 [SOBRE DUBLÊ]: com a contagem de volta a 0, a mesma exclusão é concluída', async () => {
    // Arrange — reproduz a sequência do QA-14: o administrador remove os animais
    // vinculados e tenta de novo.
    const gato = armazem.semear({ name: 'Gato' });

    contador.definirContagem(gato.id, 1);

    await expect(servico.execute({ id: gato.id })).rejects.toBeInstanceOf(SpeciesInUseError);

    // Act
    contador.definirContagem(gato.id, 0);

    await servico.execute({ id: gato.id });

    // Assert
    expect(armazem.linhas).toHaveLength(0);
  });

  it('CT-24 [SOBRE DUBLÊ]: o vínculo de UMA espécie não bloqueia a exclusão de outra', async () => {
    // Arrange — a contagem é por espécie, não um interruptor global.
    const gato = armazem.semear({ name: 'Gato' });
    const sapo = armazem.semear({ name: 'Sapo' });

    contador.definirContagem(gato.id, 3);

    // Act
    await servico.execute({ id: sapo.id });

    // Assert
    expect(armazem.linhas.map((especie) => especie.name)).toEqual(['Gato']);
  });

  it('CA-15 [SOBRE DUBLÊ]: `P2003` do repositório vira SPECIES_IN_USE — o erro do Prisma nunca escapa (RN-09 / camada 2)', async () => {
    // Arrange — a camada 1 AUTORIZA (contador em 0) e quem recusa é a
    // integridade referencial. Hoje este ramo é inalcançável em produção: não há
    // constraint a violar. Ele nasce testado para que, no dia em que a FK
    // restritiva existir e for a única coisa entre o usuário e um animal órfão,
    // a tradução já esteja provada.
    const gato = armazem.semear({ name: 'Gato' });

    jest.spyOn(especies, 'deleteById').mockRejectedValue(erroDeVinculoDeAnimal());

    // Act
    const motivo = await servico.execute({ id: gato.id }).catch((erro: unknown) => erro);

    // Assert — MESMO `code` e MESMA mensagem da camada 1: as duas origens são
    // indistinguíveis para o cliente, nunca um 500.
    expect(motivo).toBeInstanceOf(SpeciesInUseError);
    expect(motivo).toMatchObject({
      code: 'SPECIES_IN_USE',
      message: 'Não é possível excluir esta espécie porque existem animais vinculados a ela.',
      statusCode: 409,
    });
  });

  it('CT-27: `P2025` na escrita (outra sessão excluiu antes) vira 404, e não 500', async () => {
    // Arrange — a corrida que a leitura prévia dentro da transação não fecha.
    const gato = armazem.semear({ name: 'Gato' });

    jest.spyOn(especies, 'deleteById').mockRejectedValue(erroDeRegistroAusente());

    // Act
    const desfecho = servico.execute({ id: gato.id });

    // Assert
    await expect(desfecho).rejects.toBeInstanceOf(SpeciesNotFoundError);
  });

  it('erro do Prisma que não é `P2003` nem `P2025` continua subindo, e não vira 409 ou 404', async () => {
    // Arrange — `P2028` é um `PrismaClientKnownRequestError` de código ALHEIO:
    // a transação estourou o tempo no pooler. É ele, e não um `Error` comum, que
    // discrimina as duas guardas — um `Error` comum reprova já no `instanceof`,
    // então uma guarda degenerada para `instanceof` puro continuaria passando.
    // Mascarar indisponibilidade do banco como "espécie em uso" daria ao
    // administrador uma explicação de negócio para uma falha de infraestrutura.
    const gato = armazem.semear({ name: 'Gato' });
    const falhaDeInfraestrutura = erroDeTransacaoExpirada();

    jest.spyOn(especies, 'deleteById').mockRejectedValue(falhaDeInfraestrutura);

    // Act
    const desfecho = servico.execute({ id: gato.id });

    // Assert
    await expect(desfecho).rejects.toBe(falhaDeInfraestrutura);
  });

  it('erro que nem do Prisma é (falha de rede) também continua subindo intacto', async () => {
    // Arrange — o outro lado da guarda: o `instanceof` precisa continuar
    // reprovando o que não vem do Prisma.
    const gato = armazem.semear({ name: 'Gato' });
    const falhaDeRede = new Error('conexão perdida');

    jest.spyOn(especies, 'deleteById').mockRejectedValue(falhaDeRede);

    // Act
    const desfecho = servico.execute({ id: gato.id });

    // Assert
    await expect(desfecho).rejects.toBe(falhaDeRede);
  });

  it('CT-25: o erro é lançado de DENTRO da transação, que faz rollback do que houvesse sido escrito', async () => {
    // Arrange — o `criarPrismaComTransacao` captura o estado do armazém antes da
    // callback e o restaura quando ela lança. Para observar o rollback de fato,
    // a exclusão é feita e SÓ DEPOIS o vínculo aparece: é o efeito da escrita
    // dentro da transação abortada que precisa desaparecer.
    const gato = armazem.semear({ name: 'Gato' });

    jest.spyOn(especies, 'deleteById').mockImplementation(async (id: string) => {
      armazem.remover(id);

      throw erroDeVinculoDeAnimal();
    });

    // Act
    const motivo = await servico.execute({ id: gato.id }).catch((erro: unknown) => erro);

    // Assert — a linha voltou: quando a resposta é 409, nada foi confirmado.
    expect(motivo).toBeInstanceOf(SpeciesInUseError);
    expect(armazem.buscarPorId(gato.id)).not.toBeNull();
  });

  it('RN-09: a contagem e a exclusão rodam com o MESMO executor da transação aberta pelo service', async () => {
    // Arrange — a atomicidade exigida pela RN-09 depende de os dois
    // colaboradores serem rebindados por `withTransaction(tx)`. Um repositório
    // construído com o cliente global executaria FORA da transação e a
    // atomicidade seria só aparente.
    //
    // Contar as chamadas NÃO prova isso: `withTransaction(this.prisma)` também
    // é chamado exatamente uma vez. O que discrimina é a IDENTIDADE do
    // argumento, e ela só existe porque o dublê entrega à callback um executor
    // distinto do cliente — como o Prisma real faz.
    const gato = armazem.semear({ name: 'Gato' });
    const executor = executorDaTransacaoDe(cliente);

    const repositorioNaTransacao = jest.spyOn(especies, 'withTransaction');
    const contadorNaTransacao = jest.spyOn(contador, 'withTransaction');

    // Act
    await servico.execute({ id: gato.id });

    // Assert — a premissa primeiro: sem dois objetos distintos, nenhuma das
    // asserções abaixo conseguiria reprovar a ligação ao cliente global.
    expect(executor).not.toBe(cliente);
    expect(repositorioNaTransacao).toHaveBeenCalledTimes(1);
    expect(contadorNaTransacao).toHaveBeenCalledTimes(1);
    // Comparados por NOME e não por `toBe`: os dois candidatos são proxies do
    // `mockDeep`, que o Jest imprime como `undefined` — uma falha diria
    // "esperado undefined, recebido undefined" e não ajudaria ninguém. Assim a
    // mensagem nomeia o defeito: "cliente global (FORA da transação)".
    expect({
      repositorio: origemDoExecutor(repositorioNaTransacao.mock.calls[0]?.[0], executor, cliente),
      contador: origemDoExecutor(contadorNaTransacao.mock.calls[0]?.[0], executor, cliente),
    }).toEqual({
      repositorio: 'executor da transação',
      contador: 'executor da transação',
    });
  });
});

/**
 * A implementacao PROVISORIA da contagem. Ela e o colaborador que hoje mantem a
 * RN-08 desarmada em producao, e o teste existe para fixar por escrito o
 * comportamento que a feature seguinte vai substituir — de modo que a troca
 * apareca como FALHA aqui, e nao como uma mudanca silenciosa.
 */
describe('PrismaSpeciesUsageCounter (implementação provisória)', () => {
  it('RN-08: responde 0 para qualquer espécie, sem emitir consulta ao banco', async () => {
    // Arrange — a tabela `animals` não existe; qualquer `SELECT` sobre ela
    // derrubaria a exclusão de espécie, que hoje é operação legítima.
    const cliente = criarPrismaComTransacao();
    const contagem = new PrismaSpeciesUsageCounter(cliente);

    // Act
    const vinculados = await contagem.countAnimalsBySpecies(proximoUuid());

    // Assert
    expect(vinculados).toBe(0);
  });

  it('RN-09: `withTransaction` devolve uma instância NOVA, ligada ao executor recebido', async () => {
    // Arrange — devolver `this` seria a armadilha: a contagem real da feature
    // seguinte passaria a rodar FORA da transação do service sem que nada
    // precisasse mudar, e a atomicidade da RN-09 seria só aparente.
    const cliente = criarPrismaComTransacao();
    const contagem = new PrismaSpeciesUsageCounter(cliente);

    // Act
    const naTransacao = contagem.withTransaction(cliente);

    // Assert
    expect(naTransacao).toBeInstanceOf(PrismaSpeciesUsageCounter);
    expect(naTransacao).not.toBe(contagem);
    await expect(naTransacao.countAnimalsBySpecies(proximoUuid())).resolves.toBe(0);
  });
});
