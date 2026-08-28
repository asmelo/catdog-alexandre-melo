import type { ReactElement } from 'react';

import { StatusBadge } from '~/components/ui/status-badge';
import { ANIMAL_SIZE_LABELS } from '~/domains/animals/animal-labels';
import type { Animal } from '~/domains/animals/animal.types';
import { AnimalStatusSelect, type StatusChangeOutcome } from '~/pages/admin/animais/animal-status-select';
import { AnimalThumbnail } from '~/pages/admin/animais/animal-thumbnail';
import { MESSAGES } from '~/utils/messages';

interface AnimalsTableProps {
  readonly animals: ReadonlyArray<Animal>;
  readonly onStatusOutcome: (resultado: StatusChangeOutcome) => void;
  readonly onEdit: (animal: Animal) => void;
  readonly onDelete: (animal: Animal) => void;
  readonly busy: boolean;
}

/**
 * As sete colunas da captura, NESTA ordem (CA-03). Constante de modulo para que a
 * ordem seja um dado unico, e nao sete literais espalhados pelo JSX que podem
 * divergir do `<tbody>` sem que nada reprove.
 */
const COLUNAS = [
  'ANIMAL',
  'ESPÉCIE',
  'PORTE',
  'LOCALIZAÇÃO',
  'STATUS',
  'ALTERAR STATUS',
  'AÇÕES',
] as const;

const CLASSES_DO_BOTAO_DE_LINHA =
  'rounded-field border-[1.5px] px-3 py-1.5 text-[0.75rem] font-extrabold transition-colors focus-visible:shadow-focus-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Tabela da listagem de animais.
 *
 * ==================== `<table>` DE VERDADE, E NAO O `DataList` ====================
 *
 * O `DataList` da FEATURE-001 e reaproveitado onde cabe, e aqui NAO cabe — o
 * proprio comentario dele registra o motivo ao contrario: ele e `<ul>`/`<li>`
 * porque a lista de especies tem UM dado por linha, e uma tabela de uma coluna
 * acrescentaria semantica de grade inexistente.
 *
 * Esta lista tem SETE colunas com cabecalho. A relacao entre "Boa Esperança - ES"
 * e o cabecalho LOCALIZAÇÃO e exatamente o que a semantica de tabela carrega: sem
 * ela, quem usa leitor de tela ouve sete valores soltos por linha e precisa
 * decorar a ordem. Nenhum componente novo e criado — a tabela vive nesta tela,
 * como a task pede.
 *
 * `scope="col"` em cada cabecalho: e o que associa a celula a coluna. Sem ele,
 * uma tabela com cabecalhos e apenas uma grade de texto.
 */
export function AnimalsTable({
  animals,
  onStatusOutcome,
  onEdit,
  onDelete,
  busy,
}: AnimalsTableProps): ReactElement {
  return (
    <div className="overflow-x-auto rounded-card bg-surface-card shadow-card">
      <table className="w-full border-collapse text-left text-[0.82rem]">
        <caption className="sr-only">{MESSAGES.ANIMALS.LIST_LABEL}</caption>
        <thead>
          <tr className="border-b border-hairline">
            {COLUNAS.map((coluna) => (
              <th
                key={coluna}
                scope="col"
                className="px-4 py-3 text-[0.68rem] font-extrabold tracking-[0.6px] text-ink-mid"
              >
                {coluna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {animals.map((animal) => (
            <tr key={animal.id} className="border-b border-hairline last:border-b-0">
              <td className="px-4 py-3">
                <span className="flex items-center gap-3 font-semibold text-ink">
                  <AnimalThumbnail animal={animal} />
                  {animal.name}
                </span>
              </td>
              <td className="px-4 py-3 text-ink-mid">{animal.species.name}</td>
              <td className="px-4 py-3 text-ink-mid">{ANIMAL_SIZE_LABELS[animal.size]}</td>
              {/*
                A UF vem da CIDADE, e nao de campo proprio do animal (CA-04): e a
                cidade que sabe a que estado pertence, e um campo separado abriria
                a possibilidade de os dois divergirem.
              */}
              <td className="px-4 py-3 text-ink-mid">
                {animal.city.name} - {animal.city.stateUf}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={animal.status} />
              </td>
              <td className="px-4 py-3">
                <AnimalStatusSelect
                  animal={animal}
                  onOutcome={onStatusOutcome}
                  disabled={busy}
                />
              </td>
              <td className="px-4 py-3">
                <span className="flex gap-2">
                  {/*
                    Botoes de TEXTO, como a captura mostra — e nao os `IconButton`
                    da tela de especies. O nome acessivel repete o verbo visivel
                    antes do nome do animal ("Editar Theo"): identifica de qual
                    linha e a acao (RNF-17, CT-95) e mantem a regra de "rotulo no
                    nome" do WCAG 2.5.3, que o comando por voz depende.
                  */}
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={MESSAGES.ANIMALS.rowActionLabel(
                      MESSAGES.ANIMALS.EDIT_ACTION,
                      animal.name,
                    )}
                    onClick={() => {
                      onEdit(animal);
                    }}
                    className={`${CLASSES_DO_BOTAO_DE_LINHA} border-hairline bg-surface-card text-ink hover:bg-brand-purple-light`}
                  >
                    {MESSAGES.ANIMALS.EDIT_ACTION}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={MESSAGES.ANIMALS.rowActionLabel(
                      MESSAGES.ANIMALS.DELETE_ACTION,
                      animal.name,
                    )}
                    onClick={() => {
                      onDelete(animal);
                    }}
                    className={`${CLASSES_DO_BOTAO_DE_LINHA} border-brand-orange-dark bg-surface-card text-brand-orange-dark hover:bg-surface-input`}
                  >
                    {MESSAGES.ANIMALS.DELETE_ACTION}
                  </button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
