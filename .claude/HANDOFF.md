# Handoff — read this first on a new machine / new session (2026-11-13)

Work moved from the school PC (1337, no sudo) to the personal laptop. Everything Claude knew is in this folder:

| File | What |
|---|---|
| `.claude/HANDOFF.md` | this: state, next steps, open items |
| `.claude/memory/MEMORY.md` + `*.md` | Claude's memory (user profile, feedback, decisions): read the index, open what applies |
| `.claude/plans/microservices.md` | the approved plan: find prod problems → learn → code scan → split into services |
| `.claude/CLAUDE.md`, `.claude/rules/` | project rules (unchanged) |
| `PLAN.md`, `README.md` | to-do list, app + setup |

To make the memory automatic on the laptop, copy it once into Claude's own folder (path = the repo path with `/` → `-`):
`mkdir -p ~/.claude/projects/<repo-path-with-dashes>/memory && cp .claude/memory/*.md ~/.claude/projects/<…>/memory/`

---

## 1. Laptop setup (needs sudo once)
| Step | Command |
|---|---|
| Tools | Docker + Compose plugin, `make`, Node 22+ (`npm`), `uv` (`curl -LsSf https://astral.sh/uv/install.sh \| sh`), Git |
| DigitalOcean CLI | install `doctl`, then `doctl auth init` (token: DO → API → Generate New Token) |
| Repo | `git clone git@github.com:mohammedhrima/apcm-pharma.git && cd apcm-pharma && git checkout dev` |
| Dev app | `make install` (creates `backend/.env` + `frontend/.env`), then 3 terminals: `make backend`, `make worker`, `make frontend` (:8000 / :5173); `make seed` = demo accounts (`backend/scripts/seed.json`) |
| E2E | `make tests` (asks the real Sobrus email + password once → `e2e/tests.env`, gitignored, never committed) |
| Playwright browser | installed by `e2e/scripts/run.sh` on the first run |

---

## 2. State at this commit
Branch `dev`. Last feature commit `ccf1998` (closing rows in Gestion des imports, Sobrus page cleanup, E2E 20/23/25/26).

**Microservices (plan `.claude/plans/microservices.md`, decisions: same code + several services, Sentry):**
| # | Step | Status |
|---|---|---|
| 1 | `SERVICE` env picks the routers: `backend/app/core/services.py` (map service → routers, checked at import), `backend/main.py` loads only those (unset = all, same 143 routes as before, checked) | **done** |
| 2 | Gateway: `backend/scripts/gateway_routes.py` writes `gateway/Caddyfile` from the routes (fixed paths first, then `{id}` ones; every path checked to reach its own service; `--check` for CI); `gateway/Dockerfile` (Caddy 2.10) | **done, not run in Docker yet** |
| 3 | E2E stack split (`e2e/docker-compose.split.yml`, `make tests` asks « Services split? »): gateway :8001 + backend=identity (migrations) + analytics / ingestion / sobrus (`entrypoint.sh serve`) | **done**, smoke-tested (login through the gateway, each path → its service) |
| 4 | Request id (`X-Request-ID`, in crash logs + Sentry); Sentry in backend / worker / frontend (`SENTRY_DSN`, `VITE_SENTRY_DSN`; off when empty) | **done** |
| 5 | `DATABASE_URL_DIRECT` (worker LISTEN + migrations); services use `DATABASE_URL` = the pool | **done** (code); set the URLs on DO at step 6 |
| 6 | New DO app spec from the current one: staging app first (`doctl apps create --spec`), `make tests` against it, then prod; rollback = old spec | todo |

Service split (`app/core/services.py`): identity 39 operations · analytics 74 · ingestion 18 · sobrus 11 (+ `/v1/health` everywhere).

**Fixed in this commit (prod bug found):** the rate limiter keyed on `request.client.host` = DigitalOcean's router for
everyone → « 5 logins / min » and « 20 unlocks / min » were shared by ALL users. Now `client_ip()` reads
`do-connecting-ip` (`backend/app/core/rate_limit.py`). Not covered by E2E (E2E runs with `RATE_LIMIT=0`).

---

## 3. What the user does on DigitalOcean (step 6 needs it)
| # | Do | Give Claude |
|---|---|---|
| 1 | `doctl apps list` → `doctl apps spec get <app-id> > app.yaml` | `app.yaml` with secret values replaced by `***` |
| 2 | Databases → cluster → Connection Pools → Create: name `app`, mode Transaction, size 18 | « done » |
| 3 | sentry.io free account, projects `pharmagest-backend` (FastAPI), `pharmagest-worker` (Python), `pharmagest-frontend` (React) | « done » (DSNs go in DO env vars, never in git) |

---

## 4. Open items (not started)
| Item | Detail |
|---|---|
| Prod 500s (`.claude/prod-errors.txt`) | `GET /v1/stats?category_type=all&include_non_declared=true` and `/v1/stats/margin-alerts?…` → 500 `serverError`, both **without dates** (whole history, 837k Sobrus lines); `analyse-marge` → 423 `screenLocked` (normal). Dev can't reproduce (0.84 s, 200). Need the traceback: DO → backend → Runtime Logs, `Unhandled error on GET /v1/stats` (`app/core/errors.py:176` logs it). Then `pg_stat_statements` top 10 + `pg_stat_activity` (commands in the plan, Phase 0). Suspects: no `statement_timeout` (`app/core/database.py`), frontend sends no dates (`frontend/src/pages/rapport/hooks.ts`) |
| 2 gates failed (user's last `make tests`) | speed: `/stats` 350 ms vs limit 320, `/admin/pharmacy/{id}/stats` 271 vs 246 (likely noise, same code as owner `/stats`). UI gate, 9 « shown but never used »: menuitem « Réinitialiser le code » on `/admin/pharmacies/:id`, `/admin/pharmacies`, `/owner/employees` → spec 26 `openAs()` pages don't record UI because `recordPage` calls `recordUi` with `void` (not awaited, `e2e/lib/fixtures.ts`): export a ready promise and await it; `/admin/pharmacies` field « Nouveau mot de passe » (fill it in spec 23 before « Annuler »); `/auth/me` buttons « Clair », « Sombre », « Masquer le mot de passe » = the lock screen (AuthLayout has the theme toggle + the eye) → click them in spec 26; `/imports` tab « Imports » (click it in spec 25 after « Produits Sobrus »); `/login` « Masquer le mot de passe » (spec 23 « connexion : œil » clicks « Afficher » only → also click « Masquer ») |
| User ask: calendars consistent | 3 components: `DateRangePicker`, `DatePickerButton` (product expiry), `MonthPicker` (Comptabilité) → one look (same panel, header, buttons) |
| User ask: selectors consistent | `SingleSelect`, `MultiSelect`, native `<select>` (country in « Mon compte » profile) → one look |
| User ask: « Verrouiller » button | lock now with the PIN: sidebar bottom next to « Déconnexion », only when the lock is on and a code exists (`POST /auth/lock`, then `me` refresh; see `frontend/src/hooks/useLockScreen.ts`) |
| Full code scan | plan Phase 2 (ruff ALL, pyright, bandit, vulture, pip-audit, knip, npm audit, alembic check) |
| Smaller, offered earlier | long customer names wrap badly in the closing day dialog (Comptabilité); `env/do/limits.yml` backend 512 MB vs prod now 2 GB (kept strict on purpose, decide); « Étiquette » / « Commander » premium screens = user decisions first (PLAN §8) |

Lock screen recap (shipped in `8f75cfc`): optional, off by default, « Mon compte » → « Verrouillage »; delays 15 s · 1 · 5 · 15 · 30 min;
idle in any tab (localStorage `pg-last-activity`, BroadcastChannel `pg-lock`) → `POST /auth/lock` → `sessions.locked_at` → every route
423 `screenLocked` except `/auth/me`, `/auth/lock`, `/auth/unlock`, `/auth/logout`; 5 wrong codes → session deleted, 403 `pinTooMany`
(not 401, that would open « Session expirée »); admin / owner « Réinitialiser le code » in the member kebab.

---

## 5. Rules to keep (also in CLAUDE.md / memory)
- Never commit / push without the user's OK, asked each time; no AI trailer (« no anthropic email »); work on `dev`, check the branch first.
- Never commit `.env`, `e2e/tests.env`, `resources/` files, `TODO.md` (ignored by rule).
- The user runs `make tests` himself unless he asks Claude to; one command per reply; terse answers, tables.
- UI: design system first, screenshot-check (light, dark, phone) before « done ».
