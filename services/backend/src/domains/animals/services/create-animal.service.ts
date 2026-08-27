import { randomUUID } from 'node:crypto';

import { AnimalSex, AnimalSize, type PrismaClient } from '@prisma/client';

import { animalNameKey } from '~/domains/animals/animal-name';
import { CityNotFoundError } from '~/domains/animals/errors/animal.errors';
import { AnimalImageLimitExceededError } from '~/domains/animals/errors/animal-image.errors';
import {
  toAnimalResponse,
  type AnimalResponse,
  type PublicAnimalSex,
  type PublicAnimalSize,
} from '~/domains/animals/mappers/animal.mapper';
import type {
  AnimalRepository,
  AnimalWithRelations,
  CreateAnimalImageData,
} from '~/domains/animals/repositories/animal.repository';
import type {
  AnimalImageUpload,
  StoreAnimalImagesService,
  StoredAnimalImage,
} from '~/domains/animals/services/store-animal-images.service';
import type { StateRepository } from '~/domains/geography/repositories/state.repository';
import type { SpeciesRepository } from '~/domains/species/repositories/species.repository';
import { SpeciesNotFoundError } from '~/domains/species/errors/species.errors';
import { MAX_IMAGES_PER_ANIMAL } from '~/infra/upload/upload-limits';
import { now } from '~/utils/clock';

/**
 * HU — cadastro de animal com ate cinco imagens (RN-39).
 *
 * O ponto que governa o desenho e a atomicidade: ou o animal e as suas imagens
 * sao gravados, ou nada e gravado — e "nada" inclui o ARMAZENAMENTO, que nao
 * participa da transacao do banco e por isso exige compensacao explicita.
 *
 * A diferenca estrutural em relacao a `register-user.service.ts`, que e o padrao
 * de service com efeito externo deste projeto, e o SENTIDO do efeito: la o e-mail
 * pode falhar sem derrubar o caso de uso (o usuario usa o reenvio); aqui o envio
 * das imagens DERRUBA o cadastro e precisa ser desfeito.
 */

/**
 * Pedido do administrador, JA validado e JA normalizado por
 * `createAnimalBodySchema`: o nome vem aparado e com espacos colapsados, os
 * identificadores tem forma de UUID, `birthDate` e a data civil em UTC ou `null`
 * e as duas alternancias sao booleanos de verdade. O service NAO revalida — uma
 * segunda copia das regras aqui divergiria da primeira.
 *
 * `status` nao existe nesta forma: o animal nasce Disponivel pelo default do
 * schema (RN-14).
 *
 * `stateId` tampouco, e por uma razao mais forte (RN-26a, RN-28, CA-17): o estado
 * do animal e o estado da sua cidade. O par incoerente "Campo Magro - ES" nao e
 * validado — e INEXPRIMIVEL no contrato.
 */
export interface CreateAnimalInput {
  readonly name: string;
  readonly speciesId: string;
  readonly cityId: string;
  readonly size: PublicAnimalSize;
  readonly sex: PublicAnimalSex;
  readonly birthDate: Date | null;
  readonly description: string | null;
  readonly acceptsOtherAnimals: boolean;
  readonly needsLargeSpace: boolean;
  readonly images: ReadonlyArray<AnimalImageUpload>;
}

/**
 * Traducao do vocabulario PUBLICO (minusculo, sem acento, do contrato de API)
 * para o literal do enum do banco (maiusculo).
 *
 * `Record<Publico, Enum>` e nao um `switch`: acrescentar um valor ao vocabulario
 * publico passa a ser erro de compilacao aqui, em vez de cair num ramo default
 * silencioso. E a operacao INVERSA do `PORTE_PUBLICO`/`SEXO_PUBLICO` do mapper —
 * cada uma no seu sentido, nenhuma das duas reimplementando a outra.
 *
 * EXPORTADOS desde a TASK-BACKEND-008: a edicao grava as mesmas colunas a partir
 * do mesmo vocabulario publico e importa estes dois mapas em vez de redeclara-los.
 * Duas copias divergiriam no dia em que um porte fosse acrescentado, e o cadastro
 * passaria a aceitar um valor que a edicao recusa.
 */
export const PORTE_PERSISTIDO: Readonly<Record<PublicAnimalSize, AnimalSize>> = {
  pequeno: AnimalSize.PEQUENO,
  medio: AnimalSize.MEDIO,
  grande: AnimalSize.GRANDE,
};

export const SEXO_PERSISTIDO: Readonly<Record<PublicAnimalSex, AnimalSex>> = {
  macho: AnimalSex.MACHO,
  femea: AnimalSex.FEMEA,
};

/**
 * `position` base ZERO, na ordem de envio: a primeira imagem e a capa (RN-35).
 */
function comoLinhasDeImagem(
  gravadas: ReadonlyArray<StoredAnimalImage>,
): ReadonlyArray<CreateAnimalImageData> {
  return gravadas.map((imagem, posicao) => ({
    id: imagem.imageId,
    storagePath: imagem.objectPath,
    position: posicao,
    contentType: imagem.contentType,
    sizeBytes: imagem.sizeBytes,
  }));
}

export class CreateAnimalService {
  constructor(
    private readonly animals: AnimalRepository,
    private readonly species: SpeciesRepository,
    private readonly geography: StateRepository,
    private readonly images: StoreAnimalImagesService,
    private readonly prisma: PrismaClient,
  ) {}

  /**
   * A ORDEM DOS PASSOS E CONTRATO, e cada um esta onde esta por uma razao:
   *
   * 1. QUANTIDADE de imagens. E a unica recusa que nao depende de nenhuma ida a
   *    rede — barra-la primeiro evita ler seis arquivos do buffer e consultar o
   *    banco duas vezes para responder o que ja se sabia (RN-50, CT-47).
   * 2. ESPECIE e 3. CIDADE, ANTES de tocar no armazenamento. Falhar depois do
   *    envio significaria compensar objetos que nunca precisariam ter subido — e
   *    a compensacao e a operacao mais cara e mais fragil do caso de uso.
   * 4. VALIDACAO E ENVIO das imagens, fora da transacao: elas custam ate 20 s por
   *    objeto, e uma transacao aberta durante isso seguraria a conexao do pooler.
   * 5. GRAVACAO em UMA transacao.
   * 6. COMPENSACAO se a transacao falhar depois de os objetos ja terem subido.
   *
   * O identificador do animal e sorteado AQUI, antes de tudo, porque o caminho de
   * cada objeto e `animals/<id>/<uuid>.<ext>` (RN-52): sem ele, as imagens nao
   * teriam onde ser gravadas antes da transacao.
   */
  async execute(entrada: CreateAnimalInput): Promise<AnimalResponse> {
    /**
     * O limite vale sobre o ESTADO FINAL do animal (RN-50). No cadastro o estado
     * final E o proprio envio, porque o animal ainda nao existe e nao ha imagem
     * gravada a somar — e na edicao a mesma regra soma as mantidas com as novas
     * (TASK-BACKEND-008). A comparacao e a mesma; o que muda e a parcela.
     *
     * O middleware de multipart aceita a SEXTA imagem de proposito (o parser corta
     * so na setima) justamente para que a recusa saia daqui, com `code` e
     * mensagem de negocio em PT-BR, e nao como erro generico do parser.
     */
    if (entrada.images.length > MAX_IMAGES_PER_ANIMAL) {
      throw new AnimalImageLimitExceededError();
    }

    await this.exigirEspecie(entrada.speciesId);
    await this.exigirCidade(entrada.cityId);

    const animalId = randomUUID();

    const gravadas = await this.images.execute(animalId, entrada.images);

    const animal = await this.persistir(animalId, entrada, gravadas).catch(
      async (motivo: unknown) => {
        /**
         * RN-39 — o banco desfaz a transacao sozinho; o armazenamento nao. Sem
         * esta linha, uma falha do `INSERT` (uma especie excluida entre a leitura
         * e a gravacao, por exemplo) deixaria ate cinco objetos no balde sem
         * nenhum animal que os referencie — invisiveis para qualquer limpeza
         * futura, que so sabe procurar pelo prefixo de um animal existente.
         */
        await this.images.compensar(
          gravadas.map((imagem) => imagem.objectPath),
          'envioDesfeito',
        );

        throw motivo;
      },
    );

    /**
     * A MESMA projecao da leitura, e nao uma serializacao propria do cadastro:
     * duas montagens da representacao do animal divergiriam na primeira mudanca
     * de contrato, e a resposta do `POST` deixaria de ser identica a do `GET`.
     */
    return toAnimalResponse(animal, now());
  }

  /**
   * RN-08 — o `null` do repositorio vira erro de dominio AQUI e nao la: a porta
   * de persistencia nunca lanca erro HTTP.
   *
   * Reusa o `SpeciesNotFoundError` da FEATURE-001 deste modulo, com o mesmo
   * `code` e a mesma mensagem: uma especie inexistente responde o mesmo, venha a
   * pergunta da tela de especies ou do cadastro de animal (CT-10).
   */
  private async exigirEspecie(speciesId: string): Promise<void> {
    if ((await this.species.findById(speciesId)) === null) {
      throw new SpeciesNotFoundError();
    }
  }

  /**
   * RN-26 — a cidade e resolvida por `id`, JAMAIS por nome: nome de municipio se
   * repete entre unidades federativas, e uma busca por nome gravaria o animal na
   * UF errada em silencio (CT-11).
   *
   * O estado nao e consultado nem gravado (RN-26a): ele e o estado desta cidade, e
   * a leitura o deriva pelo proprio vinculo.
   */
  private async exigirCidade(cityId: string): Promise<void> {
    if ((await this.geography.findCityById(cityId)) === null) {
      throw new CityNotFoundError();
    }
  }

  /**
   * Animal e imagens na MESMA transacao (RN-39): um animal gravado sem as suas
   * imagens seria um cadastro que a tela exibe incompleto e que ninguem pediu, e
   * linhas de imagem sem animal nao existiriam por causa da chave estrangeira.
   *
   * As linhas de imagem sao devolvidas por `createImages` e ANEXADAS ao animal em
   * vez de relidas: o `create` acabou de nascer com `images: []` — ele foi gravado
   * antes delas — e uma releitura dentro da transacao seria uma terceira ida ao
   * banco para montar um objeto cujas duas metades ja estao em memoria. A ordem
   * devolvida e a de `position`, que e a mesma que o `include` da leitura produz.
   */
  private async persistir(
    animalId: string,
    entrada: CreateAnimalInput,
    gravadas: ReadonlyArray<StoredAnimalImage>,
  ): Promise<AnimalWithRelations> {
    return this.prisma.$transaction(
      async (tx) => {
        const repositorio = this.animals.withTransaction(tx);

        const animal = await repositorio.create({
          id: animalId,
          name: entrada.name,

          /**
           * DERIVADO AQUI, na escrita, e nunca recebido do cliente (RN-41): e uma
           * chave de ordenacao, detalhe de persistencia que nao aparece no
           * contrato de API. Minusculo e COM os acentos preservados — ver
           * `animal-name.ts` para por que nao ha remocao de diacritico. Nao e
           * `@unique`: dois animais podem se chamar "Theo" (RN-05, CT-08).
           */
          nameNormalized: animalNameKey(entrada.name),

          speciesId: entrada.speciesId,
          cityId: entrada.cityId,
          size: PORTE_PERSISTIDO[entrada.size],
          sex: SEXO_PERSISTIDO[entrada.sex],
          birthDate: entrada.birthDate,
          description: entrada.description,
          acceptsOtherAnimals: entrada.acceptsOtherAnimals,
          needsLargeSpace: entrada.needsLargeSpace,
        });

        const imagens = await repositorio.createImages(
          animal.id,
          comoLinhasDeImagem(gravadas),
        );

        /**
         * ORDENADO AQUI, e nao herdado do retorno do `INSERT`.
         *
         * A spec fixa "`images` vem sempre ordenado por `position`", e no caminho
         * de LEITURA quem garante isso e o `orderBy: { position: 'asc' }` do
         * `include` do repositorio. Este caminho NAO passa por aquele `include`:
         * as linhas vem do `RETURNING` do `createManyAndReturn`, cuja ordem o
         * padrao SQL nao promete — o Postgres devolve na ordem de insercao na
         * pratica, mas isso e comportamento observado, nao contrato.
         *
         * Ordenar no maximo cinco itens custa nada e faz as duas respostas —
         * `POST` e `GET` — chegarem ordenadas pela mesma regra em vez de uma
         * delas depender do motor. NAO e a duplicacao que o comentario do mapper
         * desaconselha: la a ordem ja veio ordenada do banco; aqui ela nunca foi
         * pedida a ele.
         */
        const ordenadas = [...imagens].sort((uma, outra) => uma.position - outra.position);

        return { ...animal, images: ordenadas };
      },
      {
        /**
         * Mesmos prazos de `register-user.service.ts`, pela mesma razao: o
         * `DATABASE_URL` desta aplicacao usa o pooler do Supabase com
         * `connection_limit=1`, entao transacoes concorrentes se enfileiram por
         * UMA conexao e o `maxWait` default de 2 s do Prisma faz um cadastro
         * legitimo virar `P2028` (500) sob concorrencia modesta.
         *
         * A transacao aqui e CURTA de proposito — dois `INSERT`, sem nenhuma ida a
         * rede externa dentro dela: as imagens ja subiram antes, justamente para
         * que ate 20 s por objeto nao contem contra estes prazos.
         */
        maxWait: 10000,
        timeout: 15000,
      },
    );
  }
}
