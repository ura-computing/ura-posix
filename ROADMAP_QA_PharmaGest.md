# PharmaGest QA report — 15-ticket phased roadmap

## Context

ANOVA PHARMA CONSULTING audited the apcm-pharma (PharmaGest) bêta and produced 15 tickets
(`Rapport_QA_PharmaGest.pdf`) grouped by priority: **7 CRITIQUE** (block prod/demo), **5 IMPORTANT**
(daily UX friction), **3 UX** (polish). The report also defines business rules (marge formula,
variation formula, stock-status thresholds) that must be applied consistently everywhere.

This file is a **triage roadmap**, not a per-ticket spec. For each ticket it gives: code anchors,
brief approach, effort, and known unknowns. Execute one ticket at a time — open a fresh planning
pass per ticket against this map.

---

## Open clarifications

1. ✅ **PG-001 — Stock Min / Stock Max + status bands.** Resolved by the 2026-05-30(+1) client
   message: **4 buckets keyed by days-of-coverage**, no "critique" bucket (the original PDF's
   `<30j Critique` is dropped):
   - `days ≤ 45` → **sous-stock**
   - `46 ≤ days ≤ 60` → **idéal**
   - `61 ≤ days ≤ 99` → **à surveiller**
   - `days ≥ 100` → **sur-stock**

   Displayed `Stock Min` = `round(ventes_12m × 45 / 365)` (boundary into idéal), `Stock Max` =
   `round(ventes_12m × 60 / 365)` (top of idéal). See PG-001/PG-002 entry below.
2. **PG-007 — "% d'achat" alternative.** Client repeated the BL-level exclusion ask ("pour la
   compta") but hasn't yet specified the % variant baseline (per BL? per supplier?) nor how to
   match ventes to a specific BL when Vente has no `delivery_ref`. Discuss before building the
   ventes-matching half of PG-007 — the BL-by-number exclusion piece can ship without it.

## Progress

- **PG-013 ✅ shipped** — commit `9661172` (2026-05-30). All six `Medicament.pph` fallbacks
  removed across produit / categorie / brackets modes of [marge.py](backend/routers/stats/marge.py);
  regression test `test_pg013_no_pph_fallback_when_achat_missing` added; 276 backend tests pass,
  frontend tsc clean.
- **PG-010 ✅ shipped** — commit `7831151`. Grossiste branch (marge.py:242) and laboratoire branch
  (marge.py:299) now compute weighted `marge_pct_avg` / `marge_dh_avg` + `total_achat_cost` from
  per-`(supplier?, medicament)` avg-PU subqueries; KPI label_key picks dynamically from
  category/grossiste/laboratoire; frontend table configs get the two new columns. 278 backend
  tests pass.
- **PG-016 ✅ shipped** — commit `2695ad4`. Marge moyenne tile on /analyse now labelled "(DH)" and
  appends " DH" to value + min/max badges.
- **PG-015 ✅ shipped** — commit `f5cfcf2`. Theme toggle replaced from a 3-option DropdownMenu with
  a single-click sun/moon Button that flips light↔dark.
- **PG-004 ✅ shipped** — commit `8a8d155`. Extracted `_marge_for_window` helper in queries.py;
  `compute_previous_kpis` now returns `marge_pct` using the same per-medicament weighted formula
  as the current value; frontend variation badge replaced the buggy CA/Achats reconstruction with
  a direct comparison. Regression test asserts the OLD formula would have produced -166.67 %
  where the NEW one correctly returns 20 %. 279 backend tests pass.
- **PG-020 ✅ shipped** — commit `dff1caa`. Added "iététique" / "ietetique" branches to
  `_pharma_expr()` so Diététique products now roll into Pharmacie aggregates everywhere (CA
  breakdown, marge, type_breakdown, marge brackets). Test covers both accent variants. 280
  backend tests pass.
- **PG-013 follow-up ✅ shipped** — commit `5907fdf`. Dropped the residual PPH fallback in
  `queries._marge_for_window` (the helper backing the dashboard marge tile + the PG-004 variation
  badge); the existing `if r.pu is not None` guard now excludes pu-less rows from the aggregate.
  Regression test pins the new behaviour. 281 backend tests pass.
- **PG-021 ✅ shipped** — commit `1f807be`. Exposed the auto-generated `pharmacy_code` via a
  `User.pharmacy_code` @property + `UserOut.pharmacy_code`, plumbed through the frontend
  `User` type, and rendered the code as a monospace pill next to `pharmacy_name` on the welcome
  page (both active and pending branches). `test_signup_owner_success` now asserts the code is
  present and starts with the city prefix. 281 backend tests pass.
- **PG-001 + PG-002 ✅ shipped** — commit `9f393f1`. Status now derived from
  `current_stock × 365 / ventes_12m` with the 4 client-confirmed bands
  (sous-stock ≤45 j · idéal 46-60 j · à surveiller 61-99 j · sur-stock ≥100 j);
  displayed Stock Min/Max recomputed from the idéal band × ADS; Sobrus snapshot values dropped
  from the read path. New `?status=` filter accepts comma-separated values. Frontend
  `StockStatus` / `STATUS_OPTIONS` / `STATUS_CFG` palette refreshed; health gauge now counts
  "ideal". 296 backend tests pass (+15 parametrised band tests including the DOLIPRANE repro).
- **PG-009 ✅ shipped** — commit `9aacf35`. 3-tile total summary (Somme commandée / BL / Unités)
  under the Achats jauge, summing both supplier-type aggregates the backend already returns.
  Reactivity is automatic via the existing supplier-summary query key.
- **PG-008 ✅ shipped** — commit `12f93e8`. New "Sans date" péremption bracket on the backend
  (`expiry_date IS NULL` rows) + 4th AlertCard / modal on the frontend; new slate tone for the
  data-quality signal. `PEREMPTION_COLUMNS` renders "—" when no date is set. 296 backend tests
  pass; 112 frontend tests pass.
- **PG-006 ✅ shipped** — commit `12970c0`. `unaccent` PG extension enabled at boot; new
  `supplier_search_clauses` helper does case + accent + multi-token + `*` wildcard match.
  `tokenize_search` already split on `*` (free). Refactored `/achat/suggestions` and
  `/achat/supplier-summary`; also unaccented `product_search_clauses` so the main /achat list
  search benefits too. Regression covers "CDP", "para", "societe para", "Société PARA",
  "soc*cdp" → all hit "Société PARA LA CDP". 297 backend tests pass.
- **PG-011 ✅ shipped** — commit `3befe56`. DateRangePicker now renders two side-by-side framed
  fields with "Date début" / "Date fin" labels above each (replacing the unified `[Du … → Au …]`
  strip). Shared calendar popover icon stays. Existing tests updated to query by the new aria
  labels; 112 frontend tests pass.

---

## Cross-cutting rules (codify once, reuse everywhere)

Bake these in a shared module (e.g. `backend/utils/finance.py` + matching frontend constants) and
unit-test them:

- `marge_pct = (1 - PU/PPV) × 100`
- `marge_dh = PPV - PU` (ligne par ligne; agréger ensuite, jamais l'inverse)
- `variation_pct = (T1 - T0)/T0 × 100`, arrondi 2 décimales
- Stock status from days_of_coverage: `<30 Critique`, `<59 Sous-stock`, `60-70 OK`,
  `71-89 À surveiller`, `>90 Sur-stock`

---

## Phase 1 — CRITIQUE (must ship before any client demo)

### PG-013 — Drop PPH fallback for marge — ✅ DONE (commit `9661172`)
Shipped 2026-05-30. See **Progress** section above. All later marge work (PG-005, PG-012, PG-010)
inherits the corrected base.

### PG-005 + PG-012 — PU réel from BL after remise (NEXT, client evidence confirmed)
**Client repro (2026-05-30 batch).** Sobrus BL for `GUM BAIN DE BOUCHE JUNIOR 6+ 300ML REF 3022`:
`Prix d'origine = 60.60` (= PPH), `R = 25 %`, `P.U = 45.45` (= post-remise), `PPV = 61.00`.
- Expected marge: `(1 − 45.45/61) × 100 ≈ 25 %`.
- App shows: `~0.7 %`, which is `(1 − 60.60/61) × 100` — i.e. the app currently computes marge
  against the **pre-remise** price (PPH/Prix d'origine), not the post-remise P.U the client wants.

**Why it happens.**
- Extension at [extension/src/content/sobrusExport.ts:157-240](extension/src/content/sobrusExport.ts#L157-L240)
  forwards Sobrus' raw CSV un-touched.
- Backend ingestion at
  [backend/routers/uploads.py:170](backend/routers/uploads.py#L170) maps the Sobrus column
  `"Prix unitaire"` → `Achat.unit_price`.
- The local sample CSV (`resources/Sobrus - Achats 2026-01-01 - 2026-05-02.csv`) shows
  `Prix unitaire` *already* holding the post-remise value (e.g. PPH=135 → Prix unitaire=97.20 =
  28 % remise) and **no separate Remise column**. So in that CSV, the import is correct.
- For the JUNIOR row the client sees, `Achat.unit_price` evidently holds 60.60 (= PPH), implying
  *Sobrus' CSV for that BL exported `Prix unitaire` = pre-remise* — different from the sample.
  Sobrus' export shape is therefore inconsistent across BLs / pharmacy configurations.

**Investigation step (blocking the implementation):**
- Ask the client for a `Sobrus - Achats *.csv` from their pharmacy that contains the JUNIOR
  product. Inspect the header + that row. Two outcomes:
  - **(a) Their CSV has a separate "Remise" / "R" column** → patch the importer to compute
    `unit_price = (Prix unitaire) × (1 − remise / 100)` when the column is present, fall back
    to `Prix unitaire` as-is when it isn't. Add `Achat.discount` (Float) for traceability.
  - **(b) Their CSV's "Prix unitaire" really is pre-remise without any remise column** → that's a
    Sobrus issue we can't compute around from CSV alone. Options: switch the extension to DOM-
    scrape the BL detail page (which exposes `P.U`), or add an admin tool to re-import that
    pharmacy with a one-time discount-recovery script. Discuss with client.

**Independent cleanup (do alongside, regardless of (a)/(b)):**
- The PG-013 PPH-fallback purge missed
  [queries.py:_marge_for_window](backend/routers/stats/queries.py) which still does
  `func.coalesce(avg_pu_sub.c.avg_pu, Medicament.pph)`. Drop it for the same reasons as PG-013
  (Sobrus fiche-produit has PPH==PPV → fake 0 % marge for products with no Achat).

**Schema (when remise is captured):**
- `ALTER TABLE achats ADD COLUMN discount FLOAT NULL` + `ADD COLUMN prix_origine FLOAT NULL`.
  Existing rows: leave NULL (no way to reconstruct historical remise from current data); future
  imports populate both columns.

**Acceptance:**
- After fix + re-import, the JUNIOR BL stores `Achat.unit_price = 45.45`. Dashboard marge tile
  for this product reads ~25 %.
- The PG-012 reference example (PU=39.42, PPV=54) → marge ≈ 27 % continues to hold.

**Effort:** M-L, blocked on the client CSV inspection before code changes.

### PG-010 — Marge % + DH for grossistes **and laboratoires**
- Code: [marge.py:242-273](backend/routers/stats/marge.py#L242-L273) (grossiste branch) and
  [marge.py:299-322](backend/routers/stats/marge.py#L299-L322) (laboratoire branch). Both skip
  margin AND skip the avg purchase price (PRIX UNITAIRES ACHETÉS shows 0,00 MAD in screenshot).
  Frontend: [pages/rapports/margeTable.tsx:49-56](frontend/src/pages/rapports/margeTable.tsx#L49-L56)
  missing margin columns for both modes.
- Approach: in each branch, join an `avg_pu` subquery analogous to produit mode lines 44-55, add
  `marge_pct` / `marge_dh` to row output, surface PU in the KPI tiles, add table columns.
- Acceptance (client repro): selecting **Société PARA LA CDP** under Grossistes (or any
  laboratoire) must populate Marge moyenne / Marge moyenne (DH) / Prix unitaires achetés — not "—".
- Effort: S (one branch + a copy for the other).

### PG-004 — Variation marge arithmetic (NEXT)
**Diagnosis (confirmed in code):** the `pctChange` helper at
[pharmacyRapports.tsx:234-241](frontend/src/pages/rapports/pharmacyRapports.tsx#L234-L241) uses
the right `(T1-T0)/T0×100` formula. The bug is the **inputs** passed to it on the marge tile at
[pharmacyRapports.tsx:536-549](frontend/src/pages/rapports/pharmacyRapports.tsx#L536-L549):

```ts
const prevCA = prevKpis?.ventes_total ?? 0;
const prevAchats = prevKpis?.achats_total ?? 0;
const prevMarge = prevCA > 0 ? ((prevCA - prevAchats) / prevCA) * 100 : undefined;
<ChangeBadge current={marge?.marge_pct} previous={prevMarge} />
```

`prevMarge` here is `(sumVente − sumAchat) / sumVente × 100` over the full window, while
`marge.marge_pct` is computed completely differently at
[queries.py:282-285](backend/routers/stats/queries.py#L282-L285) as
`1 − Σ(qty·PU_per_med) / Σ(qty·PPV) × 100` — a weighted aggregation of per-medicament margins
where `Achat.total` is **not** the cost basis (Σ qty·PU is). The two methods differ whenever
purchase volume ≠ sale volume (typical), so the variation is junk.

**Fix:**
1. Extract a small helper `_marge_for_window(db, pharmacy_id, df, dt, cat_filter_v,
   cat_filter_a, non_declared_sub) -> {marge_pct, marge_brute_dh, marge_nette_dh}` from
   [queries.py:_compute_advanced_kpis](backend/routers/stats/queries.py) (currently inline around
   lines 252-297). Same SQL, same formula.
2. Call it twice — for the current window from `_compute_advanced_kpis` (replace inline block)
   and for the previous window from [compute_previous_kpis at
   :327-393](backend/routers/stats/queries.py#L327-L393). Add `marge_pct` to the
   `previous_kpis` response shape.
3. Update the TS type `PreviousKpis` in
   [frontend/src/api/stats.ts](frontend/src/api/stats.ts) to include `marge_pct?: number | null`.
4. Replace the buggy 4-line block at pharmacyRapports.tsx:536-549 with
   `<ChangeBadge current={marge?.marge_pct} previous={prevKpis?.marge_pct} />`.

**Regression tests:**
- Backend: extend `stats_data` (or add a sibling fixture) to also create achats + ventes one
  year earlier; assert `previous_kpis.marge_pct` is computed by the same per-product weighted
  method.
- Acceptance from report: Avril 2025 = 31.7 %, Avril 2026 = 32.6 % → variation **+2.84 %**.
- Client repro: **MKL CREME DOUCHE DERMO-NOURRISSANTE BIO 100ML** — once the formula is fixed,
  the dashboard variation for the period containing this product must match the math.

**Critical files:**
- `backend/routers/stats/queries.py` — extract helper, add `marge_pct` to `previous_kpis`.
- `backend/tests/test_stats.py` — backfill test fixture for prior-year data; assert `marge_pct`.
- `frontend/src/api/stats.ts` — extend `PreviousKpis` type.
- `frontend/src/pages/rapports/pharmacyRapports.tsx` — replace buggy inline computation.

**Effort:** S (extract helper + 4-line frontend replacement + tests).

### PG-001 + PG-002 — Stock Min/Max + Statut bands + filter
- Code: status logic
  [backend/routers/stats/stock.py:34-44](backend/routers/stats/stock.py#L34-L44); min/max
  computation [:266-283](backend/routers/stats/stock.py#L266-L283); frontend
  [pages/stock/index.tsx:26-33](frontend/src/pages/stock/index.tsx#L26-L33) STATUS_OPTIONS +
  [:296-301](frontend/src/pages/stock/index.tsx#L296-L301) columns.
- Client repro (photo 3 of 2026-05-30(+1) batch): DOLIPRANE CO 1000MG B10 with
  `ventes_12m=2359`, `stock_actuel=258`. Today the dashboard displays `stock_min=4`,
  `stock_max=6`, status **Sur-stock** — wrong. By the new spec ADS = 2359/365 ≈ 6.46/day,
  `days_of_coverage ≈ 258/6.46 ≈ 39.9` → **Sous-stock**. Displayed `Stock Min` ≈ 290,
  `Stock Max` ≈ 388.
- Approach:
  1. Compute `days_of_coverage = current_stock × 365 / ventes_12m` per (pharmacy, medicament).
     Treat `ventes_12m == 0` as `inconnu`.
  2. Status from the 4 client-confirmed bands:
     `days ≤ 45 → sous-stock`, `46 ≤ days ≤ 60 → idéal`, `61 ≤ days ≤ 99 → à surveiller`,
     `days ≥ 100 → sur-stock`. (Drops the original PDF's `critique <30j` bucket — superseded.)
  3. Recompute displayed `Stock Min` = `round(ventes_12m × 45 / 365)`,
     `Stock Max` = `round(ventes_12m × 60 / 365)`. Stop honouring
     `PharmacyStock.sobrus_stock_min/max` — Sobrus' values don't match this spec and were a
     source of confusion (the audit pinned the bug to these). Keep the columns for ingestion
     but ignore at read time.
  4. New `?status=` filter on the stock list endpoint (multi-value, comma-separated).
  5. Update frontend `STATUS_OPTIONS` labels + colours: green = `idéal`, orange =
     `à surveiller`, red-tinted = `sous-stock`, blue/grey = `sur-stock`, neutral = `inconnu`.
- Tests: pin DOLIPRANE-style fixture (ventes_12m=2359, stock_actuel=258) → expect Sous-stock and
  the new Stock Min/Max values; one fixture per band.
- Effort: M (formula change + status enum migration + status filter wired through both pages).

---

## Phase 2 — IMPORTANT (daily pharmacist workflow)

### PG-009 — Résumé total sous la jauge
- Code: backend already returns `bl_count` / `unit_count` / `total_mad`
  ([transactions.py:190-247](backend/routers/transactions.py#L190-L247));
  frontend [pages/achat/index.tsx:76-101](frontend/src/pages/achat/index.tsx#L76-L101)
  (NeedleGauge) and [:103-146](frontend/src/pages/achat/index.tsx#L103-L146) (SupplierSummarySection).
- Approach: aggregate the existing per-supplier-type totals into a global total client-side,
  render a 3-tile block (somme commandée, nb BL, nb unités) directly under the gauge. Re-fetches
  on every filter change because it shares the same query.
- Effort: S.

### PG-008 — "Produits sans date de péremption" card
- Code: [backend/routers/stats/peremptions.py:30-52](backend/routers/stats/peremptions.py#L30-L52)
  currently filters `expiry_date.isnot(None)`; frontend
  [pages/alertes/index.tsx:165-196](frontend/src/pages/alertes/index.tsx#L165-L196).
- Approach: add a sibling aggregate that counts + sums value for `expiry_date IS NULL`; render a
  4th card alongside the three existing péremption cards, with a drill-down list.
- Effort: S.

### PG-006 — Tolerant supplier/laboratoire search (with `*` wildcard)
- Code: [backend/routers/transactions.py:172-187](backend/routers/transactions.py#L172-L187) uses
  `ilike(f"{q}%")`; existing utils at `backend/utils/strings.py` (`strip_accents`) +
  `backend/utils/search.py` (`product_search_clauses` / `tokenize_search`) are already used for
  product search.
- Approach: refactor `get_achat_suggestions` + `achat_supplier_summary` to reuse those utils
  (multi-token, accent-insensitive, fragment match). **Explicitly handle `*` as a wildcard**
  inside a token (split on `*`, ALL fragments must be present anywhere) — the client called it
  out twice as the way pharmacists already type. Apply the same to product/medicament search if
  it doesn't already.
- Acceptance: "CDP", "para", "societe para", "Société PARA", "soc*cdp" all return
  `Société PARA LA CDP`.
- Effort: S.

### PG-003 — Drop CSV; ship Excel + PDF
- Code: [frontend/src/utils/table.ts:34-51](frontend/src/utils/table.ts#L34-L51) `downloadCSV`;
  used in `pages/achat/index.tsx:385-399`, `pages/ventes/index.tsx:449-460`,
  `pages/stock/index.tsx:296`. Backend has no `text/csv` route — CSV is built client-side.
  `openpyxl` is **already in `backend/requirements.txt`**.
- Approach: backend — add `?format=xlsx|pdf` to the list endpoints (xlsx via openpyxl, PDF via
  reportlab — add to requirements; or via weasyprint if HTML template is preferred). Frontend —
  replace `downloadCSV` calls with `downloadXlsx` + `downloadPdf`, remove CSV from the export
  menu/button across the three pages.
- Effort: L (server-side generation is the new piece).

### PG-007 — Exclusion par numéro de BL (re-confirmed by client "pour la compta")
- Code: `Achat.delivery_ref` exists ([models/transactions.py](backend/models/transactions.py)); no
  BL-exclusion table; the only exclusion lives in `PharmacyMedicamentStatus` (per-medicament).
  Current dialog
  [pages/owner/catalogRequests.tsx](frontend/src/pages/owner/catalogRequests.tsx) only searches by
  produit / fournisseur / code-barres — no BL search.
- Approach: new table `PharmacyBlExclusion(id, pharmacy_id, delivery_ref, notes, created_at,
  unique(pharmacy_id, delivery_ref))`. Add the exclusion filter to **every** achats/ventes/marges
  query path that already filters non-déclarés
  (e.g. [stats/marge.py](backend/routers/stats/marge.py),
  [routers/transactions.py](backend/routers/transactions.py),
  [stats/peremptions.py:30-52](backend/routers/stats/peremptions.py#L30-L52)). UI: extend the
  Exclure dialog with a second tab/search-mode "Par BL" (lookup by `delivery_ref`); existing list
  view shows excluded BLs alongside excluded products with "Réintégrer".
- **Blocker:** how do we match ventes to a specific BL? No invoice linkage in the schema — Vente
  references the medicament but not the BL it came from. Discuss with client (open clarification
  #2). **Ship the BL-by-number exclusion path first** (achats only); add the ventes-matching half
  in a follow-up once the matching rule is agreed.
- Effort: L (3-5 days).

---

## Phase 3 — UX

### PG-015 — Direct theme toggle (click sun/moon, no menu)
- Code: [components/theme/themeToggle.tsx:14-60](frontend/src/components/theme/themeToggle.tsx#L14-L60).
- Approach: replace DropdownMenu with a `Button` that flips between `light` ↔ `dark` via
  `useTheme()`. Move "Système" to a settings page.
- Effort: XS.

### PG-011 — Split date début / date fin into two fields
- Code: [components/ui/dateRangePicker.tsx:59-337](frontend/src/components/ui/dateRangePicker.tsx#L59-L337);
  used through [components/pageFilter.tsx:75-80](frontend/src/components/pageFilter.tsx#L75-L80).
- Approach: add a `variant="split"` mode that renders two distinct labeled inputs (Date début,
  Date fin) but shares the existing onFromChange/onToChange callbacks. Keep "Réinitialiser".
- Effort: S.

### PG-014 — Column sort (audit + wire-up)
- Code: [DataTable/dataTable.tsx:82-111](frontend/src/components/DataTable/dataTable.tsx#L82-L111)
  already supports sort + chevrons; `pages/achat/index.tsx:374` uses `manualSorting: true`.
- Approach: audit each consumer page; confirm column defs allow sort on Stock dispo / Ventes /
  PPV / PU moyen / Marge % / Marge DH / Catégorie; verify the corresponding backend endpoints
  actually order by the column when `manualSorting` round-trips a sort param. Add unit tests for
  the order_by paths.
- Effort: S (mostly verification).

---

## Phase 4 — Net-new tickets from 2026-05-30 client batch

### PG-016 — Add "DH" suffix to marge values (CRITIQUE for readability)
- Code: dashboard tile at
  [frontend/src/pages/analyse/index.tsx:275](frontend/src/pages/analyse/index.tsx#L275) renders
  `{k.marge_dh_avg != null ? fmt(...) : "—"}` with **no unit**; column label at
  [pages/rapports/margeTable.tsx:45](frontend/src/pages/rapports/margeTable.tsx#L45) reads
  "Marge DH moy.".
- Approach: append " DH" after every formatted marge_dh value (tiles + table cells); rename the
  marge-DH tile title from "Marge moyenne (MAD)" to "Marge moyenne (DH)" for consistency with the
  rest of the app — pharmacists read DH, not MAD.
- Effort: XS. Bundle with PG-015.

### PG-017 — Reorder Analyses tabs
- Code: tab order hardcoded in `MODE_LABELS` at
  [pages/analyse/index.tsx:21-30](frontend/src/pages/analyse/index.tsx#L21-L30); rendered via
  `Object.keys(MODE_LABELS)` at line 198 (respects insertion order).
- Approach: reorder the keys per the client-preferred order (confirm with client before changing).
  Allow user-side reordering only if they ask for it — for now a single fixed sequence is fine.
- Open: which order does the client want? Ask before merging.
- Effort: XS.

### PG-018 — Export from Analyses ships ALL achats instead of the analysed list
- Code: export handler at
  [frontend/src/hooks/useAnalysePage.ts:93-112](frontend/src/hooks/useAnalysePage.ts#L93-L112)
  currently calls a client-side `exportCsv()` on the filtered `margeData` rows; there is **no**
  `/stats/analyse-marge` export branch on the backend
  ([backend/routers/stats/router.py:148-161](backend/routers/stats/router.py#L148-L161)).
- Theory: there is probably a second Export entry point on the Analyses page (toolbar action)
  that wires to `transactionsApi.exportAchat` instead. Reproduce first by clicking every export
  surface on the Analyses page (Liste mode + each tab); identify which one shells out to the
  achats export.
- Approach: route Analyses exports through a new `?export=xlsx|pdf` branch on
  `/stats/analyse-marge` that respects the active mode + filters and returns the same rows the
  user sees. Bundle with PG-003 (Excel/PDF generation infrastructure).
- Effort: M (couples with PG-003 backend work).

### PG-021 — Owner signup: required `city` + auto-generated pharmacy code (✅ already shipped)
- Client spec: at signup the owner gives a city (required); the system derives a code like
  `Bouskoura → BOU0001` (next free counter per city prefix).
- **Already implemented end-to-end:**
  - `Pharmacy.city` + `Pharmacy.code` columns ([backend/models/auth.py:9-22](backend/models/auth.py#L9-L22)).
  - `generate_pharmacy_code(db, city)` utility in
    [backend/utils/pharmacy_code.py](backend/utils/pharmacy_code.py) produces a unique
    3-letter-prefix + 4-digit-counter code. Handles accents (`Fès → FES`), pads short names
    (`X → XXX`), retries on collision.
  - Signup endpoint POST `/auth/signup` at
    [backend/routers/auth.py:55-106](backend/routers/auth.py#L55-L106) calls the generator
    automatically (line 86) when creating a new Pharmacy.
  - Schema [backend/schemas/auth.py:6-14](backend/schemas/auth.py#L6-L14) makes
    `pharmacy_city` required when no `pharmacy_id` is provided.
  - Frontend signup form at
    [pages/signup/index.tsx:202-214](frontend/src/pages/signup/index.tsx#L202-L214) collects
    the city with placeholder "Bouskoura", validated client-side at
    [schemas/signupForm.ts:29-34](frontend/src/schemas/signupForm.ts#L29-L34).
  - Tests pass at [tests/test_pharmacy_code.py](backend/tests/test_pharmacy_code.py).
- **Possible gaps worth checking with the client (none are bugs per se):**
  - Is the generated `code` displayed back to the owner anywhere (signup success screen,
    profile, dashboard header)? If not, the owner won't know their identifier. Likely worth a
    small UI addition.
  - Free-text city input means typo variants (`Bouskoura` vs `BouskouRa` vs `Bou Skoura`)
    could create distinct prefixes. Consider a dropdown of Moroccan cities once the spec for
    accepted cities is agreed.
- **Action:** verify (1) above in the live app before declaring this fully closed; if the code
  isn't surfaced anywhere, add a one-line `<Badge>{pharmacy.code}</Badge>` to the dashboard
  header. Otherwise no work needed.

### PG-020 — Reclassify "Diététique" as Pharmacie (not Parapharmacie)
- Client says: "Diététique c'est Pharmacie et non Parapharmacie." The Excel screenshot in
  this batch shows lines like `BIO LAIT PRIMEA 3EME AGE 800G` with `Catégorie = Dietetique` and
  `Type = Parapharmacie` — that's the bug.
- Code: the auto-classifier
  [backend/routers/stats/queries.py:31-45](backend/routers/stats/queries.py#L31-L45)
  `_pharma_expr()` matches `category` against `edicament / édicament / oméopath / omeopath`
  and falls back to `else_=False` (Parapharmacie). Diététique falls through to False.
- Approach: add two SQL `case` branches inside the `auto` block for `iététique` and
  `ietetique` (accent + non-accent), returning `True`. One-line change with predictable
  cascade — `_pharma_expr` is used by every endpoint that splits Pharmacie vs Parapharmacie:
  `_compute_extra_stats` (CA breakdown + type_breakdown), `cat_filter_v/a` in queries.py,
  marge analyse-marge mode filters, achat export (once PG-019 lands), the marge brackets
  function. No frontend change required — classification is single-source-of-truth.
- Admin overrides via `Medicament.product_type` still take precedence (`pharmacie` /
  `parapharmacie` rows already win). Untouched.
- Tests: add a `Dietetique` fixture in `tests/factories.py`-style helpers; assert it now
  rolls into Pharmacie aggregates (CA breakdown, marge, type_breakdown counts).
- Effort: XS code, S testing (numbers across the dashboard shift, so QA needs to re-check
  Phase 1 marge / variation tests don't regress on the new classification).

### PG-019 — Achat export missing Pharmacie / Parapharmacie column
- Code: row builder
  [backend/routers/transactions.py:87-109](backend/routers/transactions.py#L87-L109)
  (`_build_achat_row`) returns `category` (raw Medicament.category string) but no pharma-vs-para
  flag. Existing classifier `_pharma_expr()` at
  [backend/routers/stats/queries.py:31-45](backend/routers/stats/queries.py#L31-L45) gives a
  SQLAlchemy expression that returns `True` for pharmacie / `False` for parapharmacie.
- Approach: add a `category_type` field to `_build_achat_row` derived from `_pharma_expr` (or a
  Python helper using the same regex), emit it on the JSON response, and surface it as a column
  in the Excel/PDF exporter so the user can pivot achats by Pharmacie / Parapharmacie. Bundle
  with PG-003.
- Effort: S.

---

## Recommended execution order

```
Phase 1 (sequential, fastest-impact first):
  PG-013 ✅ → PG-010 ✅ → PG-004 ✅ → PG-020 ✅ → PG-001/PG-002 ✅
  → PG-005/PG-012 (blocked on a real client CSV showing the JUNIOR row)

  Side quests: PG-013 follow-up ✅ (commit 5907fdf), PG-021 ✅ (commit 1f807be).

Phase 2 (bundle the export tickets together for one Excel/PDF infra change):
  PG-009 ✅ → PG-008 ✅ → PG-006 ✅ → { PG-003 + PG-018 + PG-019 } → PG-007 (after client
  clarifies the ventes-matching rule; ship BL-by-number exclusion alone first)

Phase 3 — quick UX wins (any order, batch in one PR if possible):
  PG-015 ✅ → PG-016 ✅ → PG-011 ✅ → PG-014 → PG-017 (needs client tab-order spec)
```

## Per-ticket verification
Each ticket has a "CRITÈRE DE VALIDATION QA" in the report — use it verbatim as the acceptance
test. End-to-end before any merge:
- Backend tests for any formula change (add unit tests under `backend/tests/` for the shared
  finance utils).
- `cd frontend && npx tsc --noEmit && npm test`.
- Manual walkthrough via `make dev` (Docker must be running) on the relevant page.
