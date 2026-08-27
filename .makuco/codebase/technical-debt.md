# Dívida Técnica

> Registro vivo. Uma entrada por dívida conhecida, **incluindo as já quitadas**.
> Entrada quitada não é apagada: o histórico é o que impede a mesma dívida de ser
> recontraída por desconhecimento.

Este arquivo existe por causa da FEATURE-001 do MODULE-002. A regra mais
importante daquela feature — "espécie com animais vinculados não pode ser
excluída" — nasceu verificável **apenas por dublê**, porque a entidade `Animal`
ainda não existia, e a única coisa que impediu isso de virar uma lacuna
permanente foi um `TODO` bem escrito em um arquivo que alguém precisava abrir.
Um `TODO` não é um registro: ele é encontrado por acaso.

## Como ler

| Campo | Significado |
|---|---|
| **Estado** | `QUITADA` \| `ABERTA` \| `PREVENTIVA` (registrada antes de ser contraída) |
| **Contraída em** | Quando a decisão que criou a dívida foi tomada |
| **Consequência** | O que quebra, ou fica sem verificação, enquanto ela existir |
| **Condição de quitação** | O que precisa ser verdade para a entrada mudar para `QUITADA` |

---

## DT-01 — Integridade referencial de espécie verificada apenas por dublê

- **Estado**: `QUITADA` em 2026-08-27
- **Contraída em**: 2026-08-22, FEATURE-001 do MODULE-002 (Cadastro de espécies)
- **Quitada por**: TASK-BACKEND-010 da FEATURE-002 do MODULE-002
  (`.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/tasks/task_010_backend_integridade_especie_pedidos.md`)

**O que era.** A RN-08/RN-09 da FEATURE-001 exige duas camadas: a verificação da
aplicação (contar animais vinculados antes de excluir) e a integridade
referencial do banco. Nenhuma das duas podia ser verificada contra dados reais
quando foi escrita — a tabela `animals` não existia, a chave estrangeira
`animals.species_id` não existia, e o `@prisma/client` gerado nem exportava o
modelo. `PrismaSpeciesUsageCounter` respondia `0` sem consultar nada, e o `P2003`
da camada 2 era código literalmente inalcançável em produção.

**Consequência enquanto durou.** A regra central da feature ficou verde por
concordância entre dublês. Um erro de modelagem na FK — `Cascade`, que apagaria
animais em silêncio, ou `SetNull`, que produziria animais sem classificação —
não teria sido percebido por nenhum teste daquela feature.

**Como foi quitada.**

1. `services/backend/src/domains/species/repositories/species-usage-counter.ts`
   passou a consultar a tabela real (`this.db.animal.count({ where: { speciesId } })`),
   dentro da transação aberta pelo `DeleteSpeciesService`.
2. A chave estrangeira foi conferida no catálogo do Postgres, e não no arquivo de
   migration: `pg_constraint.confdeltype` de `animals_species_id_fkey` é `'r'`
   (`ON DELETE RESTRICT`). Para contraste, `animal_images_animal_id_fkey` é `'c'`
   (`ON DELETE CASCADE`) — a imagem não tem existência própria fora do animal
   (RN-55), enquanto o animal tem existência própria fora da espécie.
3. Os casos CT-24, CT-25, CT-26 e CT-32 daquela spec foram **reexecutados contra
   o banco real** como CT-81, CT-82, CT-83 e CT-84 em
   `services/backend/tests/integration/species-animal-integrity.spec.ts`, sem
   nenhum dublê de repositório (CA-38). O CT-85 e o CT-86 acrescentam o que
   aquela feature não tinha como escrever: a recusa do próprio Postgres
   (`23503`) e a proteção da cidade referenciada (RN-29).

**O que ficou como lição.** Os dois testes que fixavam por escrito o
comportamento provisório (`describe('PrismaSpeciesUsageCounter …')` em
`delete-species.service.spec.ts`) **reprovaram** no commit que apontou a contagem
à tabela real — que é exatamente o desfecho para o qual foram escritos. Eles não
foram afrouxados para voltar ao verde: foram reescritos uma altura acima, medindo
a delegação (qual comando, com qual filtro, sobre qual conexão) em vez de um valor
constante. **Um teste que caracteriza um provisório precisa quebrar quando o
provisório sai.**

---

## DT-02 — Vínculo de pedido para animal (módulo de Pedidos)

- **Estado**: `PREVENTIVA` — registrada **antes** de ser contraída
- **Registrada em**: 2026-08-27, TASK-BACKEND-010 da FEATURE-002 do MODULE-002
- **Referência**: RN-17b

**Por que esta entrada existe antes do código.** Foi a omissão equivalente que
fez a FEATURE-001 conviver com a sua regra mais importante verificável apenas por
dublê. O módulo de Pedidos vai repetir a mesma forma — uma entidade que
referencia `Animal`, uma regra de exclusão que depende desse vínculo, e um
intervalo entre escrever a regra e poder verificá-la com dados reais. Repetir o
mesmo erro em silêncio, sabendo dele, seria pior do que cometê-lo pela primeira
vez.

**O que o módulo de Pedidos NÃO pode fazer.**

1. A chave estrangeira de pedido para animal nasce **`onDelete: Restrict`**.
   **Jamais `Cascade`** — apagaria pedidos ao excluir um animal, destruindo
   histórico de negócio. **Jamais `SetNull`** — produziria pedido sem animal, que
   é um registro que não descreve nada. A regra é herdada da RN-08/RN-09 da
   FEATURE-001 e não é renegociável.
2. A regra "animal referenciado por algum pedido não pode ser excluído" precisa
   ser verificada **contra dados reais**, e não com dublê. Se o dublê for o que
   estiver disponível quando a regra for escrita, ele é aceitável **desde que**
   uma entrada `ABERTA` seja acrescentada aqui no mesmo commit, com a task que a
   quitará já nomeada.
3. A verificação no catálogo é feita sobre `pg_constraint.confdeltype`, e não
   lendo o arquivo de migration: o que vale é o que está no banco.

**Consequência declarada.** `DeleteAnimalService` ganhará a mesma estrutura de
duas camadas de `DeleteSpeciesService` — a camada 1 produz a mensagem de negócio
correta em PT-BR no caso comum, e a camada 2 traduz a violação de FK (`P2003`)
para o mesmo erro de domínio, nunca para um `500`. As duas são obrigatórias e
independentes: a camada 1 sozinha não sobrevive à concorrência (um pedido criado
entre a contagem e o `DELETE`), e a camada 2 sozinha não produz mensagem de
negócio.

**Condição de quitação.** O módulo de Pedidos **não pode ser considerado
concluído** sem os três itens acima verificados. Enquanto não estiverem, esta
entrada passa a `ABERTA` e permanece bloqueando a conclusão do módulo.

---

## DT-03 — `objetoSemCamposExtras` do domínio `auth` consulta a cadeia de protótipos

- **Estado**: `ABERTA`
- **Contraída em**: FEATURE-002 (Autenticação completa)
- **Arquivo**: `services/backend/src/domains/auth/auth.validators.ts`, função
  `objetoSemCamposExtras`

**O que é.** A guarda de "campo não permitido" testa `if (!(chave in forma))`. O
operador `in` percorre a **cadeia de protótipos** do objeto de forma, e não
apenas as chaves próprias. Isso faz com que `toString`, `constructor`, `valueOf`,
`hasOwnProperty` e `isPrototypeOf` sejam aceitos como se fossem campos
declarados do schema: um corpo `{ "name": "...", "toString": "x" }` passa pela
guarda que existe para recusá-lo (RN-12).

**Impacto real.** Baixo e não explorável hoje: o schema segue `.passthrough()`,
os campos herdados não são lidos por nenhum service e o valor não é persistido.
O que se perde é a recusa que o critério de aceite promete, para um conjunto
pequeno e fixo de nomes.

**Correção.** Uma palavra: `Object.hasOwn(forma, chave)` no lugar de
`chave in forma`. O mesmo furo foi **corrigido** quando descoberto em
`species.validators.ts` e em `animals.validators.ts`, que já usam
`Object.hasOwn` — este arquivo é o único que restou.

**Por que continua aberta.** O domínio `auth` está fora do escopo do MODULE-002.
Alterá-lo em uma task de catálogo de pets misturaria escopos e faria a revisão
desta task discutir autenticação. A divergência entre os três arquivos, porém, é
pior do que o furo: quem ler `auth.validators.ts` depois de ler
`species.validators.ts` vai supor que a diferença é deliberada.

**Condição de quitação.** Trocar por `Object.hasOwn` e acrescentar um caso em
`tests/integration/auth-routes.spec.ts` que envie `toString` no corpo do registro
e espere `400` com `code` de campo não permitido. Deve entrar na primeira task
que já toque o domínio `auth` por outro motivo.
