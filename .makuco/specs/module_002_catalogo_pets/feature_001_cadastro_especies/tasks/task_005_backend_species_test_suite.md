# TASK-BACKEND-005 — Suíte de testes do domínio Species

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-005-backend-species-test-suite`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_001_cadastro_especies/spec_context.md`
**Part**: 5 of 11 — Testes do backend
**Generated**: `2026-08-25`

---

## Context

Fecha o backend da feature cobrindo os CT-01 a CT-15, CT-16 a CT-27 e CT-30 a CT-34 com testes automatizados, mais a regressão exigida sobre a FEATURE-002. É aqui que a RN-08 se torna verificável antes de a entidade `Animal` existir: o duplo de `SpeciesUsageCounter` responde diferente de zero e exercita CT-24, CT-25 e CT-32 sem tabela de animais.

---

## Scope

**In:** Dublês em memória de `SpeciesRepository` e `SpeciesUsageCounter`, extensão do duplo de Prisma com o armazém de espécies, specs unitários dos quatro services (co-locados) e a suíte de integração HTTP das quatro rotas.

**Out:** Não alterar nenhum arquivo de `src/domains/species/` — se um teste exigir mudança de produção, reportar em vez de ajustar o código para passar. Não alterar `jest.config.ts` (os `roots`, o `moduleNameMapper` e o limiar de 80% já cobrem o novo domínio) nem `tests/setup.ts`. Não escrever teste de acessibilidade, de tela ou de desempenho (RNF-04 a RNF-10 são verificados no frontend ou em homologação). Não subir banco real: a suíte roda contra o duplo de Prisma, como a de autenticação.

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `tests/fakes/in-memory-species.repository.ts` | dublê de repositório |
| `create` | `tests/fakes/fake-species-usage-counter.ts` | dublê de contagem |
| `modify` | `tests/fakes/prisma-double.ts` | armazém de espécies |
| `create` | `src/domains/species/services/create-species.service.spec.ts` | CT de criação |
| `create` | `src/domains/species/services/rename-species.service.spec.ts` | CT de renomeação |
| `create` | `src/domains/species/services/delete-species.service.spec.ts` | CT de exclusão |
| `create` | `src/domains/species/species-name.spec.ts` | CT de normalização |
| `create` | `tests/integration/species-routes.spec.ts` | CT das quatro rotas |

---

## Implementation

> **Reference pattern**: `tests/fakes/in-memory-user.repository.ts` (dublê à mão, PT-BR, com `Restauravel`), `src/domains/auth/services/register-user.service.spec.ts` (spec de service co-locado) e `tests/integration/auth-routes.spec.ts` (supertest sobre o `app`).
>
> **Estilo obrigatório em todos os arquivos**: `describe('<Sujeito>')` + `it('<CT-NN>: <asserção em PT-BR>')`, corpo dividido por `// Arrange`, `// Act`, `// Assert`. Cada teste rastreia explicitamente o CT e a RN que verifica. Nenhum `any`.

### `tests/fakes/in-memory-species.repository.ts` *(create)*
- `ArmazemDeEspecies implements Restauravel` + `InMemorySpeciesRepository implements SpeciesRepository`, com `withTransaction` devolvendo `this` — a transação não muda o comportamento em memória e fingir o contrário esconderia bugs em vez de revelá-los.
- Função `montarEspecie(dados = {})` no molde de `montarUsuario`, e `erroDeNomeDuplicado(): Prisma.PrismaClientKnownRequestError` com `code: 'P2002'` — é ela que permite testar o ramo de corrida do `create` e do `rename` sem banco.
- `listAll` deve ordenar por `nameNormalized` com `localeCompare` **desligado** (comparação binária de string minúscula), reproduzindo o `ORDER BY` do Postgres. Usar `localeCompare` aqui faria o dublê ordenar diferente do banco e os CT-13/CT-14 passariam por motivo errado.

### `tests/fakes/fake-species-usage-counter.ts` *(create)*
- Dublê controlável: `definirContagem(speciesId, quantidade)` e `countAnimalsBySpecies` devolvendo o valor definido (default `0`). `withTransaction` devolve `this`.
- É este arquivo que materializa a decisão da spec: a RN-08 é exercitada **sem** a entidade `Animal`. Comentário obrigatório apontando que ele deve continuar existindo depois da feature de animais, para os cenários de contagem que não se quer montar com dados reais.

### `tests/fakes/prisma-double.ts` *(modify)*
- Acrescentar `armazemDeEspecies` ao duplo e expor `species` (`findUnique`, `findMany`, `create`, `update`, `delete`) no `DubleDePrisma`, registrando o armazém em `reiniciarPrismaDouble()`.
- `create`/`update` devem **rejeitar** com o erro `P2002` quando `name_normalized` já existir no armazém — é o que torna CT-12 executável sem Postgres.
- `delete` deve rejeitar com `P2025` para id inexistente, e aceitar um gancho para simular `P2003` (a violação de FK que a feature de animais passará a produzir de verdade).

### `src/domains/species/services/create-species.service.spec.ts` *(create)*
- CT-01, CT-02, CT-03, CT-04, CT-05, CT-06, CT-07 (validação exercitada pelo schema, via `createSpeciesSchema.safeParse`), CT-08, CT-09, CT-10, CT-11.
- CT-12 em dois testes distintos e ambos obrigatórios: (a) conflito detectado pela consulta prévia; (b) conflito vindo do `P2002` do repositório. Os dois devem produzir `SpeciesNameAlreadyExistsError` com o mesmo `code` — é essa igualdade que a RN-16 exige.

### `src/domains/species/services/rename-species.service.spec.ts` *(create)*
- CT-16 (com asserção explícita de que o `id` devolvido é idêntico ao de entrada — RN-15), CT-17, CT-18, CT-19, CT-20.
- Teste dedicado para o ramo em que `findByNameKey` devolve a **própria** espécie: deve responder sucesso, e não conflito (RN-07). Sem ele, uma implementação que compare apenas as chaves e ignore o `id` passa despercebida.

### `src/domains/species/services/delete-species.service.spec.ts` *(create)*
- CT-22, CT-27 e os três cenários centrais:
  - **CT-24**: contador dublado em `1` → `SpeciesInUseError`;
  - **CT-25**: após CT-24, o armazém de espécies contém exatamente os mesmos registros de antes — asserção sobre o estado, não sobre a chamada;
  - **CT-26**: contador voltando a `0` → exclusão concluída.
- Teste do ramo `P2003`: contador em `0`, repositório rejeitando com `P2003` → o service responde `SpeciesInUseError` (mesmo `code` e mesma mensagem), nunca deixa o erro do Prisma escapar (RN-09 / CA-15).
- Teste de que o erro é lançado **de dentro** da transação (a callback do `$transaction` rejeita), usando `criarPrismaComTransacao`.

### `src/domains/species/species-name.spec.ts` *(create)*
- Testes de tabela para `normalizeSpeciesName` e `speciesNameKey`: espaços nas extremidades, espaços internos repetidos, tabulação, string só de espaços, preservação de caixa, preservação de acento e distinção `"Réptil"` / `"Reptil"` (RN-03 / RN-04 / RN-05 / CT-10 / CT-11).
- Spec **co-locado** em `src/` e não em `tests/unit/`: o módulo é regra de domínio, não infraestrutura transversal.

### `tests/integration/species-routes.spec.ts` *(create)*
- Supertest sobre o `app`, no molde de `auth-routes.spec.ts`.
- Cobertura obrigatória:
  - CT-13, CT-14, CT-15 no `GET`, incluindo a asserção de que o corpo é `{ items: [...] }` e de que **nenhum** item traz `nameNormalized`;
  - CT-01, CT-33 no `POST`;
  - CT-16, CT-20, CT-34 no `PATCH`;
  - CT-22, CT-24, CT-27, CT-32, CT-34 no `DELETE`, com o contador injetado por dublê na fábrica do controller;
  - **CT-30 e CT-31 como testes de tabela sobre os quatro endpoints**: um caso por endpoint sem `Authorization` (`401 SESSION_EXPIRED`) e um caso por endpoint com sessão de `cliente` (`403 FORBIDDEN`). Oito asserções no total — a RNF-01 pede um caso por endpoint por situação, e um teste só que cubra uma rota não satisfaz o critério.
- Asserção transversal: toda resposta de erro tem a forma `{ error: { code, message } }`, com `details` presente **apenas** nas falhas de validação (RNF-11 / CA-22).
- **Regressão da FEATURE-002** no mesmo arquivo ou em bloco `describe` próprio: reexecutar os cenários de acesso a rota protegida sem sessão e de renovação de sessão, confirmando que `tests/integration/auth-routes.spec.ts` continua passando sem alteração e que nenhum `code` ou mensagem existente mudou.

---

## Acceptance Criteria

- [ ] **Given** `npm test` na raiz de `services/backend`, **When** a suíte inteira roda, **Then** todos os testes passam e a cobertura global permanece ≥ 80% em statements, branches, functions e lines.
- [ ] **Given** a suíte, **When** cada `it` é lido, **Then** o título começa pelo identificador do caso de teste da spec (`CT-NN`) e o corpo está dividido em `// Arrange`, `// Act`, `// Assert`.
- [ ] **Given** os testes executados em ordem aleatória (`--randomize`), **When** repetidos, **Then** o resultado é idêntico — nenhum teste depende de estado deixado por outro.
- [ ] **Given** o dublê de contagem definido em `1`, **When** o service de exclusão é executado, **Then** `SpeciesInUseError` é lançado e o armazém de espécies permanece com o mesmo conteúdo (CT-24 / CT-25).
- [ ] **Given** o repositório rejeitando com `P2003`, **When** a exclusão é executada com contador em `0`, **Then** a resposta é `409 SPECIES_IN_USE` — o erro do Prisma nunca chega ao cliente (CA-15).
- [ ] **Given** o repositório rejeitando com `P2002`, **When** a criação é executada, **Then** a resposta é `409 SPECIES_NAME_ALREADY_EXISTS`, idêntica à do conflito detectado por consulta prévia (CT-12 / RN-16).
- [ ] **Given** a suíte de integração, **When** os quatro endpoints são chamados sem credencial e depois com sessão de `cliente`, **Then** existem 4 asserções de `401 SESSION_EXPIRED` e 4 de `403 FORBIDDEN` (CT-30 / CT-31 / CA-18 / RNF-01).
- [ ] **Given** a suíte de autenticação existente, **When** executada após esta task, **Then** passa sem nenhuma alteração nos seus arquivos, e nenhum `code` ou mensagem da FEATURE-002 mudou.
- [ ] Nenhum arquivo de `src/domains/species/` foi modificado por esta task.
- [ ] Nenhum teste usa `new Date()` diretamente para verificar instantes — o relógio é espionado por `~/utils/clock`.

---

## Dependencies

- **Requires**: TASK-BACKEND-001 a TASK-BACKEND-004 (todo o backend da feature implementado).
- **Blocks**: nenhuma task de implementação. É pré-requisito do Quality Gate do Sonar da feature.
