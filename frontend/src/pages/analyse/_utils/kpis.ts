/** Client-side mirror of the backend `_compute_kpis` (backend/analyse_queries.py:532).
 *
 *  Purpose: the /analyses KPI cards must ADAPT to the client-side text search.
 *  Date/category filters already flow through the API (backend recomputes), but
 *  the text search only filters rows in the browser — so when a search is
 *  active we recompute the whole KPI block from the filtered rows with the
 *  exact same algorithm the backend uses:
 *
 *   - rows carrying `marge_pct`     (produit, liste)                → branch A
 *   - rows carrying `marge_pct_avg` (categorie/grossiste/laboratoire) → branch B
 *   - neither (operateur/mois/annee)                                → marge KPIs null
 *
 *  One deliberate difference: backend `total_ventes_dh` comes from SQL for
 *  Dashboard parity; client-side we can only sum the visible rows' `ca` —
 *  which is exactly what "adapted to the search" means here.
 */
import type { AnalyseMargeKpis, AnalyseMargeRow, MargeKpiPoint } from "@/types";


const round2 = (x: number) => Math.round(x * 100) / 100;
const round3 = (x: number) => Math.round(x * 1000) / 1000;
/** Numeric coercion for optional row fields (None/undefined → 0). */
const n = (v: number | null | undefined) => Number(v ?? 0);
/** Python `a or b` semantics: falls back when a is null/undefined OR 0. */
const orFb = (a: number | null | undefined, b: number | null | undefined) => n(a) || n(b);

const maxBy = <T,>(arr: T[], f: (t: T) => number): T => arr.reduce((a, b) => (f(b) > f(a) ? b : a));
const minBy = <T,>(arr: T[], f: (t: T) => number): T => arr.reduce((a, b) => (f(b) < f(a) ? b : a));


export function computeKpisFromRows(rows: AnalyseMargeRow[]): AnalyseMargeKpis {
  const totalCa     = rows.reduce((s, r) => s + n(r.ca), 0);
  const totalUnites = rows.reduce((s, r) => s + n(r.qty), 0);
  const unitsAvail  = rows.reduce((s, r) => s + n(r.stock_dispo), 0);
  const puPurchased = rows.reduce((s, r) => s + n(r.total_achat_cost), 0);
  const ppvAvail    = rows.reduce((s, r) => s + n(r.ppv_potentiel), 0);

  const kpis: AnalyseMargeKpis = {
    total_ventes_dh:       round2(totalCa),
    total_ventes_unites:   round2(totalUnites),
    // Backend: `round(x, 2) if x else None` — zero sums render as "—".
    total_units_available: unitsAvail  ? round2(unitsAvail)  : null,
    total_pu_purchased:    puPurchased ? round2(puPurchased) : null,
    ppv_total_available:   ppvAvail    ? round2(ppvAvail)    : null,
    marge_pct_avg: null, marge_pct_min: null, marge_pct_max: null,
    marge_dh_avg:  null, marge_dh_min:  null, marge_dh_max:  null,
    difference_gain_dh: null,
  };

  const margeRows    = rows.filter((r) => r.marge_pct != null);
  const margeAvgRows = rows.filter((r) => r.marge_pct_avg != null);

  if (margeRows.length) {
    // Branch A — produit/liste rows. Marge moyenne (%) is the Dashboard
    // "marge mixte": (1 − Σqty·PU / Σqty·PPV) × 100.
    const totalQty = margeRows.reduce((s, r) => s + n(r.qty), 0);
    if (totalQty) {
      const sumQtyPpv = margeRows.reduce((s, r) => s + n(r.qty) * n(r.ppv), 0);
      const sumQtyPu  = margeRows.reduce((s, r) => s + n(r.qty) * n(r.pu),  0);
      kpis.marge_pct_avg = sumQtyPpv ? round3((1 - sumQtyPu / sumQtyPpv) * 100) : null;
      kpis.marge_dh_avg  = round2(
        margeRows.reduce((s, r) => s + n(r.qty) * n(r.marge_dh), 0) / totalQty);
    }
    const bestPctVal  = (r: AnalyseMargeRow) => orFb(r.marge_pct_best,  r.marge_pct);
    const worstPctVal = (r: AnalyseMargeRow) => orFb(r.marge_pct_worst, r.marge_pct);
    const bestDhVal   = (r: AnalyseMargeRow) => orFb(r.marge_dh_best,   r.marge_dh);
    const worstDhVal  = (r: AnalyseMargeRow) => orFb(r.marge_dh_worst,  r.marge_dh);
    const bp = maxBy(margeRows, bestPctVal);
    const wp = minBy(margeRows, worstPctVal);
    const bd = maxBy(margeRows, bestDhVal);
    const wd = minBy(margeRows, worstDhVal);
    const pt = (r: AnalyseMargeRow, value: number): MargeKpiPoint =>
      ({ label: r.product ?? "", value, qty: n(r.qty) });
    kpis.marge_pct_max = pt(bp, bestPctVal(bp));
    kpis.marge_pct_min = pt(wp, worstPctVal(wp));
    kpis.marge_dh_max  = pt(bd, bestDhVal(bd));
    kpis.marge_dh_min  = pt(wd, worstDhVal(wd));
    // NB: backend multiplies by the PLAIN marge_dh here, not the best/worst variant.
    kpis.difference_gain_dh = round2(n(bd.qty) * n(bd.marge_dh) - n(wd.qty) * n(wd.marge_dh));
  } else if (margeAvgRows.length) {
    // Branch B — categorie/grossiste/laboratoire rows (pre-averaged per group).
    const sample   = margeAvgRows[0] as Record<string, unknown>;
    const labelKey = sample.category !== undefined ? "category"
      : sample.grossiste !== undefined ? "grossiste"
      : sample.laboratoire !== undefined ? "laboratoire"
      : "category";
    const labelOf = (r: AnalyseMargeRow) =>
      String((r as unknown as Record<string, unknown>)[labelKey] ?? "");
    const totalQty = margeAvgRows.reduce((s, r) => s + n(r.qty), 0);
    if (totalQty) {
      kpis.marge_pct_avg = round3(
        margeAvgRows.reduce((s, r) => s + n(r.qty) * n(r.marge_pct_avg), 0) / totalQty);
      kpis.marge_dh_avg  = round2(
        margeAvgRows.reduce((s, r) => s + n(r.qty) * n(r.marge_dh_avg), 0) / totalQty);
    }
    const bp = maxBy(margeAvgRows, (r) => n(r.marge_pct_avg));
    const wp = minBy(margeAvgRows, (r) => n(r.marge_pct_avg));
    const bd = maxBy(margeAvgRows, (r) => n(r.marge_dh_avg));
    const wd = minBy(margeAvgRows, (r) => n(r.marge_dh_avg));
    kpis.marge_pct_max = { label: labelOf(bp), value: n(bp.marge_pct_avg), qty: n(bp.qty) };
    kpis.marge_pct_min = { label: labelOf(wp), value: n(wp.marge_pct_avg), qty: n(wp.qty) };
    kpis.marge_dh_max  = { label: labelOf(bd), value: n(bd.marge_dh_avg),  qty: n(bd.qty) };
    kpis.marge_dh_min  = { label: labelOf(wd), value: n(wd.marge_dh_avg),  qty: n(wd.qty) };
    kpis.difference_gain_dh = round2(
      n(bd.qty) * n(bd.marge_dh_avg) - n(wd.qty) * n(wd.marge_dh_avg));
  }

  return kpis;
}
