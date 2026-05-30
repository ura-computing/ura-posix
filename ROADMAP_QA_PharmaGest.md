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

## Two clarifications to request from the client first

1. **PG-001 — Stock Min / Stock Max formula.** The report names buckets in days-of-coverage but
   doesn't give the formula for the displayed `Stock Min` / `Stock Max` columns. Current code
   ([stock.py:266-283](backend/routers/stats/stock.py#L266-L283)) does
   `stock_min = floor(ventes12m/300 × 14)`, `stock_max = ceil(ventes12m/300 × 15)`. Likely target:
   derive both from the OK band (60-70 days) × avg daily sales — needs explicit confirmation.
2. **PG-007 — "% d'achat" alternative.** What baseline? Per BL, per supplier, over the active
   period? And how do we match ventes to a specific BL (Vente has no `delivery_ref` link)?

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

### PG-013 — Drop PPH fallback for marge (do first — it's a 1-line fix that unblocks PG-005/012)
- Code: [backend/routers/stats/marge.py:73](backend/routers/stats/marge.py#L73) — falls back to
  `Medicament.pph` when no Achat data. Sobrus' fiche produit often has `PPH = PPV`, so this yields
  fake 0 % margins.
- Approach: remove the fallback. When no Achat row exists, return `null` PU and let the UI show
  "—". Add a regression test with `PPH == PPV` to prove margin is no longer computed.
- Effort: XS.

### PG-005 + PG-012 — PU réel from BL after remise
- Code: [backend/models/transactions.py:21-46](backend/models/transactions.py#L21-L46) — `Achat` has
  `unit_price` but **no per-line `discount`** (Vente has one at :64). Avg PU built at
  [marge.py:44-55](backend/routers/stats/marge.py#L44-L55).
- Question: does Sobrus expose the per-line PU **after** remise on the BL? Audit the import path
  ([extension/src/content/sobrusExport.ts](extension/src/content/sobrusExport.ts) + the backend
  ingestion endpoint that consumes those chunks) — if `unit_price` already reflects the discounted
  PU, no schema change. If not, add `Achat.discount` and a backfill migration.
- Acceptance (PG-012): on a BL with `PU=39.42`, `PPV=54` → marge ≈ 27 %.
- Effort: M (depends on import audit).

### PG-010 — Marge % + DH for grossistes
- Code: [marge.py:242-273](backend/routers/stats/marge.py#L242-L273) (grossiste branch skips margin);
  [frontend/src/pages/rapports/margeTable.tsx:49-56](frontend/src/pages/rapports/margeTable.tsx#L49-L56)
  (columns missing).
- Approach: apply the same weighted avg PU vs avg PPV computation already used in product mode;
  add `marge_pct` / `marge_dh` to grossiste rows; add the two columns to the table config.
- Effort: S.

### PG-004 — Variation marge arithmetic
- Code: backend returns `previous_kpis` at
  [stats/queries.py:327-393](backend/routers/stats/queries.py#L327-L393); frontend computes the
  "vs an dernier" badge — grep `previous_kpis` in `pages/welcome.tsx` / `pages/rapports/*`.
- Approach: verify the displayed % uses `(T1-T0)/T0×100` with 2-decimal rounding, not absolute
  difference. Centralize via shared util from the cross-cutting section.
- Acceptance: Avril 2025 = 31.7 %, Avril 2026 = 32.6 % → **+2.84 %**.
- Effort: S.

### PG-001 + PG-002 — Stock Min/Max + Statut bands + filter
- Code: status logic
  [backend/routers/stats/stock.py:34-44](backend/routers/stats/stock.py#L34-L44); min/max
  computation [:266-283](backend/routers/stats/stock.py#L266-L283); frontend
  [pages/stock/index.tsx:26-33](frontend/src/pages/stock/index.tsx#L26-L33) STATUS_OPTIONS +
  [:296-301](frontend/src/pages/stock/index.tsx#L296-L301) columns.
- Approach:
  1. Compute `days_of_coverage = current_stock / (ventes_12m / 365)` per (pharmacy, medicament).
  2. New status from the 5 bands above (returns `critique | sous-stock | ok | a-surveiller |
     sur-stock`).
  3. Recompute displayed `stock_min` / `stock_max` from the OK band edges (60 × ADS, 70 × ADS) —
     **pending client confirmation** (open clarification #1).
  4. New `?status=` filter on the stock list endpoint.
  5. Update frontend STATUS_OPTIONS labels + colors (orange for "à surveiller"); plug the filter.
- Effort: M.

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

### PG-006 — Tolerant supplier/laboratoire search
- Code: [backend/routers/transactions.py:172-187](backend/routers/transactions.py#L172-L187) uses
  `ilike(f"{q}%")`; existing utils at `backend/utils/strings.py` (`strip_accents`) +
  `backend/utils/search.py` (`product_search_clauses` / `tokenize_search`) are already used for
  product search.
- Approach: refactor `get_achat_suggestions` + `achat_supplier_summary` to reuse those utils
  (multi-token, accent-insensitive, fragment match). Consider adding a normalized supplier column
  for index performance once the query shape is settled.
- Acceptance: "CDP", "para", "societe para", "Société PARA" all return `Société PARA LA CDP`.
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

### PG-007 — Exclusion par numéro de BL
- Code: `Achat.delivery_ref` exists ([models/transactions.py](backend/models/transactions.py)); no
  BL-exclusion table; the only exclusion lives in `PharmacyMedicamentStatus` (per-medicament).
- Approach: new table `PharmacyBlExclusion(id, pharmacy_id, delivery_ref, notes, created_at,
  unique(pharmacy_id, delivery_ref))`. Add the exclusion filter to **every** achats/ventes/marges
  query path that already filters non-déclarés
  (e.g. [stats/marge.py](backend/routers/stats/marge.py),
  [routers/transactions.py](backend/routers/transactions.py),
  [stats/peremptions.py:30-52](backend/routers/stats/peremptions.py#L30-L52)). UI: new tab under
  "Produits spéciaux" with BL search/list + "Réintégrer".
- **Blocker:** how do we match ventes to a specific BL? No invoice linkage in the schema — Vente
  references the medicament but not the BL it came from. Discuss with client before building
  (open clarification #2). Until then, this ticket should ship without the "remove equivalent
  ventes" piece, or with an explicit approximation documented to the client.
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

## Recommended execution order

```
Phase 1 (sequential, fastest-impact first):
  PG-013 → PG-005/PG-012 → PG-010 → PG-004 → PG-001/PG-002

Phase 2 (in this order):
  PG-009 → PG-008 → PG-006 → PG-003 → PG-007 (after client clarifies)

Phase 3 (any order):
  PG-015 → PG-011 → PG-014
```

## Per-ticket verification
Each ticket has a "CRITÈRE DE VALIDATION QA" in the report — use it verbatim as the acceptance
test. End-to-end before any merge:
- Backend tests for any formula change (add unit tests under `backend/tests/` for the shared
  finance utils).
- `cd frontend && npx tsc --noEmit && npm test`.
- Manual walkthrough via `make dev` (Docker must be running) on the relevant page.
