import { AnimalSex, AnimalSize, AnimalStatus } from '@prisma/client';

import type { AnimalWithRelations } from '~/domains/animals/repositories/animal.repository';
import { buildPublicObjectUrl } from '~/infra/storage/object-path';
import { calculateAgeInYears } from '~/utils/age';

/**
 * PONTO UNICO de conversao entre a linha de `animals` e o animal do contrato de
 * API. Mesmo papel de `user.mapper.ts` e de `species.mapper.ts`.
 *
 * PROJECAO CAMPO A CAMPO, EXPLICITA. `...animal` e qualquer outra forma de
 * espalhar a entidade sao PROIBIDOS (RN-59, CA-45). Hoje nao existe campo
 * interno no modelo — e e exatamente por isso que a regra nasce agora: quando o
 * numero do chip e o contato do proprietario entrarem, como o escopo aprovado do
 * produto preve, eles nao vazarao por padrao so porque alguem devolveu o objeto
 * inteiro. Campo que nao existe no tipo nao vaza por descuido de serializacao, e
 * nenhum handler precisa lembrar de remove-lo.
 *
 * O que fica DE FORA e nao e esquecimento: `nameNormalized` (chave de ordenacao,
 * detalhe de persistencia), `speciesId` e `cityId` (redundantes com os objetos
 * aninhados), e `storagePath`, `contentType` e `sizeBytes` das imagens (o
 * navegador so precisa da URL).
 */

/**
 * Vocabulario PUBLICO dos conjuntos fechados. O banco guarda em MAIUSCULAS
 * (convencao de enum do Postgres/Prisma) e o contrato trafega em minusculas e
 * sem acento, seguindo o precedente ja em vigor de `role` (`ADMIN` -> `'admin'`).
 * Os rotulos acentuados exibidos ao administrador ("Médio", "Fêmea",
 * "Disponível") sao responsabilidade da interface.
 */
export type PublicAnimalSize = 'pequeno' | 'medio' | 'grande';
export type PublicAnimalSex = 'macho' | 'femea';
export type PublicAnimalStatus = 'disponivel' | 'reservado' | 'adotado' | 'indisponivel';

/**
 * `Record<Enum, Publico>` e nao um `switch`: acrescentar um valor ao enum do
 * schema passa a ser erro de compilacao aqui, em vez de cair num ramo default
 * silencioso que devolveria `undefined` no corpo da resposta. Mesma tecnica de
 * `PAPEL_PUBLICO` em `user.mapper.ts`.
 */
const PORTE_PUBLICO: Readonly<Record<AnimalSize, PublicAnimalSize>> = {
  [AnimalSize.PEQUENO]: 'pequeno',
  [AnimalSize.MEDIO]: 'medio',
  [AnimalSize.GRANDE]: 'grande',
};

const SEXO_PUBLICO: Readonly<Record<AnimalSex, PublicAnimalSex>> = {
  [AnimalSex.MACHO]: 'macho',
  [AnimalSex.FEMEA]: 'femea',
};

const STATUS_PUBLICO: Readonly<Record<AnimalStatus, PublicAnimalStatus>> = {
  [AnimalStatus.DISPONIVEL]: 'disponivel',
  [AnimalStatus.RESERVADO]: 'reservado',
  [AnimalStatus.ADOTADO]: 'adotado',
  [AnimalStatus.INDISPONIVEL]: 'indisponivel',
};

/**
 * Referencia a especie: SO `id` e `name`. Nao e a `PublicSpecies` do dominio de
 * especies (que carrega `createdAt` e `updatedAt`) porque aqui a especie e um
 * atributo do animal, e nao o recurso sendo devolvido — as datas de manutencao
 * do catalogo de especies nao dizem nada sobre este animal.
 */
export interface AnimalSpeciesRef {
  readonly id: string;
  readonly name: string;
}

/**
 * Localizacao do animal. A UF e DERIVADA da cidade (`city.state.uf`), e nao um
 * campo independente que possa divergir dela (RN-28): o par incoerente "Campo
 * Magro - ES" e inexprimivel porque nao ha de onde tira-lo senao do vinculo.
 *
 * `id` fica porque e ele que o formulario de edicao devolve ao gravar; o
 * `ibgeCode` nao entra — e chave de reconciliacao da carga do recorte oficial,
 * sem uso de negocio na tela.
 */
export interface AnimalCityRef {
  readonly id: string;
  readonly name: string;
  readonly stateUf: string;
}

/**
 * Imagem do animal como o navegador precisa dela: identificador, endereco e
 * posicao. `position` 0 e a capa (RN-35).
 *
 * A `url` e DERIVADA de `storage_path` a cada resposta, por
 * `buildPublicObjectUrl` — a coluna guarda o caminho, nao o endereco. Ver aquela
 * funcao para por que a URL nao e persistida.
 */
export interface AnimalImageRef {
  readonly id: string;
  readonly url: string;
  readonly position: number;
}

/**
 * O bloco "Representação do animal" do contrato, campo a campo e na mesma ordem
 * em que a spec o escreve.
 */
export interface AnimalResponse {
  readonly id: string;
  readonly name: string;
  readonly species: AnimalSpeciesRef;
  readonly size: PublicAnimalSize;
  readonly sex: PublicAnimalSex;
  readonly status: PublicAnimalStatus;
  readonly birthDate: string | null;
  readonly ageInYears: number | null;
  readonly description: string | null;
  readonly acceptsOtherAnimals: boolean;
  readonly needsLargeSpace: boolean;
  readonly city: AnimalCityRef;
  readonly images: ReadonlyArray<AnimalImageRef>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * `birth_date` e `@db.Date` e o driver a materializa como a MEIA-NOITE UTC
 * daquele dia, entao os dez primeiros caracteres do ISO sao exatamente
 * `AAAA-MM-DD` — sem conversao de fuso, que e o ponto.
 *
 * Serializar a `Date` inteira (`...T00:00:00.000Z`) faria a interface, a oeste
 * de Greenwich, exibir o DIA ANTERIOR: uma data de nascimento nao tem horario, e
 * dar um a ela e o que produz esse erro. Por isso o corte e explicito aqui, e
 * nao deixado para a serializacao implicita do `res.json`.
 */
const FIM_DA_DATA_CIVIL = 10;

function paraDataCivil(data: Date): string {
  return data.toISOString().slice(0, FIM_DA_DATA_CIVIL);
}

/**
 * Converte a linha lida (com `species`, `city.state` e `images`) na
 * representacao do contrato.
 *
 * O `now` e PARAMETRO e nao `new Date()` interno: a idade e a unica parte da
 * resposta que depende do instante, e injeta-lo e o que permite aos testes fixar
 * o relogio com `jest.spyOn(clock, 'now')` e verificar 3 anos hoje e 4 no
 * aniversario SEM nenhuma escrita no banco entre as duas consultas (CT-18,
 * CT-19, RNF-09).
 */
export function toAnimalResponse(animal: AnimalWithRelations, now: Date): AnimalResponse {
  return {
    id: animal.id,
    name: animal.name,
    species: { id: animal.species.id, name: animal.species.name },
    size: PORTE_PUBLICO[animal.size],
    sex: SEXO_PUBLICO[animal.sex],
    status: STATUS_PUBLICO[animal.status],
    birthDate: animal.birthDate === null ? null : paraDataCivil(animal.birthDate),

    /**
     * SEMPRE calculada, NUNCA lida de coluna (RN-20) — nao existe coluna de
     * idade a ler. `null` quando nao ha data de nascimento, e `null` e diferente
     * de `0` (RN-21): a interface exibe "Idade não informada" no primeiro caso e
     * "0 anos" no segundo, que sao afirmacoes diferentes sobre o animal.
     */
    ageInYears: calculateAgeInYears(animal.birthDate, now),

    description: animal.description,
    acceptsOtherAnimals: animal.acceptsOtherAnimals,
    needsLargeSpace: animal.needsLargeSpace,
    city: {
      id: animal.city.id,
      name: animal.city.name,
      stateUf: animal.city.state.uf,
    },

    /**
     * A ORDEM VEM DO BANCO (`orderBy: { position: 'asc' }` do `include`) e nao
     * de um `sort` aqui: reordenar neste ponto duplicaria a regra da RN-35 num
     * segundo lugar, onde ela poderia divergir do repositorio.
     */
    images: animal.images.map((imagem) => ({
      id: imagem.id,
      url: buildPublicObjectUrl(imagem.storagePath),
      position: imagem.position,
    })),

    createdAt: animal.createdAt.toISOString(),

    /**
     * Serializado porque e o TOKEN DE CONCORRENCIA que a edicao e a alteracao de
     * status exigem de volta no corpo (RN-47, Decisao 9 do changelog). Sem ele
     * na leitura, o formulario nao teria o que devolver e o bloqueio otimista
     * das fatias seguintes ficaria sem entrada.
     */
    updatedAt: animal.updatedAt.toISOString(),
  };
}
