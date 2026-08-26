# TASK-BACKEND-011 — Suíte de testes do backend da feature

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-011-backend-test-suite`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/spec_context.md`
**Part**: 11 of 18 — Testes do Backend
**Generated**: `2026-08-25`

---

## Context

Fecha o critério de qualidade no lado servidor: 80% de cobertura nas classes alteradas e rastreabilidade direta entre os CT da spec e os testes automatizados. A configuração do Jest, o `tests/setup.ts` e os fakes de repositório já existem desde a FEATURE-002 do MODULE-001 — esta task acrescenta, não refunda.

---

## Scope

**In:** Fakes em memória dos repositórios de animal, imagem e geografia; fixtures de arquivo (JPEG, PNG, SVG, GIF, PDF, executável, 0 byte, 5 MB, 5 MB + 1 byte); specs unitários dos services de animal e de geografia; specs unitários da idade e da assinatura binária; spec de integração das rotas de animal e de geografia.

**Out:** A quitação da dívida da FEATURE-001 tem suíte própria e roda contra banco real (TASK-BACKEND-010) — **não** duplicar aqueles casos aqui. Nenhum teste desta task abre socket nem toca no Supabase real: o armazenamento é sempre o `FakeImageStorage`. Sem testes de frontend (TASK-FRONTEND-018). Sem E2E — fora do escopo do projeto. Não alterar arquivo de `src/` para facilitar teste; se algo não for testável, reportar em vez de refatorar por conta própria.

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `tests/fakes/in-memory-animal.repository.ts` | fake de animals |
| `create` | `tests/fakes/in-memory-geography.repository.ts` | fake de states/cities |
| `create` | `tests/fixtures/image-fixtures.ts` | arquivos de teste |
| `create` | `src/domains/animals/services/create-animal.service.spec.ts` | HU-03, HU-05 |
| `create` | `src/domains/animals/services/update-animal.service.spec.ts` | HU-06 |
| `create` | `src/domains/animals/services/change-animal-status.service.spec.ts` | HU-07 |
| `create` | `src/domains/animals/services/delete-animal.service.spec.ts` | HU-08 |
| `create` | `src/domains/animals/services/list-animals.service.spec.ts` | HU-02 |
| `create` | `tests/unit/age.spec.ts` | idade derivada |
| `create` | `tests/unit/image-signature.spec.ts` | assinatura binária |
| `create` | `tests/integration/animals-routes.spec.ts` | contrato HTTP |
| `create` | `tests/integration/geography-routes.spec.ts` | contrato HTTP |

---

## Implementation

> **Reference pattern**: `tests/integration/auth-routes.spec.ts` e `src/domains/auth/services/register-user.service.spec.ts` definem o formato — `it('<CT-NN>: <asserção em PT-BR>')`, AAA explícito, asserção sobre a mensagem literal quando ela é o contrato. `tests/fakes/in-memory-user.repository.ts` define o formato dos fakes: implementam a **interface**, nunca `jest.mock` do módulo.

### `tests/fakes/in-memory-animal.repository.ts` *(create)*
**Diferenças em relação ao referencial:**
- Precisa reproduzir fielmente três comportamentos, senão os testes passam e a produção quebra:
  1. `updateIfUnchanged` devolve `0` quando o `updatedAt` esperado não bate — é o que sustenta o bloqueio otimista.
  2. A ordenação de `listPaginated` aplica os **três** critérios (`nameNormalized`, `createdAt desc`, `id`). Um fake que ordena só por nome faria o CT-26 passar por acidente e a paginação continuar não determinística em produção.
  3. `delete` remove em cascata as imagens do animal, como a FK faz.

### `tests/fixtures/image-fixtures.ts` *(create)*
- Buffers construídos **em código**, a partir dos bytes de assinatura, e não arquivos binários commitados: `jpegBuffer(sizeBytes)`, `pngBuffer(sizeBytes)`, `gifBuffer()`, `pdfBuffer()`, `svgBuffer()` (com `<script>` embutido), `elfBuffer()`, `emptyBuffer()`.
- Um JPEG de 5 MB gerado por preenchimento custa milissegundos e não pesa no repositório. Commitar dez arquivos binários de megabytes tornaria o clone caro para sempre.
- Cada fixture carrega o `originalname` hostil quando o caso pede: `../../../etc/passwd.jpg`, nome com emoji, nome de 300 caracteres.

### Specs unitários dos services *(create)*
- `create-animal.service.spec.ts` — CT-01 a CT-22 (o que é regra de service), CT-45 a CT-47, CT-51 a CT-57. O caso que não pode faltar é o **CT-55**: `failUploadOnNthCall(3)` no `FakeImageStorage` com cinco imagens, verificando que o banco ficou no estado anterior **e** que `FakeImageStorage` está vazio ao final.
- `update-animal.service.spec.ts` — CT-58 a CT-66, com atenção ao trio do limite sobre o estado final (CT-48, CT-49a, CT-49b) e ao CT-62 (imagem de outro animal).
- `change-animal-status.service.spec.ts` — CT-69 a CT-73, incluindo as **doze** transições do CT-70 como `it.each`.
- `delete-animal.service.spec.ts` — CT-76, CT-78, CT-79 (com `failRemove()`: a resposta continua sendo sucesso e o log registra os caminhos), CT-80.
- `list-animals.service.spec.ts` — CT-25, CT-26, CT-28, CT-29.
- Cada `it` nomeado pelo ID do caso: `it('CT-55: falha ao gravar a terceira imagem não deixa animal nem arquivo', ...)`.

### `tests/unit/age.spec.ts` *(create)*
- CT-18, CT-19, CT-20 e o caso do RNF-10: `TZ=UTC` no processo, relógio às 22h de São Paulo (01h do dia seguinte em UTC), data de hoje aceita e idade `0`.
- Verificar explicitamente que `null` e `0` são resultados distintos (RN-21).

### `tests/unit/image-signature.spec.ts` *(create)*
- CT-52 e CT-53: GIF, PDF, executável e **SVG** renomeados para `.jpg` com `mimetype` declarado `image/jpeg` — os quatro devolvem `null`.
- O caso inverso, que prova que a decisão é do conteúdo nos dois sentidos: JPEG válido com nome `.txt` e `mimetype` `text/plain` devolve `image/jpeg`.

### `tests/integration/animals-routes.spec.ts` *(create)*
- Contrato HTTP com supertest sobre `app`, incluindo o corpo `multipart/form-data` montado com `.field()` e `.attach()`.
- Cobertura obrigatória de autorização, que é o RNF-01: para **cada** um dos seis endpoints de animal, um caso sem sessão (`401 SESSION_EXPIRED`) e um com role `cliente` (`403 FORBIDDEN`) — CT-89, CT-90, CA-40.
- CT-91: as restrições de imagem verificadas por chamada direta, sem passar por nenhuma validação de interface — seis imagens, SVG renomeado e arquivo de 6 MB.
- CT-92: identificador malformado nos quatro endpoints que recebem `:id`.
- CT-13, CT-14, CT-75: campos não previstos no corpo, incluindo `status` no cadastro.
- **Regressão declarada pela spec**: um caso verificando que uma rota que recebe JSON (por exemplo `POST /api/auth/login`) continua recusando corpo acima de 10 KB — a leitura de multipart não pode ter vazado para as demais rotas.
- Um caso verificando que nenhuma resposta de erro fugiu do envelope `{ error: { code, message, details? } }` e que os nove códigos novos não colidem com os treze de autenticação já existentes (CA-43, RNF-21).

### `tests/integration/geography-routes.spec.ts` *(create)*
- CT-42, CT-43, CT-36 (com um recorte reduzido de estados e cidades semeado no `beforeAll`, não a carga completa), mais autorização nos dois endpoints.

---

## Acceptance Criteria

- [ ] **Given** `npm test`, **When** executado, **Then** todas as suítes passam e a cobertura de statements, branches, functions e lines fica em 80% ou mais nos arquivos criados ou alterados por esta feature.
- [ ] **Given** a suíte completa, **When** executada com a rede desligada, **Then** ela passa — nenhum teste abre socket, nem para o Supabase, nem para o SMTP.
- [ ] **Given** cada CT de backend da spec (CT-01 a CT-22, CT-25 a CT-29, CT-36, CT-42, CT-43, CT-45 a CT-58, CT-60 a CT-64, CT-66, CT-69 a CT-73, CT-75, CT-76, CT-78 a CT-80, CT-86, CT-89 a CT-92), **When** o nome dos testes é buscado, **Then** existe ao menos um `it` que o cita.
- [ ] **Given** o `FakeImageStorage` com falha na terceira chamada e cinco imagens, **When** o cadastro é executado, **Then** o teste afirma **as duas coisas**: nenhum animal no repositório e nenhum objeto no armazenamento (CT-55).
- [ ] **Given** os seis endpoints de animal e os dois de geografia, **When** os testes de autorização são contados, **Then** há um caso `401` e um caso `403` para cada um (RNF-01).
- [ ] **Given** a suíte de autenticação e a de espécies já existentes, **When** executadas depois desta feature, **Then** continuam verdes sem alteração (regressão declarada).
- [ ] **Given** o relatório `lcov`, **When** o Sonar o consome, **Then** o Quality Gate passa sem bloqueadores e sem issue de segurança Blocker ou Critical.

---

## Dependencies

- **Requires**: TASK-BACKEND-005 a TASK-BACKEND-009 (tudo o que é testado), TASK-BACKEND-004 (`FakeImageStorage`), TASK-BACKEND-003 (`detectImageMimeType`).
- **Blocks**: nenhuma task. Fecha o critério de qualidade do backend.
