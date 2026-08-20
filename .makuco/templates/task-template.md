# TASK-[SERVICE]-[ID] — [Short, precise title]

**Root**: `services/[service-name]/`
**Branch**: `feature/TASK-[SERVICE]-[ID]-[slug]`
**Spec**: `.makuco/specs/[spec-slug]/spec.md`
**Part**: [N of N — label]
**Generated**: `YYYY-MM-DD`

---

## Context

[2–3 sentences max. What + why + the single most important constraint.
Link to spec or prior task if needed — do not repeat its content here.]

---

## Scope

**In:** [Bullet list of what must be done]
**Out:** [Bullet list of what must NOT be touched — be explicit]

---

## Ubiquitous Language

> Omit this section if all terms are inferrable from the codebase.

| Business Term | Code Mapping |
|---|---|
| [Term] | [Type / service / enum / endpoint] |

---

## Files

| Action | Path | Why (≤5 words) |
|---|---|---|
| `create` | `src/components/foo/bar.tsx` | new confirmation modal |
| `modify` | `src/app/.../page.tsx` | integrate new components |
| `create` | `src/components/foo/bar.spec.tsx` | unit tests for modal |

---

## Implementation

> Per-file. State only what **diverges** from the reference pattern.
> Reference existing files instead of re-documenting known patterns.

### `[filename].tsx` *(create)*

**Reference pattern**: `src/components/[closest-existing-pattern].tsx`
**Differences from reference**:
- Props: `[propName]: [Type]` instead of `[other]`
- [Any constraint that cannot be inferred from the codebase]
- [Any non-obvious decision — e.g. "use `decimal`, not `float`, for monetary values"]

### `[filename].tsx` *(modify)*

**Reference pattern**: `src/[path-to-state-pattern].tsx` (state control pattern)
**Changes**:
- Add state: `const [target, setTarget] = useState<{ id: string; name: string } | null>(null)`
- Add conditional render of `<[NewModal]>` after the list block
- [Other specific change — reference line or block, not the full file]

---

## Acceptance Criteria

> Single source of truth for expected behavior. No duplication elsewhere.

- [ ] **Given** [context], **When** [action], **Then** [verifiable outcome]
- [ ] **Given** [context], **When** [action], **Then** [verifiable outcome]
- [ ] [Negative case] — `[role]` must NOT see `[element]` (verify by DOM absence, not style)
- [ ] [Error case] — API error → `toast.error(...)`, entity remains in list
- [ ] [Edge case] — [scenario]: [expected outcome]

---

## Authorization

> Only if non-trivial. One line per rule.

- `[role_a] | [role_b]` → can perform `[action]`
- `[role_c]` → [control] not rendered in DOM; backend enforces via `@Roles(...)`

---

## API Notes

> Omit if endpoint is already documented and no divergence exists.

- **Endpoint**: `[METHOD] /[resource]/:id`
- **Input**: [params or "none beyond auth headers"]
- **Success**: `[status]` — `[response shape]`
- **Errors**: `[4xx]` — [when]; `[4xx]` — [when]

---

## Dependencies

- **Requires**: [TASK-ID] ([what it provides])
- **Blocks**: [TASK-ID] ([what depends on this])