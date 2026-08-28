import type { Request } from 'express';

import { AnimalsController } from '~/domains/animals/animals.controller';
import { HTTP_STATUS } from '~/shared/http/http-status';

import { montarBancada, type BancadaDeAnimais } from '../../../tests/fakes/bancada-de-animais';

/**
 * Traducao de transporte do controller de animais (TASK-BACKEND-011).
 *
 * ========================= O QUE ESTE SPEC COBRE =========================
 *
 * NAO e o contrato HTTP — esse e o assunto de `tests/integration/animals-routes.spec.ts`,
 * que sobe o `app` inteiro com supertest e verifica status, `code` e `message`.
 * Aqui fica o UNICO ponto do controller que a suite de integracao nao alcanca por
 * construcao: o ramo em que `req.files` NAO e um array.
 *
 * Por que ele nao e alcancavel por HTTP: as duas rotas que chamam este handler
 * montam o `uploadAnimalImages`, e o multer, configurado com `.array()`, SEMPRE
 * deixa `req.files` como array — vazio quando o formulario nao trouxe arquivo
 * nenhum. Nao existe requisicao que chegue ao handler com `undefined` ali.
 *
 * O ramo continua sendo necessario, e nao e codigo morto: o tipo de `req.files`
 * do `@types/multer` e a uniao entre o array de `.array()`, o mapa por campo de
 * `.fields()` e `undefined`. Se alguem trocar `.array()` por `.fields()` — ou
 * montar o controller numa rota sem o leitor de multipart —, e este ramo que faz
 * a diferenca entre "cadastro sem imagem" e um `TypeError` em producao. Deixa-lo
 * sem teste seria deixar sem rede justamente a linha escrita para o dia em que a
 * montagem mudar.
 */

/**
 * Os tres parametros do handler, tirados da PROPRIA assinatura em vez de
 * remontados a mao com `Request`/`Response` genericos. Sob
 * `exactOptionalPropertyTypes`, um `Request` generico nao e atribuivel ao
 * `Request<SemParametros, AnimalResponse, CreateAnimalBody>` que o handler
 * declara, e escrever os generics de novo aqui duplicaria — e deixaria envelhecer
 * — uma definicao que ja existe no controller.
 */
type RequisicaoDeCriacao = Parameters<AnimalsController['create']>[0];
type RespostaDeCriacao = Parameters<AnimalsController['create']>[1];

describe('AnimalsController.create — leitura dos arquivos enviados', () => {
  let bancada: BancadaDeAnimais;
  let controller: AnimalsController;

  beforeEach(() => {
    bancada = montarBancada();
    controller = new AnimalsController({
      listAnimals: bancada.listAnimals,
      getAnimal: bancada.getAnimal,
      createAnimal: bancada.createAnimal,
      updateAnimal: bancada.updateAnimal,
      changeAnimalStatus: bancada.changeAnimalStatus,
      deleteAnimal: bancada.deleteAnimal,
    });
  });

  /**
   * Duble de `Response` reduzido ao que o handler usa: `status` encadeavel e
   * `json`. Um mock profundo do Express traria dezenas de membros que o teste nao
   * exercita e esconderia qual e, de fato, a superficie consumida.
   */
  function respostaEspiada(): {
    readonly resposta: RespostaDeCriacao;
    readonly status: jest.Mock;
    readonly json: jest.Mock;
  } {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });

    return { resposta: { status } as unknown as RespostaDeCriacao, status, json };
  }

  function requisicaoDeCadastro(arquivos: Request['files']): RequisicaoDeCriacao {
    const corpo = {
      name: 'Theo',
      speciesId: bancada.especie.id,
      cityId: bancada.cidade.id,
      size: 'grande',
      sex: 'macho',
      acceptsOtherAnimals: false,
      needsLargeSpace: false,
    };

    return { body: corpo, files: arquivos } as unknown as RequisicaoDeCriacao;
  }

  it('sem `req.files` (o leitor de multipart não montado), cadastra o animal SEM imagem em vez de quebrar', async () => {
    // Arrange
    const { resposta, status, json } = respostaEspiada();

    // Act — `files` ausente é exatamente o que o `@types/multer` admite e o que
    // uma montagem sem `uploadAnimalImages` produziria.
    await controller.create(requisicaoDeCadastro(undefined), resposta, jest.fn());

    // Assert — o cadastro sem imagem é válido (RN-30), então o desfecho correto
    // é 201 com a lista de imagens vazia, e não um erro.
    expect(status).toHaveBeenCalledWith(HTTP_STATUS.CREATED);
    expect(json).toHaveBeenCalledTimes(1);

    expect(bancada.animais.linhas).toHaveLength(1);
    expect(bancada.animais.linhasDeImagem).toHaveLength(0);
    expect(bancada.armazenamento.storedPaths).toHaveLength(0);
  });

  it('com `req.files` no formato de mapa por campo, também cadastra sem imagem', async () => {
    // Arrange — a outra metade da união de tipos: o formato que `.fields()`
    // produz. Não é array, e por isso segue o mesmo ramo.
    const { resposta, status } = respostaEspiada();
    const porCampo = { images: [] } as unknown as Request['files'];

    // Act
    await controller.create(requisicaoDeCadastro(porCampo), resposta, jest.fn());

    // Assert
    expect(status).toHaveBeenCalledWith(HTTP_STATUS.CREATED);
    expect(bancada.animais.linhasDeImagem).toHaveLength(0);
  });
});
