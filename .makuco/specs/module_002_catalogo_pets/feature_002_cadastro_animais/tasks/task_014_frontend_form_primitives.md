# TASK-FRONTEND-014 — Primitivas de formulário: seleção, área de texto, alternância, data e botão secundário

**Root**: `services/frontend/`
**Branch**: `feature/TASK-FRONTEND-014-frontend-form-primitives`
**Spec**: `.makuco/specs/module_002_catalogo_pets/feature_002_cadastro_animais/spec_context.md`
**Part**: 14 of 18 — Base de Componentes
**Generated**: `2026-08-25`

---

## Context

A base de componentes cobre hoje apenas o formulário de autenticação: campo de texto, campo de senha, erro de campo, alerta, botão de envio e os elementos do cartão. **Não existe campo de seleção** — e o formulário desta feature precisa de quatro —, nem área de texto, nem alternância, nem seletor de data; o botão secundário existe como string de classes copiada dentro de `login-page.tsx`. Esta task cria as primitivas que faltam, seguindo a mesma anatomia de rótulo, controle e erro já estabelecida.

---

## Scope

**In:** `SelectField`, `TextareaField`, `ToggleField`, `DateField` e `SecondaryButton`, todos com rótulo, marcação de obrigatoriedade, estado de erro, estado desabilitado e acessibilidade.

**Out:** Nenhum campo de envio de imagens (TASK-FRONTEND-015). Nenhum componente de listagem — tabela, selo de status e paginação são da TASK-FRONTEND-016. Nenhuma regra de negócio nem chamada de API: são primitivas controladas, sem estado próprio além do estritamente visual. **Não instalar biblioteca alguma** — nem de formulário, nem de seleção, nem de data: a spec declara explicitamente que essa decisão de arquitetura não é tomada aqui, e o frontend tem hoje três dependências de execução.

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/components/ui/select-field.tsx` | campo de seleção |
| `create` | `src/components/ui/textarea-field.tsx` | área de texto |
| `create` | `src/components/ui/toggle-field.tsx` | alternância liga/desliga |
| `create` | `src/components/ui/date-field.tsx` | seletor de data nativo |
| `create` | `src/components/ui/secondary-button.tsx` | botão secundário |
| `modify` | `src/pages/auth/login-page.tsx` | usa o botão secundário |

---

## Implementation

> **Reference pattern**: `src/components/ui/text-field.tsx` é o molde de todos os campos — a anatomia `<label htmlFor>` + controle + `FieldError`, a associação por `aria-describedby`, o `aria-invalid` e o formato das props. `src/components/ui/submit-button.tsx` é o molde do botão.

### `src/components/ui/select-field.tsx` *(create)*
**Diferenças em relação ao referencial:**
- `<select>` nativo, não uma lista construída com `div`. O nativo já entrega navegação por teclado, busca por digitação, comportamento correto em toque e leitura por leitor de tela — reimplementar isso sem biblioteca é como se perde a RNF-16 sem perceber.
- Props: `options: ReadonlyArray<{ value: string; label: string }>`, `value`, `onChange`, `label`, `required`, `error`, `disabled`, `placeholder`.
- `placeholder` vira uma `<option value="" disabled>` — é o que permite o estado "nada escolhido" e o que faz o campo Cidade exibir "Escolha primeiro o estado" enquanto desabilitado (CT-34).
- O campo precisa distinguir três estados que a HU-04 exige: **desabilitado sem estado escolhido**, **carregando** e **povoado**. Aceitar `disabled` e um `placeholder` variável cobre os três sem prop extra de estado — a tela decide o texto.
- Rótulo com asterisco quando `required`, e o asterisco acompanhado de texto acessível: um asterisco sozinho não é anunciado como "obrigatório".

### `src/components/ui/textarea-field.tsx` *(create)*
- `<textarea>` com o mesmo contrato do `TextField`, mais `rows` e `maxLength`.
- Contador de caracteres opcional. Se exibido, ele é `aria-live="polite"` e não `assertive` — um contador que interrompe o leitor de tela a cada tecla torna o campo inutilizável.
- `maxLength` no elemento **não** substitui a validação: o limite de 1000 vale sobre o texto normalizado e é verificado no servidor (RN-23). Aqui é conveniência.

### `src/components/ui/toggle-field.tsx` *(create)*
- `<input type="checkbox">` real, visualmente estilizado como alternância — **não** uma `div` com `role="switch"` construída à mão. O input nativo é focável, alternável por espaço e anunciado pelo leitor de tela sem trabalho adicional.
- Props: `label`, `checked`, `onChange`, `disabled`. Sem estado interno: é controlado, e os dois indicadores nascem `false` (RN-24).
- Estado ligado em roxo, conforme a captura. Usar os tokens já declarados na configuração de estilos — roxo `#7c3aed`, laranja `#e05a1e` e fonte Nunito, conforme a referência visual do projeto —, nunca cores escritas à mão no componente (RNF-20).
- O estado **não** pode ser comunicado apenas por cor: a posição do indicador e o rótulo associado carregam a informação (RNF-17, RNF-18).

### `src/components/ui/date-field.tsx` *(create)*
- `<input type="date">` nativo, como na captura. Sem biblioteca de data e sem máscara de digitação.
- Valor no formato `AAAA-MM-DD`, que é o que o input nativo produz e consome e é exatamente o formato do contrato — **nenhuma conversão de fuso acontece no cliente**. Converter para `Date` e de volta é como um nascimento em 05/11 vira 04/11 para quem está a oeste de Greenwich.
- Aceitar `min` e `max` como conveniência de interface; a recusa que vale é a do servidor (RN-19).

### `src/components/ui/secondary-button.tsx` *(create)*
- Extrair a string de classes hoje duplicada dentro de `login-page.tsx` para um componente com o mesmo contrato de `SubmitButton` (`isLoading`, `disabled`, `children`).
- Contraste do texto sobre o fundo em no mínimo 4.5:1 e indicador de foco visível em no mínimo 3:1 (RNF-18).

### `src/pages/auth/login-page.tsx` *(modify)*
- Substituir a string de classes copiada pelo novo componente. É a única alteração no arquivo — nenhum comportamento da tela de login muda, e a suíte existente precisa continuar passando sem edição.

---

## Acceptance Criteria

- [ ] **Given** um `SelectField` com `label` e `required`, **When** renderizado, **Then** o rótulo está associado ao `<select>` por `htmlFor`/`id` e a obrigatoriedade é anunciada por texto, não apenas pelo asterisco.
- [ ] **Given** um `SelectField` com `error`, **When** renderizado, **Then** o `<select>` tem `aria-invalid="true"` e `aria-describedby` apontando para o `FieldError`.
- [ ] **Given** um `SelectField` desabilitado com `placeholder="Escolha primeiro o estado"`, **When** renderizado, **Then** o texto aparece e o controle não aceita escolha (CT-34).
- [ ] **Given** um `SelectField`, **When** operado só por teclado, **Then** é possível focar, abrir, escolher e confirmar sem mouse (RNF-16).
- [ ] **Given** um `ToggleField` com `checked={false}`, **When** o usuário aciona espaço com o controle focado, **Then** `onChange` é chamado com `true` e o componente não guarda estado próprio.
- [ ] **Given** um `ToggleField`, **When** lido por leitor de tela, **Then** o rótulo e o estado ligado/desligado são anunciados — o estado não é comunicado apenas por cor (RNF-17).
- [ ] **Given** um `DateField` com valor `"2022-11-05"`, **When** renderizado e lido de volta, **Then** o valor é exatamente `"2022-11-05"` em qualquer fuso do navegador — nenhuma conversão acontece.
- [ ] **Given** um `TextareaField` com `maxLength`, **When** o contador é exibido, **Then** ele é `aria-live="polite"`.
- [ ] **Given** a tela de login, **When** a suíte existente é executada após a substituição do botão, **Then** ela passa sem nenhuma alteração no arquivo de teste.
- [ ] **Given** `package.json`, **When** comparado ao estado anterior, **Then** as dependências de execução continuam sendo exatamente três.

---

## Dependencies

- **Requires**: nenhuma task desta feature.
- **Blocks**: TASK-FRONTEND-017 (o formulário é montado com estas primitivas), TASK-FRONTEND-016 (o campo da coluna ALTERAR STATUS é um `SelectField`).

---

## Revisão — 2026-08-28

**Status**: APROVADO

| Critério de aceite | Resultado |
|---|---|
| `SelectField`: rótulo por `htmlFor`/`id`, obrigatoriedade por texto | **Confirmado.** `getByLabelText` alcança o `<select>`; o asterisco é `aria-hidden` e quem anuncia é o `<span class="sr-only"> (obrigatório)</span>`. Verificado na TASK-FRONTEND-018 (`select-field.spec.tsx`) |
| `SelectField` com erro: `aria-invalid` e `aria-describedby` | **Confirmado**, apontando o `id` do `FieldError`. Verificado na 018 |
| `SelectField` desabilitado com placeholder (CT-34) | **Confirmado.** A `<option value="" disabled>` aparece e o controle não aceita escolha. Verificado na 018 |
| `SelectField` só por teclado (RNF-16) | **Confirmado.** `tab` foca e `selectOptions` escolhe — comportamento do `<select>` nativo, que é a razão de não haver lista construída à mão. Verificado na 018 |
| `ToggleField`: espaço chama `onChange(true)` e não guarda estado | **Confirmado.** Após o espaço, `onChange` recebe `true` e o controle continua desligado, porque a prop não mudou. Verificado na 018 |
| `ToggleField`: estado não comunicado só por cor (RNF-17) | **Confirmado.** Três canais: posição do disco, estado nativo do input (`role="switch"` → "ligado/desligado") e rótulo associado |
| `DateField` preserva `"2022-11-05"` em qualquer fuso | **Confirmado** em `date-field.spec.tsx`, incluindo a ida e volta por um harness controlado de verdade |
| Contador do `TextareaField` é `aria-live="polite"` | **Confirmado** em `textarea-field.spec.tsx` |
| Suíte de login verde sem alterar o arquivo de teste | **Confirmado.** `login-page.spec.tsx` **não foi tocado**; 354 testes verdes em 25 suítes |
| Dependências de execução continuam três | **Confirmado.** `react`, `react-dom`, `react-router-dom`. `package.json` sem diff |

### Decisões de implementação que a task não previa

**1. `field-shell.tsx`, um arquivo a mais que a tabela.** As quatro primitivas de campo repetiriam, cada uma, as mesmas quatro decisões: o `<label htmlFor>` casando com o `id`, o asterisco decorativo com texto acessível ao lado, o par `aria-invalid`/`aria-describedby` e o tratamento de `''` como ausência de erro. Quatro cópias divergem na primeira correção — e o que divergiria é justamente a parte de acessibilidade, que é a que ninguém vê quebrar. O `FieldShell` **não** substitui o `TextField`: naquele o rótulo é `sr-only` por decisão de layout do mockup de login, e aqui é visível, como a captura do formulário de animal mostra. São anatomias diferentes de propósito.

**2. Estrutura do `ToggleField` corrigida durante a implementação.** A primeira montagem punha o trilho dentro de um `<label>` irmão do input. A variante `peer` do Tailwind gera um combinador de irmãos (`~`), que **não** atravessa para dentro de outro elemento — o `peer-focus-visible:shadow-focus-ring` no trilho aninhado simplesmente não teria efeito, e o controle ficaria **sem indicador de foco no teclado**. É a falha de acessibilidade mais fácil de não notar, porque no mouse tudo funciona. Corrigido envolvendo input, trilho e texto num único `<label>`: o trilho passa a ser irmão direto do input e o clique em qualquer ponto da linha continua alternando.

**3. `role="switch"` sobre o checkbox nativo.** Muda o anúncio de "marcado/não marcado" para "ligado/desligado", que é o vocabulário correto para uma alternância, sem abrir mão de nada do comportamento nativo.

**4. `SecondaryButton` nasce com `type="button"`.** Dentro de um `<form>` o default do HTML é `submit`, e um "Cancelar" que envia o formulário é o defeito clássico deste componente — que a TASK-FRONTEND-017 encontraria. Continua sobrescritível pelo `...rest`.

**5. `value ?? ''` no `SelectField`.** Sem isso o React alterna entre controlado e não controlado quando a tela limpa a escolha, e o aviso aparece no console junto com um campo que para de responder ao estado.

**6. `date-field.spec.tsx` e `textarea-field.spec.tsx` criados aqui**, e não na 018: os dois critérios que eles cobrem não aparecem na lista de arquivos daquela task, então ficariam sem verificação em lugar nenhum. Os de `SelectField` e `ToggleField` ficaram na 018, que já os previa.
