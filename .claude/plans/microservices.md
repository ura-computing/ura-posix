# Plan: find prod problems → learn → full code scan → split into services (2026-11-13)

## Context
| Fact | Source |
|---|---|
| `GET /stats` + `/stats/margin-alerts` → 500 `serverError` in prod, called **without dates** (whole history: 837 318 Sobrus lines on the real pharmacy) | `errors.txt` |
| `analyse-marge` → 423 `screenLocked` = lock screen working (not a bug) | `errors.txt` |
| Earlier: Postgres « remaining connection slots », DB CPU 100 % | prod logs, 2026-11-11 |
| 500s are logged with traceback, but nobody reads them | `backend/app/core/errors.py:176` |
| No `statement_timeout`: a slow query keeps its connection; others wait 30 s (`pool_timeout`) then crash | `backend/app/core/database.py:20-26` |
| No CI, no unit tests (E2E only) | repo |

Decisions: split = **same code, several services** (one image, `SERVICE` env picks routers) · errors = **Sentry**.

---

## Phase 0 — Find the source (no code)
| Step | Who | Output |
|---|---|---|
| DO console → backend → Runtime Logs around the 500s (or `doctl apps logs <app> backend --type run`) → paste the traceback | you | real cause of the 500 |
| `CREATE EXTENSION pg_stat_statements;` (DO console, once), then top 10 by `total_exec_time` | you + me | slowest real queries |
| `SELECT state, wait_event, now()-query_start, left(query,80) FROM pg_stat_activity` during a slow moment | you | who holds connections |
| Reproduce locally: real-size data + Tableau de bord with no dates, DO limits stack (`make demo`) | me | same 500 on the laptop |

Suspect #1: no dates → whole-history aggregates on 1 vCPU → connections held → pool timeout → 500.
Paths: `frontend/src/pages/rapport/hooks.ts` (sends `date_from` undefined), `backend/app/analytics/stats_queries.py:759` (`df`/`dt` None).

---

## Phase 1 — Technologies to learn first (in this order)
| # | Technology | Why for PharmaGest | Enough to… |
|---|---|---|---|
| 1 | Docker Compose (multi-service) | run gateway + 4 services + DB locally | write `docker-compose.yml` with N services, networks, env |
| 2 | DigitalOcean App Platform spec + `doctl` | deploy each service as a component, internal URLs, logs, alerts | edit the app YAML, read runtime logs |
| 3 | Postgres performance | the 500s / CPU 100 % | `EXPLAIN ANALYZE`, indexes, `pg_stat_statements`, `statement_timeout` |
| 4 | PgBouncer (DO connection pools) | 22 connections shared by N services | transaction vs session mode (worker `LISTEN` needs a direct connection) |
| 5 | Caddy (reverse proxy) | one public `/api`, routes paths to services | `reverse_proxy` + path matchers |
| 6 | Service boundaries (DDD light) + OpenAPI | which router goes where, contracts | bounded context, one owner per table |
| 7 | Sentry (FastAPI + React SDKs) | see every prod error with stack + user | DSN, environments, releases, alerts |
| 8 | Structured logs + request id | follow one click across services | JSON logs, `X-Request-ID` header |
| 9 | k6 (load testing) | reproduce prod load before / after | script 20 users opening the Tableau de bord |
| 10 | GitHub Actions | stop bugs before prod | lint + type-check + tests + build on each push |
| 11 | pytest | fast tests for formulas / queries (E2E is slow) | fixtures, a test DB |
| 12 | Static analysis | find bugs without running | pyright, bandit, vulture, pip-audit · knip, npm audit |
| later | Valkey (Redis) | shared rate limit / cache when identity runs > 1 instance | `slowapi` `storage_uri` |

---

## Phase 2 — Full code scan (find bugs, clean)
**2a. Tools (one report, findings table by severity)**
| Area | Tool |
|---|---|
| Python | `ruff check --select ALL` (review), pyright, bandit, vulture (dead code), pip-audit |
| TypeScript | `tsc --strict` check, ESLint (fix the 10 store-page errors or allowlist), knip (unused files / exports), npm audit |
| DB | `alembic check` (models ⇄ migrations drift), missing indexes vs filters (`pg_stat_statements` + `EXPLAIN`) |

**2b. Manual checklist (every route / page)**
| Backend | Worker | Frontend |
|---|---|---|
| every query bounded (dates or limit) | retries, idempotent re-run, cancel | queries sent without dates / params |
| pharmacy scope on every route | memory on big CSV (chunks) | error + empty + skeleton states |
| commit / rollback, no swallowed errors | one connection, closed | duplicated UI: **calendars** (`DateRangePicker`, `DatePickerButton`, `MonthPicker`) and **selectors** (`SingleSelect`, `MultiSelect`, native `<select>` e.g. country) → one look each |
| N+1, heavy joins, text dates (B8) | log + Sentry on failure | i18n fr ⇄ es parity, unused keys |

**2c. Fix batch** (by severity) + already open items:
- `statement_timeout` (e.g. 20 s) on the engine; default date window when none sent (backend) + frontend never sends none.
- 2 failing gates of your last run: speed (`/stats` 350 ms), UI (spec 26 owner / admin pages not recorded: `recordPage` doesn't await `recordUi`; lock screen theme + « Masquer » buttons; admin list « Réinitialiser le code », « Nouveau mot de passe »).
- « Verrouiller » button (lock now with the PIN): sidebar bottom, next to « Déconnexion », only when the lock is on (`POST /auth/lock`, `frontend/src/hooks/useLockScreen.ts`).
- E2E for each fix at the end (`make tests` green).

---

## Phase 3 — Before the split
| Item | Why | Where |
|---|---|---|
| Sentry in backend, worker, frontend | see errors per service | `main.py`, `app/sobrus/worker.py`, `frontend/src/main.tsx` |
| Request id middleware + JSON logs | trace across services | `app/core/` |
| DO connection pool (transaction mode) for services; worker `LISTEN` stays direct | 22 connections for everyone | env `DATABASE_URL` per component |
| GitHub Actions: ruff, pyright, tsc, eslint, pytest, build | no broken deploy | `.github/workflows/ci.yml` |

---

## Phase 4 — Split: same code, several services
| Service | Routers (`backend/main.py`) | Why alone |
|---|---|---|
| `identity` | health, auth, admin_pharmacies, owner_employees | every page calls `/auth/me`; login rate limit stays correct with 1 instance |
| `analytics` | stats, products, history, transactions (ledger), accounting, closings, exclusions, store_website | heavy reads: scale alone |
| `ingestion` | imports, catalog | big uploads, memory |
| `sobrus-api` | sobrus | queues runs only |
| `worker` | (exists) | Sobrus calls |
| `gateway` | Caddy, public `/api` → internal services | one entry, DO prefix rules not needed |

- `main.py`: `SERVICE` env → include only its routers; unset = all (dev + today's E2E unchanged).
- One Dockerfile / image, one DO component per service with its `SERVICE` + pool size.
- Route map `gateway/Caddyfile` + a check that every OpenAPI path maps to exactly one service.
- `e2e/docker-compose.e2e.yml`: production shape (gateway + 4 services + worker) → the whole suite tests the split.
- Rollout: DO **staging app** first (copy of the spec), `make tests` against it, then prod; rollback = previous one-component spec.

---

## Verification
| Check | Pass |
|---|---|
| Phase 0 | traceback of the 500 known; top slow queries listed |
| Tableau de bord, no dates, real-size data, DO limits | no 500, < 2 s |
| k6: 20 users, 5 min | 0 errors, p95 recorded before / after |
| Sentry | a test exception shows in each service |
| `make tests` on the split compose | all green, 0 gate failures |
| DO staging | same suite green before prod switch |

## Critical files
`backend/main.py` · `backend/app/core/{database,errors,security,rate_limit}.py` · `backend/app/analytics/stats_queries.py` · `backend/entrypoint.sh` · `backend/Dockerfile` · `frontend/src/pages/rapport/hooks.ts` · `frontend/src/_components/molecules/{DateRangePicker,DatePickerButton,MonthPicker,SingleSelect,MultiSelect}.tsx` · `e2e/docker-compose.e2e.yml` · `e2e/lib/fixtures.ts` · `PLAN.md` (§3, §7 updated).
