# Bug report — `makuco-mcp` v1.0.9 · tool `sonar-run`

**Reportado por**: Alexandre Simões de Melo (alexandre.melo@db1.com.br)
**Data**: 2026-08-20
**Pacote**: `makuco-mcp@1.0.9` (`https://package.makuco.com.br/makuco-mcp/latest.tgz`)
**Arquivo**: `dist/tools/run-sonar/index.js` (fonte: `src/tools/run-sonar/index.ts`)
**Ambiente**: Ubuntu, kernel 6.4.9-060409-generic · Docker 20.10.17 · Node v20.20.2 · SonarQube 26.5.0.122743 · `sonar-scanner-cli` 8.0.1.6346
**Severidade**: 1 bloqueante · 1 de segurança · 2 funcionais

São **quatro defeitos independentes** no mesmo tool. O item 1 é o que impede o uso; os outros três foram encontrados durante a investigação e valem correção junto.

---

## 1. BLOQUEANTE — `docker run` sem propagação de resolução de nomes

### Sintoma

Toda chamada a `sonar-run` falha:

```
ERROR Failed to query server version:
Call to URL [http://sonar.anymarket.vpc:9000/api/v2/analysis/version] failed: HTTP connect timed out
EXECUTION FAILURE — Total time: 6.013s
```

### Causa raiz

O tool monta o container **sem** `--network host` e **sem** `--add-host` (`dist/tools/run-sonar/index.js`, linhas 94–106):

```js
const sonarArgs = [
  "run", "--rm",
  "-e", `SONAR_HOST_URL=${sonarUrl}`,
  "-e", `SONAR_TOKEN=${sonarToken}`,
  "-v", `${root}:/usr/src`,
  "-v", "/tmp/empty-mysql:/usr/src/mysql",
  "sonarsource/sonar-scanner-cli"
];
```

Na bridge padrão o container não recebe o `/etc/hosts` do host, e o Docker remove o stub
`127.0.0.53` (systemd-resolved) do `/etc/resolv.conf`, deixando apenas o DNS corporativo.
Esse DNS resolve o host do Sonar para um **endereço obsoleto**:

| Origem da resolução | `sonar.anymarket.vpc` → | Resultado |
|---|---|---|
| `/etc/hosts` do host (override local) | `10.119.10.55` | responde `200` |
| DNS corporativo `10.200.10.200` | `10.2.0.235` | **timeout** (morto) |

Portanto o container resolve o nome com sucesso — mas para o IP errado.

### Evidências (reprodutíveis)

```
# rota da bridge para a VPC: FUNCIONA
$ docker run --rm curlimages/curl -s -w '%{http_code} %{time_total}s\n' \
    -o /dev/null http://10.119.10.55:9000/api/server/version
200 0.389317s

# mesmo container, resolvendo pelo nome: FALHA
$ docker run --rm curlimages/curl -s -w '%{http_code} %{time_total}s\n' \
    -o /dev/null --max-time 12 http://sonar.anymarket.vpc:9000/api/server/version
000 12.002299s          # exit 28 (timeout)

# o que o container resolve:
$ docker run --rm --entrypoint sh curlimages/curl -c 'nslookup sonar.anymarket.vpc'
Server: 10.200.10.200
Name:   sonar.anymarket.vpc
Address: 10.2.0.235      # <-- IP obsoleto

# esse IP está morto tanto do container quanto do host:
$ curl --max-time 12 http://10.2.0.235:9000/api/server/version   # exit 28, do host
```

**Não é VPN, firewall nem indisponibilidade do servidor**: o host alcança
`http://sonar.anymarket.vpc:9000/api/server/version` → `200` / `26.5.0.122743` em 0,39 s,
e a bridge alcança o IP correto em 0,39 s.

### Correções que funcionam (ambas verificadas → `200`)

```bash
docker run --rm --network host ...                              # martelo
docker run --rm --add-host sonar.anymarket.vpc:10.119.10.55 ... # cirúrgico
```

### Sugestão

Nenhuma das duas deveria ser hardcoded. O host do Sonar já vem de `SONAR_URL`; sugerimos
uma variável de ambiente opcional (ex.: `SONAR_DOCKER_NETWORK=host` e/ou
`SONAR_DOCKER_ADD_HOST=nome:ip`) repassada aos `sonarArgs`. Alternativa mais robusta e
sem Docker: quando o `sonar-scanner` estiver no `PATH`, executá-lo direto no host — aí a
resolução de nomes é a do host e o problema desaparece por construção.

### Observação para a infra (fora do escopo do Makuco)

O registro DNS de `sonar.anymarket.vpc` aponta para `10.2.0.235`, que não responde. A
entrada em `/etc/hosts` desta máquina é um contorno local. **Qualquer colega sem essa
linha falha até no host**, não só no container. Vale um ticket separado para atualizar o DNS.

---

## 2. SEGURANÇA — `SONAR_TOKEN` exposto na linha de comando e ecoado em texto claro

O token é passado como argumento de `docker run` (linha 100) e o comando **inteiro** é
devolvido no corpo da resposta do tool (linha 117):

```js
"-e", `SONAR_TOKEN=${sonarToken}`,        // linha 100
...
`command: docker ${sonarArgs.join(" ")}`, // linha 117
```

Impacto:

1. O token fica visível em `ps aux` para **qualquer processo/usuário** da máquina enquanto o container roda.
2. Em toda falha o token é devolvido em claro para o cliente MCP — ou seja, entra no
   **contexto e no transcript do LLM**, e em qualquer log de sessão. Foi exatamente o que
   aconteceu aqui: o `squ_…` completo apareceu na mensagem de erro.

Correção sugerida:

- Passar o token via `environment` do `runCommand`, que **já suporta isso** (linha 28:
  `env: { ...process.env, ...environment }`), em vez de `-e` na linha de comando. O
  `sonar-scanner-cli` lê `SONAR_TOKEN` do ambiente normalmente.
- Redigir o valor antes de compor o output (ex.: `SONAR_TOKEN=***`).

Como o token vazou, ele deve ser rotacionado — já foi, neste caso.

---

## 3. FUNCIONAL — `targetPath` é silenciosamente ignorado

O schema declara `targetPath` (linha 81), mas o handler desestrutura `target` (linha 85):

```js
var runSonarQubeSchema = { repoRoot: …, targetPath: z.string().optional()… };  // linha 79-82
async function runSonarQube({ repoRoot, target }) { … }                        // linha 85
if (target) { sonarArgs.push(`-Dsonar.inclusions=${target}`); }                // linha 107
```

O SDK entrega os argumentos validados com as chaves **do schema**, então `target` é sempre
`undefined` e `-Dsonar.inclusions` **nunca** é adicionado. O parâmetro é morto.

Confirmado empiricamente: a chamada
`sonar-run(repoRoot="…/catdog-alexandre-melo", targetPath="services/backend/src")`
produziu o comando abaixo — sem `-Dsonar.inclusions`:

```
docker run --rm -e SONAR_HOST_URL=… -e SONAR_TOKEN=… \
  -v …/catdog-alexandre-melo:/usr/src -v /tmp/empty-mysql:/usr/src/mysql \
  sonarsource/sonar-scanner-cli
```

Correção: renomear a desestruturação para `targetPath` (ou o campo do schema para `target`).

---

## 4. FUNCIONAL — mount hardcoded cria diretório `root:root` no repositório do usuário

A linha 104 tem um bind mount fixo, aparentemente específico de outro projeto:

```js
"-v", "/tmp/empty-mysql:/usr/src/mysql",
```

Como `/usr/src` é o repositório, o Docker cria o destino do mount **dentro do repositório
montado**, no host, como `root`. Efeito observado neste projeto:

```
$ stat -c 'owner=%U:%G mode=%a criado=%y' mysql
owner=root:root mode=755 criado=2026-08-20 11:59:40 -0300   # 1ª execução do sonar-run
```

Um diretório `mysql/` root-owned apareceu na raiz de um projeto TypeScript/Prisma que não
tem nada a ver com MySQL. O usuário não consegue removê-lo sem `sudo`, e ele aparecerá em
`git status` assim que ganhar conteúdo.

Correção: remover o mount fixo. Se a intenção era excluir uma pasta da análise, o caminho
correto é `-Dsonar.exclusions` (ou `sonar-project.properties`) — não um bind mount.

---

## Contorno em uso hoje

Enquanto os itens acima não forem corrigidos, a análise é feita fora do MCP:

```bash
docker run --rm --network host \
  -e SONAR_HOST_URL=http://sonar.anymarket.vpc:9000 \
  -e SONAR_TOKEN="$SONAR_TOKEN" \
  -v "$PWD:/usr/src" sonarsource/sonar-scanner-cli \
  -Dsonar.sources=services/backend/src \
  -Dsonar.exclusions='**/node_modules/**,**/dist/**'
```

Resultado: `ANALYSIS SUCCESSFUL`, quality gate **OK**
(projeto `catdog-alexandre-melo`, 0 bugs / 0 vulnerabilities / 0 security hotspots).
Primeira execução leva ~10 min (download dos plugins).

O tool `get-sonar-issues` do mesmo MCP **funciona normalmente** — ele fala HTTP direto do
processo Node, sem Docker, então não é afetado pelo item 1.
