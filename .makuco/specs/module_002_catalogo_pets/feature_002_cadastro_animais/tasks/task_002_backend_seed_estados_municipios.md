# TASK-BACKEND-002 — Carga inicial de estados e municípios (recorte oficial do IBGE embarcado)

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-002-backend-seed-estados-municipios`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/spec_context.md`
**Part**: 2 of 18 — Fundação: Dados de Apoio
**Generated**: `2026-08-25`

---

## Context

Semeia as 27 unidades federativas e os cerca de 5.600 municípios brasileiros a partir de um recorte oficial do IBGE **embarcado no repositório como arquivo de dados**. A Decisão A da spec é o que esta task materializa: o IBGE continua sendo a **origem** do dado, mas como recorte aplicado na carga, nunca como dependência em tempo de execução (RN-27).

---

## Scope

**In:** Arquivo de dados com estados e municípios, módulo de carga idempotente e reexecutável, integração ao seed existente.

**Out:** Nenhuma chamada HTTP, em nenhum momento — nem no seed, nem em script auxiliar, nem em tempo de execução. Nenhum endpoint (TASK-BACKEND-005). Nenhuma tela de manutenção de estados e cidades: são dados de apoio, mantidos por carga (declarado fora de escopo pela spec). Não alterar o seed do usuário administrador entregue pela FEATURE-002 do MODULE-001 — apenas acrescentar a nova carga ao lado dele.

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `prisma/data/brazilian-states-cities.json` | recorte IBGE embarcado |
| `create` | `prisma/seeds/geography.seed.ts` | carga idempotente |
| `modify` | `prisma/seed.ts` | invoca a nova carga |

---

## Implementation

> **Reference pattern**: `prisma/seed.ts` já executa a carga do administrador inicial e define o estilo (idempotência por `upsert`, log do que foi criado, `prisma.$disconnect()` no fim).

### `prisma/data/brazilian-states-cities.json` *(create)*
**Diferenças em relação ao referencial:** não há referencial — é arquivo novo.
- Formato: `{ "states": [{ "uf": "AC", "name": "Acre", "cities": [{ "ibgeCode": 1200013, "name": "Acrelândia" }] }] }`.
- Exatamente 27 estados. Nomes de municípios com a acentuação oficial.
- `ibgeCode` é o código do município de 7 dígitos — a identidade estável pela qual uma futura atualização do recorte casa registros (RN-27, Decisão A).
- Arquivo versionado no repositório. Registrar no topo do JSON, em campo `_source`, a origem e a data do recorte, para que a próxima atualização saiba de onde veio.
- Carregar por `import` estático com `resolveJsonModule`, ou por `readFileSync` com caminho resolvido a partir de `__dirname` — **nunca** por caminho relativo ao diretório de trabalho, que difere entre `npm run seed` e execução de CI.

### `prisma/seeds/geography.seed.ts` *(create)*
- Exporta `seedGeography(prisma: PrismaClient): Promise<{ statesCreated: number; citiesCreated: number }>`.
- `upsert` de estado por `uf` e de cidade por `ibgeCode` — **casar por código oficial, jamais por nome**. Município renomeado é o mesmo município; casar por nome criaria um registro duplicado e deixaria animais apontando para o registro velho.
- Reexecutável sem efeito colateral: rodar duas vezes seguidas produz exatamente o mesmo estado do banco (é o que o critério de aceite verifica).
- Inserir em lotes (`createMany` com `skipDuplicates` para a primeira carga, ou `upsert` em blocos de algumas centenas). Um `upsert` por município em série custa ~5.600 idas ao banco e torna o seed inviável em CI.
- `stateId` de cada cidade vem do estado já semeado na mesma execução — resolver o mapa `uf → id` uma única vez e reutilizar, em vez de consultar por cidade.

### `prisma/seed.ts` *(modify)*
- Chamar `seedGeography(prisma)` **antes** da carga do administrador ou depois, indiferente — não há dependência entre as duas. Manter as duas em sequência, no mesmo `main()`, com log de quantos registros cada uma criou.

---

## Acceptance Criteria

- [ ] **Given** o banco vazio, **When** o seed é executado, **Then** `states` tem exatamente 27 linhas e `cities` tem o total do recorte, com "Campo Magro" pertencente a "PR" e "Boa Esperança" pertencente a "ES".
- [ ] **Given** o seed já executado, **When** ele é executado uma segunda vez, **Then** a contagem de `states` e de `cities` não muda e nenhum erro de chave duplicada ocorre.
- [ ] **Given** um município cujo nome mudou no recorte novo, **When** o seed é reexecutado, **Then** a linha existente é **atualizada** pelo `ibgeCode`, mantendo o mesmo `id` — animais vinculados continuam apontando para o mesmo registro.
- [ ] **Given** toda a rede externa bloqueada, **When** o seed é executado, **Then** ele conclui normalmente (RN-27, RNF-15).
- [ ] **Given** o seed concluído, **When** o administrador inicial é consultado, **Then** ele continua existindo com as mesmas credenciais — a carga nova não interferiu na existente.

---

## Dependencies

- **Requires**: TASK-BACKEND-001 (tabelas `states` e `cities`).
- **Blocks**: TASK-BACKEND-005 (endpoints não têm o que devolver sem a carga), TASK-BACKEND-007 (cadastro exige `cityId` existente), TASK-BACKEND-011.
