-- Colunas de busca da vitrine (FEATURE-003 / TASK-BACKEND-001).
--
-- ADITIVA E REEXECUTAVEL. Nenhum DROP, nenhum ALTER COLUMN TYPE, nenhum RENAME.
--
-- A ORDEM DOS QUATRO PASSOS E OBRIGATORIA: adicionar ja como NOT NULL sem default
-- falha em base que ja tem registros, e criar o indice antes do backfill o
-- construiria sobre coluna vazia.
--
-- `unaccent` NAO e usado: a extensao nao esta habilitada neste banco gerenciado e
-- habilita-la exige privilegio de superusuario — foi justamente a alternativa
-- recusada pela spec. O `translate` abaixo cobre integralmente o repertorio PT-BR
-- presente em `animals` e no recorte IBGE de `cities`.
--
-- O resultado deste SQL tem de casar, caractere a caractere, com o que
-- `normalizeForSearch` produz em TypeScript: os dois lados da comparacao de busca
-- vem dai. Por isso `btrim` + `regexp_replace('\s+', ' ')` antes do `translate`,
-- na mesma ordem da funcao.

-- 1. Colunas anulaveis.
ALTER TABLE "animals" ADD COLUMN IF NOT EXISTS "name_search" VARCHAR(60);
ALTER TABLE "cities" ADD COLUMN IF NOT EXISTS "name_search" VARCHAR(120);

-- 2. Backfill. Restrito a `IS NULL` para que a segunda execucao nao reescreva
--    linha nenhuma.
UPDATE "animals"
SET "name_search" = lower(
  translate(
    regexp_replace(btrim("name"), '\s+', ' ', 'g'),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  )
)
WHERE "name_search" IS NULL;

UPDATE "cities"
SET "name_search" = lower(
  translate(
    regexp_replace(btrim("name"), '\s+', ' ', 'g'),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  )
)
WHERE "name_search" IS NULL;

-- 3. Agora nenhuma linha tem nulo, e a restricao pode entrar.
ALTER TABLE "animals" ALTER COLUMN "name_search" SET NOT NULL;
ALTER TABLE "cities" ALTER COLUMN "name_search" SET NOT NULL;

-- 4. Indice da vitrine: filtro por situacao, ordenacao por data de cadastro e
--    desempate por id, em um so passo. O `animals_status_idx` existente PERMANECE.
CREATE INDEX IF NOT EXISTS "animals_status_created_at_id_idx"
  ON "animals" ("status", "created_at", "id");
