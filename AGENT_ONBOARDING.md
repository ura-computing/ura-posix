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
- **Active repo (all work happens here):** `~/Desktop/personal/apcm/apcm-refactor`
  - Git remote `origin` = `git@github.com:mohammedhrima/apcm-pharma.git`
    (GitHub: `https://github.com/mohammedhrima/apcm-pharma`). **Naming trap:** the remote is
    *named* "apcm-pharma" but this IS the apcm-refactor codebase — that's correct, not a mistake.
  - Work on branch **`dev`**; merge to `main` via PRs (private repo).
- **Read-only reference (never write here):** `~/Desktop/personal/apcm/apcm-pharma` — the OLD
  app, kept only for behavior comparisons. Its `docs/APCM_CONTEXT.md` is the compacted project
  history (domain formulas, QA tickets, conventions) — read it if available.
- **Run it:**
  - Backend: `cd backend && make backend` (FastAPI + uvicorn on :8000, `--reload`). Needs
    **Postgres** with the `unaccent` extension. Migrations: `alembic upgrade head` (current
    head = `0018`). Python deps via `uv` / the `.venv`.
  - Frontend: Vite dev server on :5173 (React + TypeScript).
  - Tests: backend `.venv/bin/python -m pytest` (a separate `apcm_test` DB, auto-migrated);
    frontend `npx tsc -b` + `npx vitest run`.

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
  `achat_bl_filter` (excluded BLs), `achat_supplier_filter` (excluded suppliers), and the
  combined `achat_exclusion_filter` (BL AND supplier) applied to every achat-side aggregate.
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

---

## 3. HARD RULES (do not violate)
**Git / workflow**
- **Never commit or push without explicit permission.** Wait to be told, every time.
- Git writes happen **only** in `apcm-refactor`. The local `apcm-pharma` repo is READ-ONLY —
  never stage/commit/push there, never "clean" its dirty tree.
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
  `special_products`):
  - **Product** (`pharmacy_medicament_status.declared=False`) → filtered from **both** ventes
    and achats; toggle-able on some pages ("Inclure les produits spéciaux").
  - **BL** (`delivery_ref`) and **Supplier** (`Achat.supplier`, accent/case-insensitive) →
    **achats-side only** (sales carry neither). Applied via `achat_exclusion_filter`.
  - Comptabilité KPIs respect all of these; the manually-entered payment-method amounts do not
    (they aren't derived from sales).
- **Import de-dup:** achat/vente + catalog imports merge a product by **normalized name**
  (accent/case-insensitive, whitespace-collapsed) so the same product doesn't fork into two
  `Medicament` rows with different PIDs (`csv_parse.existing_by_name`).

---

## 5. Recent work (chat-session history summary)
Everything below is already committed on `dev` (latest: `c85c363`).
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
- A prior obsolete backfill migration (`0019`, `Medicament.laboratoire`) was **removed** once the
  Laboratoire axis moved to suppliers; dev DB is back at head `0018`.
- Verified each step: backend **395** pytest pass, frontend **171** vitest pass (incl. i18n parity).

---

## 6. Deeper references (only for an agent WITH local/repo access)
- Compacted project history & QA tickets: `apcm-pharma/docs/APCM_CONTEXT.md` (old-app repo).
- Persistent rules (already distilled above): `~/.claude/projects/-Users-hrimamohammed-Desktop-personal-apcm-apcm-pharma/memory/` (`MEMORY.md` + `apcm-*.md`).
- Full chat transcript (very large, ~45 MB JSON-lines): same `…/…-apcm-pharma/<session-id>.jsonl`.
- These are **local & private** — an external agent can't fetch them; use this brief instead.

---

## 7. Working style expected
Plan first, then execute fast. Confirm before hard-to-reverse or outward-facing actions. Report
outcomes faithfully (failing tests → say so). Match existing code idiom. Ask before changing
locked formulas or the git/i18n/export conventions above.
