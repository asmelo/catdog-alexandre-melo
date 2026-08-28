/**
 * O duble entra pelo MODULO do cliente, e nao por import direto de
 * `../fakes/prisma-double`: e assim que o repositorio o recebe tipado como
 * `PrismaClient`. Importada direto, a classe do duble nao satisfaz
 * `Prisma.TransactionClient` (faltam os quatro metodos de SQL cru, que ela nao
 * precisa dublar porque o projeto nao os usa) e `withTransaction` nao aceitaria
 * o argumento.
 */
jest.mock('~/infra/prisma/prisma-client', () =>
  jest.requireActual<typeof import('../fakes/prisma-double')>('../fakes/prisma-double'),
);

import { PrismaAnimalRepository } from '~/domains/animals/repositories/animal.repository';
import { prisma } from '~/infra/prisma/prisma-client';

import {
  armazemDeAnimais,
  armazemDeEspecies,
  armazemDeGeografia,
  reiniciarPrismaDouble,
} from '../fakes/prisma-double';

/**
 * `PrismaAnimalRepository.listPaginated` DENTRO de uma transacao ja aberta
 * (TASK-BACKEND-011).
 *
 * ===================== POR QUE ESTE SPEC EXISTE =====================
 *
 * O repositorio tem DOIS caminhos para a listagem, e a diferenca entre eles nao e
 * cosmetica:
 *
 * - Com `lote` (o caminho da rota): as duas consultas — a pagina e o total —
 *   correm num `$transaction([...])`, para que o total nao possa ser contado
 *   sobre um estado diferente do que produziu os itens.
 * - Sem `lote` (o caminho de quem ja esta dentro de uma transacao aberta, isto e,
 *   o repositorio devolvido por `withTransaction`): as duas consultas correm
 *   direto, porque pedir um lote ali seria abrir transacao dentro de transacao.
 *
 * O segundo caminho NAO e alcancavel pela suite de integracao: nenhum service
 * chama `listPaginated` de dentro de uma transacao hoje. Ele existe porque
 * `withTransaction` devolve o MESMO tipo de repositorio, com a interface inteira,
 * e um metodo dessa interface que quebrasse ali so apareceria quando a primeira
 * leitura paginada transacional fosse escrita — provavelmente pela feature de
 * vitrine, e provavelmente como um erro do Postgres difícil de ler.
 */

describe('PrismaAnimalRepository.listPaginated dentro de transação aberta', () => {
  beforeEach(() => {
    reiniciarPrismaDouble();
  });

  function semearTresAnimais(): void {
    const especie = armazemDeEspecies.semear({ name: 'Cachorro' });
    const estado = armazemDeGeografia.semearEstado({ uf: 'ES', name: 'Espírito Santo' });
    const cidade = armazemDeGeografia.semearCidade({
      stateId: estado.id,
      name: 'Boa Esperança',
    });

    for (const nome of ['Amora', 'Bidu', 'Cacau']) {
      armazemDeAnimais.semear({
        name: nome,
        nameNormalized: nome.toLowerCase(),
        speciesId: especie.id,
        cityId: cidade.id,
      });
    }
  }

  it('sem lote, devolve a mesma página e o mesmo total que o caminho com lote', async () => {
    // Arrange — `withTransaction` devolve o repositório SEM lote, que é o objeto
    // sob teste. O de cima, com lote, serve de referência: os dois têm de
    // concordar, senão a leitura mudaria de resultado só por estar numa transação.
    semearTresAnimais();

    const comLote = new PrismaAnimalRepository(prisma, prisma);
    const semLote = comLote.withTransaction(prisma);

    // Act
    const pagina = await semLote.listPaginated({ skip: 0, take: 2 });
    const referencia = await comLote.listPaginated({ skip: 0, take: 2 });

    // Assert
    expect(pagina.items.map((animal) => animal.name)).toEqual(['Amora', 'Bidu']);
    expect(pagina.total).toBe(3);
    expect(pagina).toEqual(referencia);
  });

  it('sem lote, NÃO abre uma transação aninhada', async () => {
    // Arrange
    semearTresAnimais();

    const semLote = new PrismaAnimalRepository(prisma, prisma).withTransaction(prisma);
    const abrirTransacao = jest.spyOn(prisma, '$transaction');

    // Act
    await semLote.listPaginated({ skip: 0, take: 10 });

    // Assert — é esta a razão de o ramo existir. Um `$transaction` aqui estaria
    // aninhado no que o chamador já abriu.
    expect(abrirTransacao).not.toHaveBeenCalled();
  });

  it('a segunda página não repete nem omite registro', async () => {
    // Arrange
    semearTresAnimais();

    const semLote = new PrismaAnimalRepository(prisma, prisma).withTransaction(prisma);

    // Act
    const segunda = await semLote.listPaginated({ skip: 2, take: 2 });

    // Assert
    expect(segunda.items.map((animal) => animal.name)).toEqual(['Cacau']);
    expect(segunda.total).toBe(3);
  });
});
