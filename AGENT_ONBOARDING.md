# APCM PharmaGest — AI Agent Onboarding Brief

Hand this whole file to any AI/coding agent so it understands the project, the rules,
the domain, and the recent work. It is self-contained — an external agent does **not**
need access to any local files to use it.

---

## 0. Access reality (read first)
- The code lives in a **private** GitHub repo. An external chat AI can't read it — either
  give a coding agent (Cursor / Claude Code / Devin / etc.) **repo access**, or paste the
  relevant files. This brief + the repo is enough context.
- The chat history, the persistent "memory" rules, and the plan file are **local, private**
  files on the owner's machine (under `~/.claude/…`). Their *content* has been distilled into
  Sections 3–6 below, so you don't need the files themselves.

---

## 1. Project & repo
- **Product:** PharmaGest — a management dashboard for Moroccan pharmacies (achats/ventes/
  stock/comptabilité/marges), client-facing. UI languages: **French ⇄ Spanish**.
- **Repo:** `git@github.com:mohammedhrima/apcm-pharma.git` (private). Work on feature
  branches; merge to `main` via PRs.
- **Read-only reference (never write there):** the OLD app (separate checkout), kept only for
  behavior comparisons. Its `docs/APCM_CONTEXT.md` is the compacted project history.
- **Run it:** `make install` (first time) → `make db` → `make migrate` → `make seed` → `make dev`
  (backend uvicorn :8000 with reload, frontend Vite :5173). Needs Postgres with `unaccent`
  (dockerized by `make db`). Alembic head = `0019` (medicament normalized-name index).
- **Tests:** Playwright end-to-end only — `make e2e-tests` (headless) / `make e2e-ui` (real
  browser). The script asks its inputs (Enter = default). See §2 "E2E".

---

## 2. Architecture
**Backend** (`backend/`) — FastAPI + SQLAlchemy 2.0 + Postgres + Alembic:
- `models.py` — ORM. Core tables: `medicaments`, `achats` (purchases; has `supplier`,
  `delivery_ref`), `ventes` (sales; NO supplier/BL), `pharmacy_stock`, `payment_entries`,
  and exclusion tables `pharmacy_medicament_status`, `pharmacy_bl_exclusions`,
  `pharmacy_supplier_exclusions`.
- `routers/` — HTTP endpoints (`stats`, `transactions` = achats/ventes lists, `accounting`,
  `uploads` = CSV import, `bl_exclusions`, `supplier_exclusions`, `special_products`,
  `admin_*`, `auth`, `sessions`, …).
- `*_queries.py` — the heavy computation: `stats_queries.py` (dashboard/comptabilité KPIs +
  monthly trend), `analyse_queries.py` (/analyses — 8 modes), `stock_queries.py` (ABCD).
- `exclusions.py` — shared filters: `non_declared_sub` (excluded products),
  `achat_bl_filter` (excluded BLs), `achat_supplier_filter` (excluded suppliers),
  `achat_exclusion_filter` (BL AND supplier) and `excluded_medicaments_select` (the med-level
  union). Applied **only in the Comptabilité view** (`include_non_declared=false`), see §4.
- `members.py` — shared owner/employee lifecycle (create with typed password + all
  permissions, status, reset password) used by `admin_pharmacies.py` and `owner_employees.py`.
- `search.py` — tokenized search with `*` wildcard (see §4). `csv_parse.py` — Sobrus CSV
  parsing + `upsert_medicament` / `existing_by_name` (import de-dup).

**Frontend** (`frontend/src/`) — React + Vite + TypeScript + TanStack Query + Tailwind +
lucide-react:
- `pages/<feature>/` (rapport dashboard, achats, ventes, stock, alertes, comptabilite,
  analyse, produits-speciaux, admin/*, auth/*, imports, owner/employees, …), each with
  `_components/`, `_hooks/`, `_constants`.
- `components/shared/` — DataTable, filterBar (search/date/segment), KpiTile, dialogs, etc.
- `utils/format.tsx` — currency/qty/**percentage** formatters. `utils/text.ts` — client search.
- **i18n** (`src/i18n/`) — custom, dependency-free: `useT()` hook, `locales/fr.ts` +
  `locales/es.ts` (must have identical key sets — a parity test enforces it), `LanguageToggle`.
- `components/shared/members/` — CreateUserDialog (+ ResetPasswordDialog), MemberKebab,
  UserPermissionsDialog, FeaturePills, constants: shared by the admin pharmacy page and the
  owner's "Gérer mon équipe" page.

**E2E** (`e2e/` + `resources/tests/`) — the only test suite:
- `resources/tests/generate.py` writes huge Sobrus-format CSVs (achats / ventes / stock) and
  `resources/tests/oracle.py` computes every value the app must return → `expected.json`.
- Playwright specs drive the real UI (fresh `apcm_e2e` DB, ports 8001 / 5174) and compare every
  field of every API response with the oracle. `99-gates.spec.ts` fails if any backend route is
  never called (store-website allowlisted for now) or a route got > 20 % slower than
  `perf-baseline.json`.

---

## 3. HARD RULES (do not violate)
**Git / workflow**
- **Never commit or push without explicit permission.** Wait to be told, every time.
- Git writes happen **only** in this repo. The old-app checkout is READ-ONLY — never
  stage/commit/push there, never "clean" its dirty tree.
- The agent never runs shell commands; the owner runs them (see `CLAUDE.md` "Commands").
- Commit messages must **NOT** include an Anthropic / AI co-author trailer (omit `Co-Authored-By`).
- Shell cwd resets between commands — always use `git -C <path>` or re-`cd`.
- After a batch of work, offer a client/manager-facing `.md` change report (the owner sends it
  to the client).

**Formatting / product conventions**
- **French** number/currency/date formatting throughout the UI (comma decimals, "MAD" suffix).
- **Percentages: exactly 2 decimals + comma**, e.g. `12,28 %` (use `formatPct` in `format.tsx`).
- **Exports are Excel `.xlsx`, never CSV** (pharmacist-facing). Excel export **column headers
  stay in French** (old-app archive parity) even though the UI is translatable.
- **i18n = French ⇄ Spanish only** (no English). Add every new key to **both** `fr.ts` and
  `es.ts`; keep the key-parity test green. Server error messages stay French (out of i18n scope).
  Hidden pages (`dev/*`, `store-website/*`) are lower priority.
- **Pharmacy code** convention: city-derived, e.g. Bouskoura → `BOU0001`.

**Product rules** (client decisions — full list in `CLAUDE.md` "Product rules")
- Users are not tech-savvy → simplest UX.
- Admin / owner **type** the password on user create + reset; credentials are sent with the
  "Ouvrir dans Gmail" button (Gmail web compose, no mailto).
- Never `window.alert/confirm/prompt` → `ConfirmDialog` or a toast.
- New pharmacy / new user: every feature / permission ON by default.

---

## 4. Domain glossary & locked formulas (source of most bugs)
- **PPH** = catalogue purchase price *before* discount (`Medicament.pph`).
- **PU** = REAL unit purchase price *after* remise = `PPH × (1 − Remise%)` (`Achat.unit_price`).
- **PPV** = selling price (`Medicament.ppv`).
- **Marge% = (1 − PU/PPV) × 100.** Marge nette must be HT/HT (both ÷ (1+TVA)).
  - ⚠️ Do NOT compute marge as `PPV − PPH` / `PPV/PPH` — PPH often equals PPV → fake 0 %.
- **Stock min/max:** `MIN = round(ventes_12m/300 × 14)`, `MAX = round(ventes_12m/300 × 15)`.
- **Marge reconcile:** backend `reconcile_marge_to_ca` makes `marge_brute_dh = CA × marge_pct/100`
  so `marge_brute_dh / CA == marge_pct` on every page.
- **Search wildcard (`*`):** prefix `rino*`, suffix `*enil`, infix `ri*il`; anchored **per word**
  of a multi-word name. No-`*` token = substring. Backend uses a per-word Postgres `~*` regex
  (`\m…\M`); frontend `matchesText`/`matchesFields` mirror it. Every search bar shares this.
- **/analyses axes — Grossiste vs Laboratoire (both supplier-based):**
  - Grossiste = `Achat.supplier` whose UPPER name **starts with "GROSSISTE"**.
  - **Laboratoire = every OTHER non-null supplier** (the direct labs / "Société…" — e.g. WELEDA).
    The two are the exact complement over non-null suppliers (`_supplier_axis` in
    `analyse_queries.py`). (Historically Laboratoire used the sparse `Medicament.laboratoire`
    catalogue attribute — deliberately changed to the supplier the pharmacist buys from.)
- **Exclusions** (all owner-managed, reversible, non-destructive; feature-gated
  `special_products`) — **apply ONLY in Comptabilité** (`include_non_declared=false`, user
  decision 2026-08-01). Everywhere else (Rapport, Analyses, Ventes, Achats, Stock, Alertes)
  every product, BL and supplier is included.
  - Kinds: **Product** (`pharmacy_medicament_status.declared=False`), **BL** (`delivery_ref`),
    **Supplier** (`Achat.supplier`, accent/case-insensitive).
  - In Comptabilité the three are unified at medicament level (`excluded_medicaments_select`):
    every product on an excluded BL / from an excluded supplier drops from **both** ventes and
    achats, exactly like a special product.
  - The manually-entered payment-method amounts are never excluded (not derived from sales).
- **Import de-dup:** achat/vente + catalog imports merge a product by **normalized name**
  (accent/case-insensitive, whitespace-collapsed) so the same product doesn't fork into two
  `Medicament` rows with different PIDs (`csv_parse.existing_by_name`).

---

## 5. Recent work (chat-session history summary)
Latest session (2026-09-28 → 29):
- **Members**: shared components (`components/shared/members/`) + backend `members.py`; admin
  and owner pages behave the same (Désactiver/Réactiver, delete via ConfirmDialog, one kebab).
- **Passwords typed** by admin / owner on create + reset (reset dialog = same reveal as
  create); credentials sent with an "Ouvrir dans Gmail" button (no mailto).
- **Defaults**: every feature / permission ON for a new pharmacy / new user.
- **404 inside the layout** for pages without access (user can still log out).
- **Fixes**: `/alertes` date filter lost the start date (stale closure); `/ventes?include_non_declared=false`
  crashed (undefined `db`); Achats sort by PPH crashed (not an `Achat` column); role cards in
  CreateUserDialog mislabeled for screen readers (`<label>` around buttons).
- **Removed**: Chrome-extension multipart endpoints `/uploads/achat` + `/uploads/vente`.
- **E2E suite** (`e2e/`, `resources/tests/`) replacing pytest / vitest; `REVIEW.md` lists the
  open backend issues for the microservice split.

Earlier (already on `main`):
1. **i18n FR ⇄ ES** across the whole authenticated UI (custom engine, `LanguageToggle`,
   key-parity test). Excel export headers kept French.
2. **Percentages → 2 decimals + French comma** everywhere on-screen (central `formatPct`
   + fixing `.toFixed(3)` dot-separator bypasses). Exports stay raw numbers.
3. **Search `*` wildcard**, per-word, in every bar (frontend + backend `~*` regex).
4. **Exclude by fournisseur (supplier):** new `pharmacy_supplier_exclusions` (migration `0018`),
   `achat_supplier_filter`, `/v1/supplier-exclusions` router, and a "Fournisseurs" tab in
   Produits Spéciaux (purchases-side, exact accent/case-insensitive match, notes field).
5. **Import name-de-dup** (both import paths, one batched query).
6. **/analyses "Laboratoire" tab → non-grossiste supplier axis** (WELEDA & ~200 direct suppliers
   now appear). Shared `_supplier_axis` engine with Grossiste.
7. **Alertes detail modal** widened (`max-w-[1400px]`) + text columns wrap = no horizontal scroll.
- The old backfill migration `0019` (`Medicament.laboratoire`) was removed; today's `0019` is
  the medicament normalized-name index (import de-dup lookup).

---

## 6. Deeper references (only for an agent WITH local/repo access)
- `CLAUDE.md` — how the agent must work + product rules.
- `REVIEW.md` — open backend issues / blockers for the microservice split.
- `e2e/` + `resources/tests/` — the test suite and its oracle (expected values per field).
- Old-app history & QA tickets: `docs/APCM_CONTEXT.md` in the old-app checkout.

---

## 7. Working style expected
Plan first, then execute fast. Confirm before hard-to-reverse or outward-facing actions. Report
outcomes faithfully (failing tests → say so). Match existing code idiom. Ask before changing
locked formulas or the git/i18n/export conventions above.
