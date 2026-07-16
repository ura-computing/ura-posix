/** Parity tests for the client-side KPI mirror of backend `_compute_kpis`
 *  (backend/analyse_queries.py:532). The expected values below are the exact
 *  outputs of the backend function for the same fixture rows (cross-checked by
 *  running `_compute_kpis` directly) — only `total_ventes_dh` differs by
 *  design: backend uses SQL (Dashboard parity), client sums the rows' `ca`. */
import { describe, expect, it } from "vitest";

import { computeKpisFromRows } from "../kpis";
import type { AnalyseMargeRow } from "@/types";


// produit/liste-shaped rows (marge_pct + best/worst variants) → branch A
const BRANCH_A = [
  { product: "A", qty: 10, ca: 1000, ppv: 100, pu: 60, marge_dh: 40,
    marge_pct: 40, marge_pct_best: 45, marge_pct_worst: 35,
    marge_dh_best: 45, marge_dh_worst: 30,
    stock_dispo: 5, ppv_potentiel: 500, total_achat_cost: 600 },
  { product: "B", qty: 5, ca: 400, ppv: 80, pu: 56, marge_dh: 24,
    marge_pct: 30, marge_pct_best: 30, marge_pct_worst: 30,
    marge_dh_best: 24, marge_dh_worst: 24,
    stock_dispo: 2, ppv_potentiel: 160, total_achat_cost: 280 },
  { product: "C", qty: 2, ca: 90, ppv: 45, pu: 40.5, marge_dh: 4.5,
    marge_pct: 10, marge_pct_best: 10, marge_pct_worst: 10,
    marge_dh_best: 4.5, marge_dh_worst: 4.5,
    stock_dispo: 0, ppv_potentiel: 0, total_achat_cost: 81 },
] as AnalyseMargeRow[];

// categorie-shaped rows (pre-averaged) → branch B
const BRANCH_B = [
  { category: "X", qty: 10, ca: 1000, marge_pct_avg: 30, marge_dh_avg: 20 },
  { category: "Y", qty: 30, ca: 2500, marge_pct_avg: 36, marge_dh_avg: 25 },
] as AnalyseMargeRow[];

// mois/operateur-shaped rows (no marge fields) → marge KPIs stay null
const QTY_ONLY = [
  { mois: "2026-01", nb_transactions: 4, qty: 7, ca: 350 },
  { mois: "2026-02", nb_transactions: 2, qty: 3, ca: 150 },
] as AnalyseMargeRow[];


describe("computeKpisFromRows — mirror of backend _compute_kpis", () => {
  it("branch A (produit/liste rows): marge mixte + best/worst + gain", () => {
    expect(computeKpisFromRows(BRANCH_A)).toEqual({
      total_ventes_dh:       1490,   // Σ ca (client-side semantics)
      total_ventes_unites:   17,
      total_units_available: 7,
      total_pu_purchased:    961,
      ppv_total_available:   660,
      // marge mixte: (1 − 961/1490) × 100 = 35.503
      marge_pct_avg: 35.503,
      // Σ qty·marge_dh / Σ qty = 529/17
      marge_dh_avg:  31.12,
      marge_pct_max: { label: "A", value: 45,  qty: 10 },
      marge_pct_min: { label: "C", value: 10,  qty: 2 },
      marge_dh_max:  { label: "A", value: 45,  qty: 10 },
      marge_dh_min:  { label: "C", value: 4.5, qty: 2 },
      // 10×40 − 2×4.5 — backend multiplies by PLAIN marge_dh, not the best variant
      difference_gain_dh: 391,
    });
  });

  it("branch B (categorie rows): qty-weighted averages + labels", () => {
    expect(computeKpisFromRows(BRANCH_B)).toEqual({
      total_ventes_dh:       3500,
      total_ventes_unites:   40,
      total_units_available: null,   // zero sums → null → "—" (backend convention)
      total_pu_purchased:    null,
      ppv_total_available:   null,
      marge_pct_avg: 34.5,           // (10×30 + 30×36) / 40
      marge_dh_avg:  23.75,          // (10×20 + 30×25) / 40
      marge_pct_max: { label: "Y", value: 36, qty: 30 },
      marge_pct_min: { label: "X", value: 30, qty: 10 },
      marge_dh_max:  { label: "Y", value: 25, qty: 30 },
      marge_dh_min:  { label: "X", value: 20, qty: 10 },
      difference_gain_dh: 550,       // 30×25 − 10×20
    });
  });

  it("qty-only rows (mois/operateur/annee): marge KPIs stay null", () => {
    expect(computeKpisFromRows(QTY_ONLY)).toEqual({
      total_ventes_dh:       500,
      total_ventes_unites:   10,
      total_units_available: null,
      total_pu_purchased:    null,
      ppv_total_available:   null,
      marge_pct_avg: null, marge_pct_min: null, marge_pct_max: null,
      marge_dh_avg:  null, marge_dh_min:  null, marge_dh_max:  null,
      difference_gain_dh: null,
    });
  });

  it("empty rows (search with 0 matches): zeros + nulls, no crash", () => {
    expect(computeKpisFromRows([])).toEqual({
      total_ventes_dh:       0,
      total_ventes_unites:   0,
      total_units_available: null,
      total_pu_purchased:    null,
      ppv_total_available:   null,
      marge_pct_avg: null, marge_pct_min: null, marge_pct_max: null,
      marge_dh_avg:  null, marge_dh_min:  null, marge_dh_max:  null,
      difference_gain_dh: null,
    });
  });

  it("single row: gauge shows 0 (no spread within one product)", () => {
    const k = computeKpisFromRows([BRANCH_A[0]]);
    expect(k.difference_gain_dh).toBe(0);   // 10×40 − 10×40
    expect(k.marge_pct_max?.label).toBe("A");
    expect(k.marge_pct_min?.label).toBe("A");
  });
});
