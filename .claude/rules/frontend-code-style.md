---
paths:
  - "frontend/**"
---

# Frontend code style (React + Vite + TS + TanStack Query + Tailwind, React Compiler on)

## Where things go

| What | Where |
|---|---|
| A page | `pages/<feature>/<route>/index.tsx` + its `hooks.ts` (+ `_components/` used by that page only) |
| Shared UI | `src/_components/` (`DataTable`, `KpiTile`, `ConfirmDialog`, `FormField`, `GaugeTiles`, `MembersSection`, …) |
| Every backend call | `api/api.ts`: read `API.<group>.<action> = { url, key }`, write `{ url, refreshes }`; after a write `refresh(qc, API.x.write)` |
| A read used by 2+ pages | `hooks/sharedQueries.ts`, one hook per query |
| List filters + sort + page | `hooks/useListFilters.ts`; the date range is shared (`useGlobalDateRange`, `setRange(from, to)` both at once) |
| Numbers / dates on screen | `utils/format.tsx` only (`formatMAD`, `formatQty`, `formatPct`, `formatDate`, `formatDateTime`); never `toLocaleString` / `toFixed` |
| Client-side search | `utils/text.ts` `matchesFields` (accents, several words, `*`) |
| Text | `i18n/locales/fr.ts` + `es.ts`, same keys in both |
| Excel | `.xlsx` via `utils/table.ts`, French headers (`translateFr`) |

## Hooks

- Return named state + actions, never the raw `useQuery` / `useMutation`. Callers never see `mutate` / `mutateAsync`.
  `const { mutateAsync, isPending } = useMutation(...)` → `return { createSuffix: mutateAsync, isCreating: isPending }`
- Caller must wait → the action returns a Promise.
- Destructure everywhere, no `obj.prop` when not needed: `const { stats, savePayment } = useComptabilitePage()`, never `p.stats`.
- 2+ entries in a hook's `return { … }` → one per line. Destructuring as `make format` (Prettier) prints it.

## React Compiler

- 0 `react-hooks` lint errors (gate): a component with one is not compiled, so not memoized.
- No `state!.prop` in callbacks → `if (state) await save(state.id, x)`.
- Read React state (`jobs`), not a stable getter over a ref (`getJobByDocType`): the compiler caches the call → stale UI.
- No setState in an effect: dialog content mounts only while open, its form state starts from props (`key` = target id).
- No component defined inside another component.

## UI

- Users barely know how to use a laptop: plain words, one obvious action, big clear targets.
- Never a generic "AI-generated" look: no colored side stripes, tinted cards, gradients, emoji. Calm, same look as the site: `styles/tokens.css` colors + existing components.
- `window.alert / confirm / prompt` → `ConfirmDialog` or a toast.
- Several buttons in one `<label>` → `role="group"` + `aria-label`.
- Fixed menus flip up near the window bottom (`_components/KebabMenu.tsx`).
- Every visible text from `fr.ts` + `es.ts`; numbers French style in both languages.

## Format

- Prettier, width 120 (`.prettierrc.json`, `make format`). Same config in VS Code.
