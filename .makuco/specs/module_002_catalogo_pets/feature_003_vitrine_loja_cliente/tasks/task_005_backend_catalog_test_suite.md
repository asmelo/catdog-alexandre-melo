# TASK-BACKEND-005 — Suíte de testes do catálogo público

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-005-backend-catalog-test-suite`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_003_vitrine_loja_cliente/spec_context.md`
**Part**: 5 of 11 — Testes do backend da vitrine
**Generated**: `2026-08-25`

---

## Context

Fecha o backend com a cobertura de 80% e a rastreabilidade CT ↔ teste. Dois testes desta suíte são o coração do risco da feature e não podem ser diluídos entre os demais: o que compara o **conjunto exato de chaves** da projeção pública por igualdade (RN-57), e o que prova que **filtro de idade e idade exibida nunca divergem** em datas de fronteira (RN-45).

---

## Scope

**In:** `tests/fakes/in-memory-public-catalog.repository.ts`; specs unitários de `animal-age`, `public-animal.mapper`, `text-normalizer` e dos três services; `tests/integration/catalog-routes.spec.ts`.

**Out:**
- Não alterar nenhum arquivo de `src/` para "facilitar teste". Se algo não for testável, reportar em vez de refatorar por conta própria.
- Nenhum banco real, nenhum socket. Os testes de integração usam o fake do repositório injetado no controller-fábrica, no mesmo padrão da suíte de auth.
- Não reescrever `jest.config.ts` nem `tests/setup.ts` — já existem; no máximo acrescentar caminhos a `collectCoverageFrom` se algum arquivo novo precisar de exclusão justificada.
- Não testar frontend (TASK-FRONTEND-011) nem E2E (fora do escopo do projeto).

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `tests/fakes/in-memory-public-catalog.repository.ts` | fake da porta do catálogo |
| `create` | `src/utils/animal-age.spec.ts` | fronteiras de idade |
| `create` | `src/domains/catalog/mappers/public-animal.mapper.spec.ts` | conjunto fechado de chaves |
| `create` | `src/domains/catalog/services/list-public-animals.service.spec.ts` | filtros e paginação |
| `create` | `tests/integration/catalog-routes.spec.ts` | contrato HTTP público |

> `text-normalizer.spec.ts` acompanha o utilitário e pode ser entregue já na TASK-BACKEND-001; se não tiver sido, entra aqui.

---

## Implementation

**Reference pattern**: `tests/integration/auth-routes.spec.ts` e `src/domains/auth/services/*.spec.ts` — `it('<CT-NN>: <asserção em PT-BR>')`, padrão AAA explícito, fakes que implementam a **interface** (nunca `jest.mock` de módulo).

### `tests/fakes/in-memory-public-catalog.repository.ts` *(create)*
- Implementa `PublicCatalogRepository` sobre um array. Precisa reproduzir fielmente quatro comportamentos, sob pena de a suíte passar e a produção quebrar:
  1. o recorte por `DISPONIVEL` é **fixo**, não parametrizável;
  2. `orderBy [createdAt desc, id asc]` — incluindo o desempate, que é justamente o que CT-74 verifica;
  3. `total` calculado **após** todos os filtros;
  4. a busca compara contra `nameSearch` do animal **e** da cidade, com `contains` simples.

### `src/utils/animal-age.spec.ts` *(create)*
- O relógio é fixado por teste com `jest.setSystemTime`, e o SUT lê `now()` do `clock.ts` — é por isso que a TASK-BACKEND-002 proibiu `new Date()`.
- CT-64 (3 anos), CT-65 (mesma data, relógio adiantado → 4 anos), CT-66 (exatamente 1 ano), CT-67 (5 meses), CT-68 (10 dias), CT-69 (29/02 em 28/02 e em 01/03), CT-70 (processo em `TZ=UTC`, relógio às 22h de São Paulo).
- CT-70 exige o processo em UTC: fixar `process.env.TZ = 'UTC'` **antes** do primeiro import do módulo, ou rodar o arquivo com `TZ=UTC`. Sem isso o teste passa por acidente na máquina de quem escreveu.
- Testar `birthDateCutoffForMaxAge` contra `calculateAge` em varredura de fronteira: para cada data entre `hoje - (N+1) anos - 2 dias` e `hoje`, o item passa pelo corte **se e somente se** `calculateAge(...).ageInYears <= N`. É este teste, e não uma inspeção visual, que fecha a RN-45.

### `src/domains/catalog/mappers/public-animal.mapper.spec.ts` *(create)*
- **CT-99 é o teste central da feature**: `expect(Object.keys(item).sort()).toEqual([...conjunto esperado].sort())` — igualdade, **jamais** `toEqual(expect.objectContaining(...))` nem `toHaveProperty`. Continência passaria com um campo a mais, que é exatamente o defeito a impedir (RN-57, CA-40).
- Mesma verificação por igualdade em `item.species` (`['id','name']`) e `item.city` (`['name','stateUf']`).
- CT-100: acrescentar um campo à linha de entrada (`PublicAnimalRow` estendida em teste, com `chipNumber`) e afirmar que a saída permanece **idêntica**. Este teste precisa falhar se alguém trocar o montador por um `spread` — escrevê-lo é o que dá dente à RN-55.
- CT-101: `status`, `birthDate`, `createdAt`, `updatedAt`, `city.id`, `speciesId`, `cityId` e `images` ausentes.
- CT-102 (cinco imagens → um endereço, o de `position 0`), CT-103 (sem imagem → `null`), CT-15 (descrição de 1000 caracteres sai integral).

### `src/domains/catalog/services/list-public-animals.service.spec.ts` *(create)*
- CT-18 a CT-21 (cada status ausente **individualmente**, e os quatro juntos com `total = 1`), CT-22/CT-23 (mudança de status refletida na consulta seguinte).
- CT-25 a CT-32 (busca: trecho de nome, trecho de cidade, sem acento, caixa mista, posição interna, sequência não quebrada, só espaços, espaços internos colapsados).
- CT-37 a CT-44 (cada filtro isolado, homônimas em UFs distintas, todos juntos, cada um neutro quando omitido, nenhum filtro).
- CT-54 a CT-63 (idade máxima, aniversário hoje/amanhã, sem data com e sem filtro, `0`, ausente, coerência filtro↔idade).
- CT-74 (45 animais de mesmo `createdAt`, 4 páginas, 45 ids distintos), CT-76 (página além da última), CT-78 (padrão 12), CT-98 (total após filtros).
- CT-47/CT-48: identificador bem formado inexistente devolve lista vazia — o service **não** lança e **não** consulta a existência da espécie antes. Verificar a ausência dessa consulta é o que impede alguém de "melhorar" o endpoint com um `404` (RN-51).

### `tests/integration/catalog-routes.spec.ts` *(create)*
- Sobe o app com `supertest`, sem nenhum cabeçalho `Authorization` em nenhuma requisição — é assim que CT-02 e CT-106 se verificam de fato.
- CT-02 / CT-106 / QA-47: os três endpoints respondem `200` anonimamente. Afirmar explicitamente `expect([401, 403]).not.toContain(res.status)` nos três — o CA-01 é sobre **nunca**, e um `expect(200)` sozinho não registra a intenção.
- CT-04: mesma consulta anônima, com token de `cliente` e com token de `admin` → comparar os três corpos por igualdade profunda (CA-03).
- CT-24 / QA-49: `?status=adotado`, `?status=disponivel`, `?status=` → `400 VALIDATION_ERROR` com `details[0].field = 'status'` nos três.
- CT-33/34, CT-45, CT-46, CT-49, CT-61, CT-62, CT-77: faixas e conjuntos.
- CT-50, CT-51, CT-52: opções de espécie e de cidade, ordenação e saída da lista.
- CT-108: com `RATE_LIMIT_ENABLED=true`, estourar o limite e verificar `429` no envelope `{ error: { code, message } }` com texto em PT-BR. **Isolar este teste**: `tests/setup.ts` desliga o limitador globalmente de propósito; reativá-lo aqui exige recarregar o módulo (`jest.isolateModules`) e restaurar depois, senão os demais testes desta suíte passam a falhar por `429` — que é exatamente o defeito que o interruptor existe para evitar.
- CT-107 / CT-105 / QA-48: `GET /api/animals` e `GET /api/species` sem credencial → `401`; com token de `cliente` → `403`. A vitrine não afrouxou nada.
- CT-110: resposta traz `Cache-Control: no-store`.
- CT-134: nenhuma resposta — pública ou administrativa — contém `nameSearch`.

---

## Acceptance Criteria

- [ ] **Given** a suíte completa, **When** `npm test -- --coverage`, **Then** cobertura ≥ 80% em statements, branches, functions e lines nos arquivos de `src/domains/catalog/`, `src/utils/animal-age.ts` e `src/utils/text-normalizer.ts`.
- [ ] **Given** os nomes dos testes, **When** listados, **Then** cada CT de backend da spec aparece pelo seu identificador em ao menos um `it(...)`.
- [ ] **Given** o teste de CT-99, **When** um campo é acrescentado ao literal do montador, **Then** ele **falha** — a asserção é por igualdade de conjunto de chaves, não por continência.
- [ ] **Given** o teste de CT-100, **When** o montador é trocado por um `spread` da linha, **Then** ele **falha**.
- [ ] **Given** o teste de CT-74, **When** o desempate por `id` é removido do `orderBy`, **Then** ele **falha** — 45 ids distintos deixam de ser 45.
- [ ] **Given** o teste de CT-63, **When** o corte do filtro deixa de derivar da mesma função da idade exibida, **Then** ele **falha** em ao menos uma data de fronteira.
- [ ] **Given** o teste de CT-70, **When** roda com `TZ=UTC`, **Then** passa; e passa igualmente com `TZ=America/Sao_Paulo` — o resultado não depende do fuso do processo.
- [ ] **Given** a suíte inteira, **When** executada duas vezes em ordens diferentes (`--randomize`), **Then** o resultado é o mesmo — nenhum teste depende de estado deixado por outro, inclusive o do limitador.
- [ ] **Given** a suíte, **When** executada, **Then** nenhum teste abre socket de banco, de SMTP ou de armazenamento de objetos.
- [ ] **Given** a suíte de auth e a das FEATURE-001/002 deste módulo, **When** executadas após esta entrega, **Then** continuam verdes sem alteração (regressão).
- [ ] **Given** o Quality Gate do Sonar, **When** avaliado, **Then** aprovado sem bloqueadores e com zero issues de segurança Blocker/Critical.

---

## Dependencies

- **Requires**: TASK-BACKEND-001 a 004 (todo o backend do catálogo); a infraestrutura de testes de `jest.config.ts` e `tests/setup.ts` já entregue pela TASK-BACKEND-007 da FEATURE-002 do MODULE-001.
- **Blocks**: nenhuma task de frontend depende desta; ela fecha o backend da feature.
