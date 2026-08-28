import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactElement } from 'react';

import { SECONDARY_BUTTON_CLASSES } from '~/components/ui/secondary-button';
import {
  appendFiles,
  itemKey,
  removeItem,
  type AnimalImageItem,
  type RejectedFile,
  type StagedFactory,
} from '~/domains/animals/animal-images';
import { MESSAGES } from '~/utils/messages';

interface ImageUploadFieldProps {
  readonly items: ReadonlyArray<AnimalImageItem>;
  readonly onChange: (items: ReadonlyArray<AnimalImageItem>) => void;
  readonly disabled?: boolean;
}

/**
 * Area de imagens do formulario de animal.
 *
 * ======================= CONTROLADO, SEM ESTADO DE IMAGEM =======================
 *
 * Recebe `items` e devolve a lista nova por `onChange`. NENHUMA imagem vive aqui
 * dentro, e a razao e o "Cancelar": e o formulario que precisa do estado final
 * para montar o envio, e e ele que descarta a lista inteira quando o
 * administrador desiste. Com estado interno, o "Cancelar" sairia da tela deixando
 * uma remocao marcada — e a foto voltaria a sumir na proxima abertura.
 *
 * O unico estado local sao as RECUSAS da ultima escolha: elas descrevem um evento
 * ("estes tres arquivos nao entraram"), nao o valor do campo, e nao teriam sentido
 * subindo para o formulario.
 *
 * ============================ NENHUMA REDE AQUI ============================
 *
 * O componente nao importa nada de `~/services/api/`, em nenhuma circunstancia.
 * Remover uma imagem JA GRAVADA nao chama a API: apenas a tira da lista (RN-49,
 * CT-59). Ela deixa de existir quando o formulario salva, e nao antes.
 */
export function ImageUploadField({
  items,
  onChange,
  disabled,
}: ImageUploadFieldProps): ReactElement {
  const idBase = useId();
  const idDoInput = `${idBase}-images`;
  const [recusados, setRecusados] = useState<ReadonlyArray<RejectedFile>>([]);
  const [erroDeLimite, setErroDeLimite] = useState<string | undefined>(undefined);

  /**
   * As URLs em preparo VIVAS neste instante, numa referencia mutavel.
   *
   * O `useEffect` de desmonte precisa revogar as URLs que existiam no FIM, e nao
   * as que existiam quando ele foi registrado. Uma dependencia em `items` faria o
   * efeito rodar (e revogar tudo) a cada mudanca da lista, apagando as
   * miniaturas em uso; sem dependencia nenhuma, o closure veria a lista da
   * primeira renderizacao. A referencia resolve os dois.
   */
  const urlsEmPreparo = useRef<ReadonlyArray<string>>([]);

  urlsEmPreparo.current = items
    .filter((item) => item.kind === 'staged')
    .map((item) => item.previewUrl);

  useEffect(() => {
    /**
     * Sem esta revogacao, cada abertura do formulario retem os blobs ate a aba ser
     * fechada. Cinco imagens de 5 MB por edicao e vazamento visivel na pratica,
     * nao teorico.
     */
    return () => {
      for (const url of urlsEmPreparo.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const estaDesabilitado = disabled === true;
  const total = items.length;

  /**
   * A URL de pre-visualizacao nasce AQUI, uma vez por arquivo, no instante em que
   * ele entra na lista — e viaja dentro do item. Cria-la na renderizacao
   * produziria uma URL nova a cada render, vazaria todas as anteriores e faria a
   * miniatura piscar.
   */
  const fabrica: StagedFactory = {
    createLocalId: () => `${idBase}-${String(Date.now())}-${String(Math.random()).slice(2, 10)}`,
    createPreviewUrl: (file: File) => URL.createObjectURL(file),
  };

  function aoEscolherArquivos(evento: ChangeEvent<HTMLInputElement>): void {
    const escolhidos = Array.from(evento.target.files ?? []);
    const resultado = appendFiles(items, escolhidos, fabrica);

    setRecusados(resultado.rejected);
    setErroDeLimite(resultado.limitError);

    if (resultado.items !== items) {
      onChange(resultado.items);
    }

    /**
     * Zera o input DEPOIS de consumir a escolha. Sem isso, escolher o mesmo
     * arquivo duas vezes seguidas nao dispara `change` — o valor do input nao
     * mudou —, e o usuario que removeu uma foto por engano nao consegue
     * reescolhe-la.
     */
    evento.target.value = '';
  }

  function aoRemover(chave: string, itemRemovido: AnimalImageItem): void {
    if (itemRemovido.kind === 'staged') {
      URL.revokeObjectURL(itemRemovido.previewUrl);
    }

    setErroDeLimite(undefined);
    onChange(removeItem(items, chave));
  }

  return (
    <div>
      <p className="mb-1.5 block text-[0.8rem] font-extrabold text-ink">
        {MESSAGES.ANIMALS.IMAGES_LABEL}
      </p>

      <div className="flex items-center gap-3">
        {/*
          `sr-only` e NUNCA `display: none`: escondido de verdade, o input sai da
          ordem de tabulacao e a escolha de arquivos fica inalcancavel por teclado
          (RNF-16, CT-94). Assim ele continua focavel, e o botao ao lado e apenas
          a affordance visual.
        */}
        <input
          id={idDoInput}
          type="file"
          multiple
          accept="image/jpeg,image/png"
          className="peer sr-only"
          disabled={estaDesabilitado}
          onChange={aoEscolherArquivos}
        />
        {/*
          O `<label>` E o botao, com a aparencia do `SecondaryButton`. Nao ha
          `<button>` aqui de proposito: dentro de um label ele nao acionaria o
          input, e um botao chamando `input.click()` criaria um SEGUNDO ponto
          focavel para a mesma acao — o usuario de teclado passaria duas vezes.
          Quem recebe o foco e o input `sr-only`, e o `peer-focus-visible` abaixo
          desenha o anel sobre este rotulo.
        */}
        <label
          htmlFor={idDoInput}
          className={[
            SECONDARY_BUTTON_CLASSES,
            'inline-flex w-auto cursor-pointer justify-center px-4 peer-focus-visible:shadow-focus-ring',
            estaDesabilitado ? 'cursor-not-allowed opacity-60' : '',
          ]
            .join(' ')
            .trim()}
        >
          {MESSAGES.ANIMALS.CHOOSE_FILES}
        </label>

        <span className="text-[0.8rem] font-semibold text-ink-mid">
          {total === 0
            ? MESSAGES.ANIMALS.NO_FILES_CHOSEN
            : MESSAGES.ANIMALS.chosenFilesLabel(total)}
        </span>
      </div>

      {/*
        As recusas sao anunciadas por `aria-live`: elas aparecem como consequencia
        de uma acao do usuario em outro ponto da tela (o seletor de arquivos), e
        sem a regiao viva o leitor de tela nao teria como saber que algo foi
        recusado.
      */}
      <div aria-live="polite">
        {erroDeLimite !== undefined && (
          <p className="mt-2 text-[0.75rem] font-semibold text-brand-orange-dark">
            {erroDeLimite}
          </p>
        )}
        {recusados.length > 0 && (
          <ul className="mt-2 space-y-1">
            {recusados.map((recusado) => (
              <li
                key={recusado.fileName}
                className="text-[0.75rem] font-semibold text-brand-orange-dark"
              >
                {MESSAGES.ANIMALS.rejectedFileLabel(recusado.fileName, recusado.reason)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {items.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-3">
          {items.map((item, indice) => {
            const chave = itemKey(item);
            const origem = item.kind === 'stored' ? item.url : item.previewUrl;

            return (
              <li key={chave} className="relative">
                {/*
                  `alt=""` e `aria-hidden`: a miniatura e decorativa. Quem carrega
                  a informacao e o nome acessivel do botao de remocao, que diz qual
                  imagem e — o `alt` repetiria a posicao e o leitor de tela leria
                  duas vezes.
                */}
                <img
                  src={origem}
                  alt=""
                  aria-hidden="true"
                  className="h-20 w-20 rounded-field border-[1.5px] border-hairline object-cover"
                />
                <button
                  type="button"
                  disabled={estaDesabilitado}
                  onClick={() => {
                    aoRemover(chave, item);
                  }}
                  aria-label={MESSAGES.ANIMALS.removeImageLabel(indice + 1, total)}
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-hairline bg-surface-card text-[0.7rem] font-extrabold text-ink transition-colors hover:bg-brand-purple-light focus-visible:shadow-focus-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {/* Glifo decorativo: o nome acessivel vem do `aria-label`. */}
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
