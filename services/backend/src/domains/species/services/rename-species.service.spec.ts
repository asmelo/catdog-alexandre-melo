import {
  SpeciesNameAlreadyExistsError,
  SpeciesNotFoundError,
} from '~/domains/species/errors/species.errors';
import { RenameSpeciesService } from '~/domains/species/services/rename-species.service';
import { renameSpeciesSchema, speciesIdParamSchema } from '~/domains/species/species.validators';

import {
  ArmazemDeEspecies,
  InMemorySpeciesRepository,
  erroDeNomeDuplicado,
  erroDeRegistroAusente,
  erroDeTransacaoExpirada,
} from '../../../../tests/fakes/in-memory-species.repository';
import { proximoUuid, reiniciarSequenciaDeUuid } from '../../../../tests/fakes/restauravel';

/**
 * HU-04 — renomeacao de especie (CT-16 a CT-20).
 *
 * O `renameSpeciesSchema` REUSA o `speciesNameSchema` da criacao, entao os
 * limites da RN-02 e a precedencia entre as mensagens ja estao cobertos em
 * `create-species.service.spec.ts`. Aqui o schema aparece so no CT-19 (para
 * fixar que a renomeacao recusa o campo vazio com a MESMA mensagem do `POST`) e
 * no CT-34 do parametro de caminho. O resto e regra do caso de uso: a ordem
 * entre "nao encontrada" e "conflito", o desvio da RN-07 e a estabilidade do id.
 */

function nomeValidado(bruto: unknown): string {
  const resultado = renameSpeciesSchema.safeParse(bruto);

  if (!resultado.success) {
    throw new Error(
      `Entrada rejeitada pelo schema: ${resultado.error.issues.map((i) => i.message).join(' | ')}`,
    );
  }

  return resultado.data.name;
}

describe('renameSpeciesSchema e speciesIdParamSchema (fronteira de validação da renomeação)', () => {
  it('CT-19: campo vazio na renomeação é recusado com a MESMA mensagem do POST', () => {
    // Arrange & Act
    const resultado = renameSpeciesSchema.safeParse({ name: '' });

    // Assert — o contrato exige "as mesmas mensagens por campo do POST"; uma
    // segunda declaração das regras de tamanho divergiria na primeira alteração.
    expect(resultado.success).toBe(false);
    expect(resultado.success ? [] : resultado.error.issues.map((problema) => problema.message))
      .toEqual(['Este campo é obrigatório.']);
  });

  it('CT-34: identificador fora do formato UUID é recusado apontando o campo `id`', () => {
    // Arrange & Act
    const resultado = speciesIdParamSchema.safeParse({ id: 'abc' });

    // Assert — sem esta guarda o texto arbitrário chegaria ao repositório e o
    // Prisma responderia erro de infraestrutura (500) em vez de 400.
    expect(resultado.success).toBe(false);
    expect(resultado.success ? [] : resultado.error.issues).toEqual([
      expect.objectContaining({ path: ['id'], message: 'Identificador inválido.' }),
    ]);
  });

  it('CT-34: UUID bem formado é aceito e chega ao service', () => {
    // Arrange
    const id = '6f6d2b4e-6f7e-4d3f-9c1a-1f2b3c4d5e6f';

    // Act
    const resultado = speciesIdParamSchema.safeParse({ id });

    // Assert
    expect(resultado.success && resultado.data.id).toBe(id);
  });
});

describe('RenameSpeciesService', () => {
  let armazem: ArmazemDeEspecies;
  let especies: InMemorySpeciesRepository;
  let servico: RenameSpeciesService;

  beforeEach(() => {
    reiniciarSequenciaDeUuid();

    armazem = new ArmazemDeEspecies();
    especies = new InMemorySpeciesRepository(armazem);
    servico = new RenameSpeciesService(especies);
  });

  it('CT-16: renomear com nome válido grava o novo nome e PRESERVA o identificador (RN-15)', async () => {
    // Arrange
    const original = armazem.semear({ name: 'Sapo' });

    // Act
    const renomeada = await servico.execute({
      id: original.id,
      name: nomeValidado({ name: 'Perereca' }),
    });

    // Assert — a asserção sobre o `id` é o coração da RN-15: renomear NÃO cria
    // um recurso novo, e a interface substitui a linha pelo que voltou.
    expect(renomeada.id).toBe(original.id);
    expect(renomeada.name).toBe('Perereca');
    expect(armazem.linhas).toHaveLength(1);
    expect(armazem.linhas[0]).toMatchObject({
      id: original.id,
      name: 'Perereca',
      nameNormalized: 'perereca',
    });
  });

  it('CT-16: a chave de unicidade acompanha o nome novo — a antiga fica livre para outra espécie', async () => {
    // Arrange
    const original = armazem.semear({ name: 'Sapo' });

    // Act
    await servico.execute({ id: original.id, name: nomeValidado({ name: 'Perereca' }) });

    // Assert — sem a atualização de `nameNormalized`, "Sapo" continuaria
    // ocupado e a próxima criação com esse nome falharia sem motivo visível.
    expect(await especies.findByNameKey('sapo')).toBeNull();
    expect(await especies.findByNameKey('perereca')).not.toBeNull();
  });

  it('CT-17: ajustar apenas a caixa das letras é ACEITO e não caracteriza conflito (RN-07)', async () => {
    // Arrange — "gato" para "Gato": a chave não muda, então a verificação de
    // conflito é PULADA. É assim que o administrador corrige a caixa.
    const original = armazem.semear({ name: 'gato' });

    // Act
    const renomeada = await servico.execute({
      id: original.id,
      name: nomeValidado({ name: 'Gato' }),
    });

    // Assert
    expect(renomeada.name).toBe('Gato');
    expect(renomeada.id).toBe(original.id);
    expect(armazem.linhas[0]?.nameNormalized).toBe('gato');
  });

  it('CT-17: renomear para o próprio nome cercado de espaços também é aceito', async () => {
    // Arrange
    const original = armazem.semear({ name: 'Gato' });

    // Act
    const renomeada = await servico.execute({
      id: original.id,
      name: nomeValidado({ name: '  Gato  ' }),
    });

    // Assert
    expect(renomeada.name).toBe('Gato');
  });

  it('RN-07 [SOBRE DUBLÊ]: quando `findByNameKey` devolve a PRÓPRIA espécie, a resposta é sucesso e não conflito', async () => {
    // Arrange — a REDE DE SEGURANÇA do desvio da RN-07, e o único ramo do
    // service que dados consistentes não alcançam: o desvio `chaveNova !==
    // especie.nameNormalized` já pula a consulta quando a chave não muda.
    //
    // Para exercitar a comparação de `id` é preciso, portanto, uma linha cuja
    // chave persistida NÃO corresponda ao nome (estado que a coluna admite) E
    // uma consulta que devolva essa mesma linha. O dublê de consulta é o que
    // torna o ramo alcançável — sem ele, o teste passaria pelo caminho de cima
    // e não provaria nada sobre a comparação de `id`.
    //
    // Daí a marca `[SOBRE DUBLÊ]`, a mesma usada em CT-24/25/26/32: o ramo é
    // rede de segurança INALCANÇÁVEL com dados consistentes, e não caminho de
    // execução. O que ele fixa é que a comparação de `id` continua lá.
    const original = armazem.semear({ name: 'Gato', nameNormalized: 'chave-antiga' });

    const consulta = jest.spyOn(especies, 'findByNameKey').mockResolvedValue(original);

    // Act
    const renomeada = await servico.execute({
      id: original.id,
      name: nomeValidado({ name: 'Gato' }),
    });

    // Assert — sem a comparação de `id`, uma implementação que olhasse só a
    // chave responderia 409 sobre a própria espécie.
    expect(consulta).toHaveBeenCalledWith('gato');
    expect(renomeada.id).toBe(original.id);
    expect(renomeada.name).toBe('Gato');
    expect(armazem.buscarPorId(original.id)?.nameNormalized).toBe('gato');
  });

  it('CT-18: renomear para o nome de OUTRA espécie é recusado e nenhum dos dois registros muda', async () => {
    // Arrange
    const gato = armazem.semear({ name: 'Gato' });
    const sapo = armazem.semear({ name: 'Sapo' });

    // Act
    const motivo = await servico
      .execute({ id: sapo.id, name: nomeValidado({ name: 'gato' }) })
      .catch((erro: unknown) => erro);

    // Assert
    expect(motivo).toBeInstanceOf(SpeciesNameAlreadyExistsError);
    expect(motivo).toMatchObject({
      code: 'SPECIES_NAME_ALREADY_EXISTS',
      message: 'Já existe uma espécie com este nome.',
      statusCode: 409,
    });
    expect(armazem.buscarPorId(gato.id)).toMatchObject({ name: 'Gato' });
    expect(armazem.buscarPorId(sapo.id)).toMatchObject({ name: 'Sapo' });
  });

  it('CT-20: renomear espécie inexistente responde "Espécie não encontrada." (RN-14)', async () => {
    // Arrange — nada semeado: o identificador é bem formado e simplesmente não
    // corresponde a linha nenhuma.
    const idDeEspecieExcluida = proximoUuid();

    // Act
    const motivo = await servico
      .execute({ id: idDeEspecieExcluida, name: nomeValidado({ name: 'Perereca' }) })
      .catch((erro: unknown) => erro);

    // Assert
    expect(motivo).toBeInstanceOf(SpeciesNotFoundError);
    expect(motivo).toMatchObject({
      code: 'SPECIES_NOT_FOUND',
      message: 'Espécie não encontrada.',
      statusCode: 404,
    });
  });

  it('CT-20: a existência é verificada ANTES do conflito — espécie excluída responde 404, e não 409', async () => {
    // Arrange — existe "Gato"; o alvo da renomeação é um id que não existe mais.
    armazem.semear({ name: 'Gato' });

    // Act
    const motivo = await servico
      .execute({ id: proximoUuid(), name: nomeValidado({ name: 'Gato' }) })
      .catch((erro: unknown) => erro);

    // Assert — a ordem importa: 409 sobre um recurso que nem existe mais seria a
    // informação errada para quem tinha a linha aberta em edição.
    expect(motivo).toBeInstanceOf(SpeciesNotFoundError);
  });

  it('CT-20: `P2025` na escrita (espécie excluída entre a leitura e a gravação) também vira 404', async () => {
    // Arrange — a corrida que a leitura prévia não fecha.
    const original = armazem.semear({ name: 'Sapo' });

    jest.spyOn(especies, 'rename').mockRejectedValue(erroDeRegistroAusente());

    // Act
    const desfecho = servico.execute({
      id: original.id,
      name: nomeValidado({ name: 'Perereca' }),
    });

    // Assert
    await expect(desfecho).rejects.toBeInstanceOf(SpeciesNotFoundError);
  });

  it('CT-18 / RN-16: `P2002` na escrita produz o MESMO conflito da verificação prévia', async () => {
    // Arrange — outra sessão renomeou para o mesmo nome entre a leitura e a
    // escrita; sem a tradução, esta corrida responderia 500.
    const original = armazem.semear({ name: 'Sapo' });

    jest.spyOn(especies, 'rename').mockRejectedValue(erroDeNomeDuplicado());

    // Act
    const motivo = await servico
      .execute({ id: original.id, name: nomeValidado({ name: 'Perereca' }) })
      .catch((erro: unknown) => erro);

    // Assert
    expect(motivo).toBeInstanceOf(SpeciesNameAlreadyExistsError);
    expect(motivo).toMatchObject({ code: 'SPECIES_NAME_ALREADY_EXISTS' });
  });

  it('erro do Prisma que não é `P2002` nem `P2025` continua subindo, e não vira 404 ou 409', async () => {
    // Arrange — `P2028` é um `PrismaClientKnownRequestError` de código ALHEIO
    // (transação estourada no pooler). É ele que discrimina as duas guardas: um
    // `Error` comum reprova já no `instanceof`, então uma guarda degenerada para
    // `instanceof` puro continuaria passando e o administrador leria "Espécie
    // não encontrada." diante de um banco indisponível.
    const original = armazem.semear({ name: 'Sapo' });
    const falhaDeInfraestrutura = erroDeTransacaoExpirada();

    jest.spyOn(especies, 'rename').mockRejectedValue(falhaDeInfraestrutura);

    // Act
    const desfecho = servico.execute({
      id: original.id,
      name: nomeValidado({ name: 'Perereca' }),
    });

    // Assert
    await expect(desfecho).rejects.toBe(falhaDeInfraestrutura);
  });

  it('erro que nem do Prisma é (falha de rede) também continua subindo intacto', async () => {
    // Arrange — o outro lado da guarda: o `instanceof` precisa continuar
    // reprovando o que não vem do Prisma.
    const original = armazem.semear({ name: 'Sapo' });
    const falhaDeRede = new Error('conexão perdida');

    jest.spyOn(especies, 'rename').mockRejectedValue(falhaDeRede);

    // Act
    const desfecho = servico.execute({
      id: original.id,
      name: nomeValidado({ name: 'Perereca' }),
    });

    // Assert
    await expect(desfecho).rejects.toBe(falhaDeRede);
  });
});
