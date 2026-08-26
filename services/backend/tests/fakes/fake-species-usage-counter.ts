import type { Prisma } from '@prisma/client';

import type { SpeciesUsageCounter } from '~/domains/species/repositories/species-usage-counter';

import { comoPromessa } from './restauravel';

/**
 * Duble CONTROLAVEL da contagem de animais vinculados a uma especie.
 *
 * E este arquivo que materializa a decisao registrada na spec ("Como a RN-08 e
 * verificada antes de a entidade Animal existir"): a implementacao de producao
 * (`PrismaSpeciesUsageCounter`) responde `0` sem tocar o banco, porque a tabela
 * `animals` nao existe. Sem um duble que responda diferente de zero, a regra
 * mais importante da feature — especie em uso nao pode ser excluida — nasceria
 * sem nenhum teste e so seria exercitada meses depois, pela feature seguinte.
 *
 * ELE NAO E DESCARTAVEL DEPOIS DA FEATURE DE ANIMAIS. Quando a contagem passar a
 * consultar a tabela real, este duble continua sendo a forma barata de montar os
 * cenarios de contagem que nao se quer construir com dados reais: "9999 animais
 * vinculados", "a contagem caiu para zero entre duas chamadas", "a contagem
 * falhou". Montar cada um deles inserindo animais de verdade acoplaria os testes
 * de exclusao de ESPECIE as regras de cadastro de ANIMAL, que sao de outro caso
 * de uso e mudam por outros motivos.
 */

/** Unico valor que autoriza a exclusao (RN-08). */
const SEM_VINCULO = 0;

export class FakeSpeciesUsageCounter implements SpeciesUsageCounter {
  private readonly contagens = new Map<string, number>();

  /**
   * Define quantos animais o duble deve reportar para `speciesId`. Por especie e
   * nao um valor global: os cenarios de CT-24 e CT-26 precisam de uma especie em
   * uso convivendo com outra livre no mesmo armazem.
   */
  definirContagem(speciesId: string, quantidade: number): void {
    this.contagens.set(speciesId, quantidade);
  }

  /** Chamado entre testes para que a contagem nao dependa do que rodou antes. */
  limpar(): void {
    this.contagens.clear();
  }

  /**
   * Default `0`, igual ao da implementacao de producao: uma especie sobre a qual
   * o teste nao disse nada e uma especie SEM vinculo, e a exclusao dela deve
   * concluir. Devolver outro default faria todo cenario de sucesso precisar de
   * configuracao previa e um esquecimento viraria falha sem relacao com a regra.
   */
  countAnimalsBySpecies(speciesId: string): Promise<number> {
    return comoPromessa(() => this.contagens.get(speciesId) ?? SEM_VINCULO);
  }

  /**
   * Devolve `this`, ignorando o executor: no duble nao existem duas conexoes e a
   * contagem definida precisa continuar valendo dentro da transacao aberta pelo
   * `delete-species.service.ts`. `PrismaSpeciesUsageCounter` devolve instancia
   * nova de proposito (para que a contagem real rode DENTRO da transacao), e
   * imitar isso aqui apagaria a configuracao do teste no exato ponto em que ela
   * precisa valer.
   *
   * O PARAMETRO E DECLARADO ainda que ignorado (prefixo `_` porque o
   * `noUnusedParameters` do tsconfig reprovaria um parametro sem uso): e ele que
   * faz um `jest.spyOn` sobre este metodo REGISTRAR qual executor o service
   * passou, e e essa identidade que torna a RN-09 observavel — sem o parametro,
   * o spy so conseguiria contar chamadas.
   */
  withTransaction(_executor: Prisma.TransactionClient): SpeciesUsageCounter {
    return this;
  }
}

/**
 * Instancia COMPARTILHADA da suite de integracao HTTP.
 *
 * Existe porque o grafo de composicao e montado no import de
 * `species.routes.ts`, antes de qualquer `beforeEach`: o teste precisa de um
 * ponto estavel para configurar a contagem depois que o controller ja foi
 * construido. Os specs unitarios NAO a usam — cada um instancia a sua propria
 * copia, que e o que mantem os testes independentes de ordem.
 */
export const contadorDeUsoDeEspecies = new FakeSpeciesUsageCounter();
