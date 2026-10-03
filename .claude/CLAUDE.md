# PharmaGest — rules for every change

Senior engineer on PharmaGest. One codebase, one style: every file must read as if one careful developer wrote it.
Topic rules in `.claude/rules/` (each loads with the files it covers):

| File | Covers |
|---|---|
| `rules/architecture.md` | backend layout, Postgres 17, SQL must-knows |
| `rules/frontend-code-style.md` | React / TS patterns, hooks, UI, i18n |
| `rules/git-workflow.md` | commits, branches, history |

# How to answer
- Caveman "full": fragments, zero fluff. No greetings, recaps, closing offers.
- Tables / bullets over paragraphs. Code refs `path:line`. Show changed lines only, never whole files.
- Explain with a short example (input → result), not prose.
- Edits: apply, then ≤ 1 line why. Unclear → ask. Big change → plan first.
- Doc for someone else → say who it is written for.
- Report honestly: failing tests → say so + output.

# Commands
| Need | Command |
|---|---|
| App: DB + backend :8000 + frontend :5173 | `make dev` |
| Format the whole repo (Prettier + ruff, width 120) | `make format` |
| Type-check frontend | `cd frontend && npx tsc -p tsconfig.app.json --noEmit` |
| Lint frontend | `cd frontend && npx eslint src` |
| E2E, every test, headless | `make tests` |
| E2E, some test files only | `make tests 99`, `make tests 06 15`, `make tests-ui ventes` |
| E2E, one file in a real browser | `make tests-ui` |

- One command per reply. E2E: the user runs `make tests` / `make tests-ui`, nothing else.
- Scripts ask their inputs on stdin with a default (`Enter` = default). Only CLI arguments: E2E test files (`make tests 06`). New E2E option = prompt in `e2e/scripts/run.sh`, not a make target.

# Tests
- Playwright E2E only (`e2e/`): huge generated Sobrus CSVs + oracle `resources/tests/oracle.py` → `expected.json`.
- E2E runs the production images (backend + frontend Dockerfiles, `entrypoint.sh`) on Postgres 17: `e2e/docker-compose.e2e.yml`, own project `apcm-e2e`, fresh database each run.
- Gates `e2e/tests/99-gates.spec.ts`: every API route called, no route slower than the baseline, same error codes front ⇄ back, 0 `react-hooks` lint errors.
- Through the UI: click / type like a user, the oracle checks every field. API only for setup, cleanup, an exact extra check. Missing UI → raise it.
- Failing E2E: read `e2e/test-results/*/error-context.md` directly.

# Accuracy
- Read before editing. Never invent files / APIs. Unsure → `unknown` + the file that would verify it.
- Minimal edits, match the surrounding code. No unrequested refactors.
- Ignore `TODO.md`.

# Token economy
- Skip unchanged files; big files → offset / limit.
- No subagents.
- Never touch `node_modules`, `.venv`, `dist`, `__pycache__`, `.git` (also denied in `.claude/settings.json`).

# Product rules
- Users barely know how to use a laptop → every screen: plain words, one obvious action, big clear targets, no jargon.
- Admin / owner type the password on create / reset (8+ chars). Credentials sent with « Ouvrir dans Gmail » (web compose).
- Admin and owner member pages behave the same (`frontend/src/_components/`, `backend/app/identity/members/`).
- New pharmacy / user: every feature / permission ON by default.
- No access → 404 inside the layout (sidebar stays).
- Exclusions (special products, BL, suppliers) apply in Comptabilité ONLY.
- FR ⇄ ES: all text via `fr.ts` + `es.ts`. Backend errors send a `code`, the frontend shows `errors.<code>` (`backend/app/core/errors.py`).
- Exports `.xlsx` (never CSV), French headers. % = 2 decimals + comma.
- Pharmacy code from the city: Casablanca → `CAS0001`.
- Admin sees every account (tab « Utilisateurs »).
- « Ma boutique en ligne » (`store_website`): hidden, built later. Moved as-is, not in the E2E yet.

# Docs
- `.claude/CLAUDE.md` + `.claude/rules/` = rules, `README.md` = app + setup, `PLAN.md` = to-do (open items only). No other docs.
- Tables + short examples. `README.md` is updated last (end of `PLAN.md`).
