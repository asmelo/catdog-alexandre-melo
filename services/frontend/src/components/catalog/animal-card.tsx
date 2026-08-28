import type { ReactElement } from 'react';

import { AnimalImage } from '~/components/catalog/animal-image';
import { Badge } from '~/components/ui/badge';
import type { PublicAnimal } from '~/services/api/catalog-api';
import { formatAge } from '~/utils/format-age';

interface AnimalCardProps {
  readonly animal: PublicAnimal;
}

/**
 * Traducao do vocabulario do CONTRATO para o rotulo exibido.
 *
 * Constante de modulo, e nao `if` espalhado pelo JSX (RN-65): acrescentar um
 * porte ao contrato sem acrescentar o rotulo quebra a COMPILACAO, porque os dois
 * mapas sao `Record` sobre a uniao fechada.
 */
const ROTULO_DE_SEXO: Readonly<Record<PublicAnimal['sex'], string>> = {
  macho: 'Macho',
  femea: 'Fêmea',
};

const ROTULO_DE_PORTE: Readonly<Record<PublicAnimal['size'], string>> = {
  pequeno: 'Pequeno',
  medio: 'Médio',
  grande: 'Grande',
};

/**
 * Icone de marcador de localizacao. DECORATIVO — `aria-hidden` —, porque a
 * localizacao ao lado ja e legivel como texto e nao depende dele (RNF-23,
 * CT-121). E ele NAO abre mapa nenhum: nenhuma consulta a servico externo
 * acontece nesta tela.
 */
function IconeDeLocalizacao(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

/**
 * O cartao de um animal da vitrine.
 *
 * ============ NENHUM BOTAO, NENHUM LINK, NENHUM `onClick` ============
 *
 * A captura nao mostra acao, o modulo de Pedidos nao existe e a pagina de detalhe
 * esta fora de escopo (RN-08, CA-48, CT-130). O `id` vem na projecao e e o gancho
 * registrado para quando existir — mas NADA navega a partir daqui nesta feature.
 * As props sao `{ animal }` e nada mais: nem `onClick`, nem role, nem permissao.
 *
 * ============ CONTEUDO DO ADMINISTRADOR E SEMPRE TEXTO ============
 *
 * Nome, especie, cidade e descricao entram como FILHOS JSX, e o React os escapa
 * por padrao. Nao ha `dangerouslySetInnerHTML` em ponto nenhum desta feature — e
 * a regra existe escrita para que ninguem "melhore" a renderizacao depois
 * (RN-60, CA-44, CT-16, CT-17).
 *
 * ============ A TRUNCAGEM DA DESCRICAO E CSS ============
 *
 * `line-clamp` corta VISUALMENTE; o texto completo permanece no documento e
 * acessivel a tecnologia assistiva. Um `slice(0, 120)` em JavaScript apagaria o
 * resto para todo mundo, inclusive para quem le por audio, e a decisao de quantos
 * caracteres cabem depende da largura do cartao — que so o navegador conhece
 * (RN-61, CA-45, CT-15).
 */
export function AnimalCard({ animal }: AnimalCardProps): ReactElement {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-card bg-surface-card shadow-card">
      <AnimalImage src={animal.coverImageUrl} animalName={animal.name} />

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-3">
          {/*
            `<h2>`: um nivel abaixo do `<h1>` "Animais para adoção" da pagina. E o
            que faz a navegacao por titulos do leitor de tela percorrer os animais
            (RNF-23, CT-121).
          */}
          <h2 className="text-[0.95rem] font-extrabold leading-tight text-ink">{animal.name}</h2>
          <Badge tone="species">{animal.species.name}</Badge>
        </div>

        <p className="flex items-center gap-1.5 text-[0.78rem] font-semibold text-ink-mid">
          <IconeDeLocalizacao />
          {animal.city.name} - {animal.city.stateUf}
        </p>

        <div className="flex flex-wrap gap-1.5">
          <Badge tone="trait">{ROTULO_DE_SEXO[animal.sex]}</Badge>
          <Badge tone="trait">{ROTULO_DE_PORTE[animal.size]}</Badge>
          <Badge tone="trait">{formatAge(animal.ageInYears, animal.ageInMonths)}</Badge>
        </div>

        {/*
          AUSENTE DO DOM quando nao ha descricao, e nao um paragrafo vazio: o
          espaco em branco de um `<p></p>` desalinharia o cartao em relacao aos
          vizinhos (CT-14).
        */}
        {animal.description !== null && (
          <p className="line-clamp-3 text-[0.8rem] font-semibold leading-relaxed text-ink-mid">
            {animal.description}
          </p>
        )}
      </div>
    </article>
  );
}
