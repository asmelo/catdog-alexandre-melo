# TASK-BACKEND-010 — Integridade referencial: quitação da dívida da FEATURE-001 e registro da dívida do módulo de Pedidos

**Root**: `services/backend/`
**Branch**: `feature/TASK-BACKEND-010-backend-integridade-especie-pedidos`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/spec_context.md`
**Part**: 10 of 18 — Integridade Referencial
**Generated**: `2026-08-25`

---

## Context

A FEATURE-001 deste módulo entregou a sua regra mais importante — "espécie com animais vinculados não pode ser excluída" — verificável **apenas por duplo de teste**, porque a entidade Animal não existia. A HU-09 e o CA-38 fazem desta quitação **condição de conclusão** desta feature, e não um item desejável: a contagem passa a ser real e os CT-24, CT-25, CT-26 e CT-32 daquela spec são reexecutados contra a tabela real e a chave estrangeira real do Postgres. A segunda metade da task existe pelo mesmo motivo invertido: registrar a dívida equivalente do módulo de Pedidos **antes** de contraí-la (RN-17b).

---

## Scope

**In:** Substituição da consulta de contagem de animais vinculados pela implementação real; tradução da violação de chave estrangeira do Postgres para `409 SPECIES_IN_USE`; suíte de integração que exercita as duas camadas contra o banco real; registro documentado da dívida de integridade do módulo de Pedidos.

**Out:** Não alterar o contrato, a mensagem, o `code` nem o status do `DELETE /api/species/:id` — o desfecho é o mesmo que a FEATURE-001 especificou, apenas passa a ser produzido por dados reais. Não criar entidade, tabela, endpoint ou coluna de Pedido: a dívida é **registrada**, não implementada. Não relaxar nem contornar a FK `Restrict` de animal para espécie em nenhuma hipótese, inclusive em fixture de teste.

---

## Ubiquitous Language

| Business Term | Code Mapping |
|---|---|
| Espécie com animais vinculados (RN-08 da FEATURE-001) | `SpeciesInUseError` → `409 SPECIES_IN_USE` |
| Violação de chave estrangeira do Postgres | `PrismaClientKnownRequestError` com `code === 'P2003'` |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `modify` | `src/domains/species/repositories/species.repository.ts` | contagem real de animais |
| `modify` | `src/domains/species/services/delete-species.service.ts` | traduz violação de FK |
| `create` | `tests/integration/species-animal-integrity.spec.ts` | quitação contra dados reais |
| `create` | `.makuco/codebase/technical-debt.md` | dívida do módulo de Pedidos |

---

## Implementation

> **Reference pattern**: a seção "Como a RN-08 é verificada antes de a entidade Animal existir" da spec da FEATURE-001 descreve exatamente esta transição e é o contrato desta task. Os nomes concretos de arquivo do domínio de espécies vêm da implementação daquela feature — se divergirem dos listados acima, seguir os reais e manter o mesmo escopo.

### `src/domains/species/repositories/species.repository.ts` *(modify)*
**Diferenças em relação ao referencial:**
- A consulta de animais vinculados, que hoje devolve zero fixo porque a tabela não existia, passa a executar `prisma.animal.count({ where: { speciesId } })`.
- **A assinatura do método não muda.** É o que garante que os testes já escritos na FEATURE-001, que a substituem por um duplo, continuem válidos sem alteração — eles verificam a regra, e esta task troca apenas a fonte do número.
- Remover o comentário que declarava a implementação provisória. Deixá-lo faria a próxima pessoa duvidar de qual é o comportamento real.

### `src/domains/species/services/delete-species.service.ts` *(modify)*
- A primeira camada permanece como está: contar dentro da mesma transação da exclusão e, havendo ao menos um animal, lançar `SpeciesInUseError`. É esta camada que produz a mensagem correta em PT-BR.
- Acrescentar a **segunda camada**: capturar `P2003` na exclusão e traduzi-lo para o **mesmo** `SpeciesInUseError`. As duas camadas são obrigatórias (RN-09 da FEATURE-001) e independentes — se a verificação da aplicação falhar por qualquer motivo, o banco recusa e o administrador recebe a mesma resposta em vez de um `500`.
- Não trocar uma camada pela outra "porque o banco já garante". A FK garante a integridade; ela não produz mensagem de negócio.
- Nenhuma remoção em cascata de animais, em nenhuma hipótese, e nenhum animal fica com espécie nula em consequência desta operação.

### `tests/integration/species-animal-integrity.spec.ts` *(create)*
- Suíte supertest contra o **banco real**, no formato de `tests/integration/auth-routes.spec.ts`. Nenhum duplo de repositório: é a ausência de duplo que quita a dívida (CA-37).
- Nomear cada caso `it('<CT-NN>: <asserção em PT-BR>')`, referenciando os CTs desta spec **e** os da FEATURE-001 que estão sendo reexecutados.
- Casos obrigatórios:
  - **CT-81** — animal real vinculado a "Cachorro"; `DELETE /api/species/:id` responde `409 SPECIES_IN_USE` com "Não é possível excluir esta espécie porque existem animais vinculados a ela." e a espécie permanece (reexecuta o CT-24 da FEATURE-001).
  - **CT-82** — após o CT-81, a contagem de espécies e a de animais estão inalteradas e nenhum animal tem `species_id` nulo (reexecuta o CT-25).
  - **CT-83** — excluído o único animal vinculado, a exclusão da espécie conclui normalmente (reexecuta o CT-26).
  - **CT-84** — a mesma exclusão chamada diretamente à API, fora da interface, é recusada da mesma forma (reexecuta o CT-32).
  - **CT-85** — `prisma.species.delete` executado **direto no banco**, contornando o service, com animal vinculado: o Postgres recusa por violação de FK; nenhum animal é apagado e nenhum fica sem espécie. Este é o caso que prova a segunda camada e o único que precisa desviar da API de propósito.
  - **CT-86** — remoção de cidade referenciada por animal é recusada pela integridade referencial (RN-29).
- Reexecutar, na mesma suíte ou marcando como regressão, os cenários de **criação, renomeação e listagem** de espécies, que passam a conviver com registros referenciados — é exigência explícita da seção de regressão da spec.
- Limpeza entre casos respeitando a ordem de dependência: animais antes de espécies. Uma limpeza que apague espécies primeiro falha pela própria FK que a suíte está verificando — e falhar ali é sinal de que a FK funciona, não de que o teste está errado.

### `.makuco/codebase/technical-debt.md` *(create)*
- Documento curto, com uma entrada por dívida de integridade conhecida, no mesmo tom dos demais arquivos de `.makuco/codebase/`.
- **Entrada 1 — quitada por esta task:** a regra de exclusão de espécie da FEATURE-001, com a data e o link para esta task e para a suíte de integração. Registrar como quitada, não apagar: o histórico é o que impede a dívida de ser recontraída por desconhecimento.
- **Entrada 2 — contraída antes de existir:** quando o módulo de Pedidos existir, o vínculo de pedido para animal precisa nascer como chave estrangeira **`Restrict`, jamais `Cascade` nem `SetNull`**, e a regra "animal referenciado por algum pedido não pode ser excluído" precisa ser verificada **contra dados reais**, não com duplo. Consequência declarada: `DeleteAnimalService` ganhará a mesma estrutura de duas camadas de `DeleteSpeciesService`, e o módulo de Pedidos **não poderá ser considerado concluído** sem isso (RN-17b).
- Escrever a Entrada 2 agora é o ponto da task. Ela é escrita antes de a entidade existir precisamente porque foi a omissão equivalente que fez a FEATURE-001 conviver com a sua regra mais importante verificável apenas por duplo. Repetir o mesmo erro em silêncio, sabendo dele, seria pior do que cometê-lo pela primeira vez.
- Referenciar o arquivo em `MAKUCO.md` com uma linha, para que ele seja encontrado sem busca.

---

## Acceptance Criteria

- [ ] **Given** um animal real vinculado à espécie "Cachorro", **When** `DELETE /api/species/:id`, **Then** `409 SPECIES_IN_USE` com a mensagem literal da FEATURE-001, a espécie permanece cadastrada e **nenhum animal é removido, desvinculado ou alterado** (CT-81, CA-37).
- [ ] **Given** a exclusão recusada, **When** as contagens de `species` e de `animals` são conferidas, **Then** ambas estão inalteradas e nenhuma linha de `animals` tem `species_id` nulo (CT-82, RNF-05).
- [ ] **Given** o único animal vinculado excluído, **When** a espécie é excluída novamente, **Then** a operação conclui normalmente (CT-83).
- [ ] **Given** a exclusão chamada diretamente à API, fora da interface, **When** há animais vinculados, **Then** a recusa é idêntica (CT-84).
- [ ] **Given** a verificação da aplicação contornada — `delete` executado direto no Prisma —, **When** há animal vinculado, **Then** o Postgres recusa a operação, o erro é traduzido para `409 SPECIES_IN_USE` quando chega pela API, e nenhum animal é apagado (CT-85, CA-36).
- [ ] **Given** uma cidade referenciada por algum animal, **When** removida, **Then** a operação é recusada pela integridade referencial (CT-86, RN-29).
- [ ] **Given** a suíte de integração desta task, **When** o código é inspecionado, **Then** ela **não** usa nenhum duplo de repositório de espécie ou de animal — a quitação depende disso (CA-38).
- [ ] **Given** os fluxos de criar, renomear e listar espécies, **When** reexecutados com registros já referenciados por animais, **Then** continuam funcionando como antes (regressão declarada).
- [ ] **Given** `.makuco/codebase/technical-debt.md`, **When** lido, **Then** contém a dívida da FEATURE-001 marcada como quitada e a dívida do módulo de Pedidos registrada com a exigência de FK `Restrict` e de verificação contra dados reais (RN-17b).

---

## Dependencies

- **Requires**: TASK-BACKEND-001 (a FK `Restrict` real e a relação inversa ativada), TASK-BACKEND-007 (criar animal real para a fixture), TASK-BACKEND-009 (excluir o animal para liberar o CT-83), FEATURE-001 do MODULE-002 implementada.
- **Blocks**: nenhuma task. **Bloqueia a conclusão da feature**: sem esta task, a CA-38 fica em aberto e a FEATURE-002 não pode ser considerada entregue.
