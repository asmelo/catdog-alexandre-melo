import { buildAnimalImageObjectPath } from '~/infra/storage/object-path';

/**
 * RN-52 / RNF-03 / CT-57 / CA-27 — o caminho do objeto é gerado pela aplicação.
 *
 * A garantia mais forte deste módulo é ESTRUTURAL e não tem teste possível: o nome
 * do arquivo enviado não é parâmetro da função. Os testes abaixo verificam o que
 * resta — que o caminho fica dentro do prefixo do animal e que a extensão vem do
 * tipo apurado por assinatura.
 */
describe('infra/storage/object-path', () => {
  const ID_DO_ANIMAL = 'c7066355-5591-4a6f-a3f8-2a9ee727b2d0';
  const ID_DA_IMAGEM = '9f1b4e2a-0c37-4d55-9e88-1a2b3c4d5e6f';

  it('monta `animals/<uuid-do-animal>/<uuid-da-imagem>.jpg` a partir do tipo JPEG', () => {
    // Act
    const caminho = buildAnimalImageObjectPath(ID_DO_ANIMAL, ID_DA_IMAGEM, 'image/jpeg');

    // Assert
    expect(caminho).toBe(`animals/${ID_DO_ANIMAL}/${ID_DA_IMAGEM}.jpg`);
  });

  it('usa `.png` para o tipo PNG', () => {
    // Act
    const caminho = buildAnimalImageObjectPath(ID_DO_ANIMAL, ID_DA_IMAGEM, 'image/png');

    // Assert
    expect(caminho).toBe(`animals/${ID_DO_ANIMAL}/${ID_DA_IMAGEM}.png`);
  });

  it('CT-57 — nome hostil não influencia o caminho porque não é parâmetro da função', () => {
    // Arrange — o nome que o administrador enviaria: travessia de diretório, emoji
    // e 300 caracteres. Ele existe aqui só para NÃO ser usado.
    const nomeHostil = `../../../etc/passwd🐶${'a'.repeat(300)}.jpg`;

    // Act
    const caminho = buildAnimalImageObjectPath(ID_DO_ANIMAL, ID_DA_IMAGEM, 'image/jpeg');

    // Assert
    expect(caminho).toBe(`animals/${ID_DO_ANIMAL}/${ID_DA_IMAGEM}.jpg`);
    expect(caminho).not.toContain('..');
    expect(caminho).not.toContain('passwd');
    expect(caminho).not.toContain('🐶');
    expect(caminho.startsWith(`animals/${ID_DO_ANIMAL}/`)).toBe(true);

    // O nome nem sequer aparece na assinatura: se um dia aparecer, esta asserção
    // continua verdadeira mas a chamada acima deixa de compilar.
    expect(buildAnimalImageObjectPath).toHaveLength(3);
    expect(nomeHostil.length).toBeGreaterThan(300);
  });

  it('a extensão vem do tipo apurado por assinatura, e não da extensão do nome enviado', () => {
    // Arrange & Act — um JPEG cujo nome termina em `.png`: o que chega aqui é o
    // tipo real (`image/jpeg`), apurado em `detectImageMimeType`.
    const caminho = buildAnimalImageObjectPath(ID_DO_ANIMAL, ID_DA_IMAGEM, 'image/jpeg');

    // Assert
    expect(caminho.endsWith('.jpg')).toBe(true);
    expect(caminho.endsWith('.png')).toBe(false);
  });

  it('imagens distintas do mesmo animal compartilham o prefixo e não colidem', () => {
    // Arrange — o prefixo por animal é o que torna a limpeza da RN-37 uma operação
    // sobre um prefixo conhecido.
    const outraImagem = '00000000-0000-4000-8000-000000000002';

    // Act
    const primeiro = buildAnimalImageObjectPath(ID_DO_ANIMAL, ID_DA_IMAGEM, 'image/jpeg');
    const segundo = buildAnimalImageObjectPath(ID_DO_ANIMAL, outraImagem, 'image/jpeg');

    // Assert
    expect(primeiro).not.toBe(segundo);
    expect(primeiro.startsWith(`animals/${ID_DO_ANIMAL}/`)).toBe(true);
    expect(segundo.startsWith(`animals/${ID_DO_ANIMAL}/`)).toBe(true);
  });
});
