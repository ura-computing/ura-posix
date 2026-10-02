/** App response ↔ oracle (expected.json) comparisons — every field of every
 *  payload. Specs capture the payload the way the page loads it, then call these. */
import type { Page } from "@playwright/test";

import { loadState } from "./auth";
import { expectSame, expectSameSet, expectTiedPick, TOL, type Row } from "./diff";
import { expected } from "./expected";
import { expect } from "./fixtures";
import { frNumber, kpiValue } from "./ui";

export type { Row } from "./diff";
export type CategoryType = "all" | "pharmacie" | "parapharmacie";
export const CATEGORY_TYPES: { ct: CategoryType; label: string }[] = [
  { ct: "all", label: "Mixte" }, { ct: "pharmacie", label: "Pharmacie" }, { ct: "parapharmacie", label: "Parapharmacie" },
];


// ── Rapport ────────────────────────────────────────────────────────────────

function expectDay(actual: Row | null, e: Row | null, field: "total" | "count", what: string): void {
  if (e === null) { expect(actual, what).toBeNull(); return; }
  expect(Math.abs(Number(actual?.[field]) - e.value), `${what}: ${actual?.[field]} ≠ ${e.value}`).toBeLessThanOrEqual(TOL);
  expect(e.dates, `${what}: date ${actual?.date}`).toContain(actual?.date);
}

/** `e`: another oracle answer of the same shape (Comptabilité with exclusions). */
export function checkStats(s: Row, ct: CategoryType, e: Row = expected().stats[ct]): void {
  expectSame(s.kpis, e.kpis, `stats[${ct}].kpis`);
  expectSame(s.previous_kpis, e.previous_kpis, `stats[${ct}].previous_kpis`);
  expectSame(s.marge, e.marge, `stats[${ct}].marge`);
  expectSame(s.tva, e.tva, `stats[${ct}].tva`);
  expectSame(s.type_breakdown, e.type_breakdown, `stats[${ct}].type_breakdown`);
  expect(s.trend_granularity).toBe(e.trend_granularity);
  expectSame(s.monthly_trend, e.monthly_trend, `stats[${ct}].monthly_trend`);
  expectSame(s.top_categories, e.top_categories, `stats[${ct}].top_categories`);

  const a = s.advanced_kpis;
  const ea = e.advanced_kpis;
  expectSame({ t: a.ticket_moyen, v: a.vente_moyenne_par_jour }, { t: ea.ticket_moyen, v: ea.vente_moyenne_par_jour }, `stats[${ct}] ticket / jour`);
  expectDay(a.best_day_dh, ea.best_day_dh, "total", `stats[${ct}] meilleure journée DH`);
  expectDay(a.worst_day_dh, ea.worst_day_dh, "total", `stats[${ct}] moins bonne journée DH`);
  expectDay(a.best_day_count, ea.best_day_count, "count", `stats[${ct}] meilleure journée (opé)`);
  expectDay(a.worst_day_count, ea.worst_day_count, "count", `stats[${ct}] moins bonne journée (opé)`);
}

export function checkMarginAlerts(s: Row, ct: CategoryType): void {
  const e = expected().margin_alerts[ct];
  for (const [bracket, eb] of Object.entries<Row>(e)) {
    const { products, ...totals } = eb;
    expectSame(s[bracket], totals, `margin-alerts[${ct}].${bracket}`);
    expectSameSet(s[bracket].products, products, (r) => r.product, `margin-alerts[${ct}].${bracket}.products`);
  }
}

export function checkStockSummary(s: Row): void {
  expectSame(s, expected().stock_summary, "stock-summary");
}


// ── Alertes / Stock ────────────────────────────────────────────────────────

export function checkVentesSansAchat(s: Row, ct: CategoryType): void {
  const { products, ...totals } = expected().ventes_sans_achat[ct];
  expectSame(s, totals, `ventes-sans-achat[${ct}]`);
  expectSameSet(s.products, products, (r) => r.product, `ventes-sans-achat[${ct}].products`);
}

export function checkStockAbcd(s: Row, variant: "default" | "window"): void {
  const { products, date_from: _f, date_to: _t, ...totals } = expected()[`stock_abcd_${variant}`];
  expectSame(s, totals, `stock-abcd[${variant}]`);
  expect(Object.keys(s.distribution).sort()).toEqual(Object.keys(totals.distribution).sort());
  expectSameSet(s.products, products, (r) => r.product, `stock-abcd[${variant}].products`);
}

export function checkPeremptions(s: Row): void {
  for (const [bucket, eb] of Object.entries<Row>(expected().peremptions)) {
    const { products, ...totals } = eb;
    expectSame(s[bucket], totals, `péremptions.${bucket}`);
    expectSameSet(s[bucket].products, products, (r) => r.product, `péremptions.${bucket}.products`);
  }
}


// ── Ventes / Achats ────────────────────────────────────────────────────────

export type Ledger = "ventes" | "achats";

export const ledgerKey = (kind: Ledger) => (r: Row): string =>
  kind === "ventes" ? `${r.transaction_ref}|${r.pid}` : `${r.delivery_ref}|${r.pid}`;

function withoutSeq(r: Row): Row {
  const { seq: _s, ...rest } = r;
  return rest;
}

/** Every row of an export (or any full list): all fields + import batch id. */
export function checkLedgerRows(kind: Ledger, rows: Row[], expectedRows: Row[]): void {
  // Same BL / ticket + product can repeat (G1: both lines are real).
  expectSameSet(rows, expectedRows.map(withoutSeq), ledgerKey(kind), `${kind} rows`, { repeats: true });
  const batch = loadState()[`batch_${kind}`];
  const wrong = rows.filter((r) => r.import_batch_id !== batch).length;
  expect(wrong, `${kind} rows with import_batch_id ≠ ${batch}`).toBe(0);
}

/** One list page: summary, pagination, and exactly the expected rows in order. */
export function checkLedgerPage(kind: Ledger, s: Row, summary: Row, page: number, limit = 20): void {
  const totals = kind === "ventes"
    ? { rows_total: summary.rows_total, grand_total: summary.grand_total, tva_collected: summary.tva_collected }
    : { rows_total: summary.rows_total, grand_total: summary.grand_total, tva_payee: summary.tva_payee };
  expectSame(s.summary, totals, `${kind} summary`);
  expectSame(s.pagination, {
    page, limit, total: summary.rows_total,
    total_pages: summary.rows_total ? Math.max(1, Math.ceil(summary.rows_total / limit)) : 0,
  }, `${kind} pagination`);
  const bySeq = new Map<number, Row>(expected()[`${kind}_rows`].map((r: Row) => [r.seq, r]));
  const want = summary.top_seq.slice((page - 1) * limit, page * limit).map((seq: number) => withoutSeq(bySeq.get(seq)!));
  expect(s.data.map(ledgerKey(kind)), `${kind} page ${page} order`).toEqual(want.map(ledgerKey(kind)));
  expectSame(s.data, want, `${kind} page ${page} rows`);
}


/** Summary (same shape as the oracle's) for the rows matching `keep` — used for
 *  filters whose expectation is a plain subset of the window rows. */
export function subsetSummary(kind: Ledger, keep: (r: Row) => boolean): Row {
  const rows = (expected()[`${kind}_rows`] as Row[]).filter(keep);
  const rate = (label: string) => Number(label.replace(/[^0-9.]/g, "") || 0) / 100;
  const sum = (f: (r: Row) => number) => Math.round(rows.reduce((t, r) => t + f(r), 0) * 100) / 100;
  return {
    rows_total: rows.length,
    grand_total: sum((r) => r.total),
    [kind === "ventes" ? "tva_collected" : "tva_payee"]: sum((r) => r.total * rate(r.tva)),
    top_seq: rows.map((r) => r.seq).sort((a, b) => b - a).slice(0, 50),
  };
}


// ── Sorting (page 1 of every sortable column) ──────────────────────────────

const collator = new Intl.Collator("en");

/** Value the backend sorts on, per UI column key. */
export function sortValue(kind: Ledger, r: Row, key: string): string | number | null {
  if (key === "marge_dh") return r.avg_pu == null ? null : r.ppv - r.avg_pu;
  if (key === "marge_pct") return r.avg_pu == null || !r.ppv ? null : (1 - r.avg_pu / r.ppv) * 100;
  return r[key] ?? null;
}

/** Postgres order: plain columns NULLS LAST asc / FIRST desc; joined + computed
 *  columns (product, category, ppv, marge) always NULLS LAST. */
export function expectedSortPage(kind: Ledger, key: string, order: "asc" | "desc", limit = 20): (string | number | null)[] {
  const nullsLastAlways = ["product", "category", "ppv", "pph", "marge_dh", "marge_pct"].includes(key);
  const values = expected()[`${kind}_rows`].map((r: Row) => sortValue(kind, r, key));
  const cmp = (a: string | number, b: string | number) =>
    typeof a === "number" && typeof b === "number" ? a - b : collator.compare(String(a), String(b));
  const nonNull = values.filter((v: unknown) => v !== null).sort(cmp);
  if (order === "desc") nonNull.reverse();
  const nulls = values.filter((v: unknown) => v === null);
  const nullsFirst = order === "desc" && !nullsLastAlways;
  return (nullsFirst ? [...nulls, ...nonNull] : [...nonNull, ...nulls]).slice(0, limit);
}

export function checkSortPage(kind: Ledger, s: Row, key: string, order: "asc" | "desc"): void {
  const got = s.data.map((r: Row) => sortValue(kind, r, key));
  expectSame(got, expectedSortPage(kind, key, order), `${kind} sorted by ${key} ${order}`);
}


// ── Analyses ───────────────────────────────────────────────────────────────

export const ANALYSE_MODES = {
  produit:     { tab: "Produit",     key: (r: Row) => r.product },
  categorie:   { tab: "Catégorie",   key: (r: Row) => r.category },
  laboratoire: { tab: "Laboratoire", key: (r: Row) => r.laboratoire },
  grossiste:   { tab: "Grossistes",  key: (r: Row) => r.grossiste },
  operateur:   { tab: "Client",      key: (r: Row) => r.client },
  mois:        { tab: "Mois",        key: (r: Row) => r.mois },
  annee:       { tab: "Année",       key: (r: Row) => String(r.annee) },
} as const;

export type AnalyseMode = keyof typeof ANALYSE_MODES;

function checkKpis(k: Row, e: Row, ties: Row, what: string): void {
  const picks = ["marge_pct_max", "marge_pct_min", "marge_dh_max", "marge_dh_min"];
  const scalars = Object.fromEntries(Object.entries(e).filter(([n]) => !picks.includes(n) && n !== "difference_gain_dh"));
  expectSame(k, scalars, `${what}.kpis`);
  for (const n of picks) expectTiedPick(k[n], e[n]?.value, ties[n], `${what}.kpis.${n}`);
  if (e.difference_gain_dh === null && !ties.difference_gain_dh) {
    expect(k.difference_gain_dh, `${what}.kpis.difference_gain_dh`).toBeNull();
  } else {
    const ok = (ties.difference_gain_dh as number[]).some((v) => Math.abs(v - Number(k.difference_gain_dh)) <= TOL);
    expect(ok, `${what}.kpis.difference_gain_dh ${k.difference_gain_dh} not in ${JSON.stringify(ties.difference_gain_dh)}`).toBe(true);
  }
}

/** `e` defaults to the oracle's analyse[ct][mode]; pass another oracle answer of the
 *  same shape (e.g. Année filtered by a product). */
export function checkAnalyse(s: Row, ct: CategoryType, mode: AnalyseMode, e: Row = expected().analyse[ct][mode],
                             what = `analyse[${ct}][${mode}]`): void {
  if (mode === "annee") expect(s.rows.map((r: Row) => r.annee), `${what} order`).toEqual(e.rows.map((r: Row) => r.annee));
  expectSameSet(s.rows, e.rows, ANALYSE_MODES[mode].key, `${what}.rows`);
  checkKpis(s.kpis, e.kpis, e.ties, what);
}

export function checkListe(s: Row, e: Row = expected().liste, what = "liste"): void {
  const found = (rows: Row[]) => rows.filter((r) => r.match_status === "found");
  const notFound = (rows: Row[]) => rows.filter((r) => r.match_status === "not_found");
  expectSameSet(found(s.rows), found(e.rows), (r) => r.product, `${what} found rows`);
  expectSame(notFound(s.rows), notFound(e.rows), `${what} not-found rows (in input order, last)`);
  expect(s.rows.slice(-notFound(e.rows).length).every((r: Row) => r.match_status === "not_found"), `${what}: not-found rows are last`).toBe(true);
  checkKpis(s.kpis, e.kpis, e.ties, what);
}


// ── /analyses KPI tiles: what the page SHOWS ────────────────────────────────

const ANALYSE_TILES: [string, string, number | null][] = [   // label, kpi, shown when the kpi is null
  ["Chiffre d'affaires", "total_ventes_dh", 0], ["Marge moyenne (%)", "marge_pct_avg", null],
  ["Marge moyenne (DH)", "marge_dh_avg", null], ["Optimisation", "difference_gain_dh", null],
  ["Unités vendues", "total_ventes_unites", 0], ["Unités disponibles", "total_units_available", null],
  ["Prix unitaires achetés", "total_pu_purchased", null], ["PPV disponibles", "ppv_total_available", null],
];
const near = (a: number | null, b: number | null) => (a === null || b === null ? a === b : Math.abs(a - b) <= 0.006);

/** Each of the 8 tiles shows `k` (the page's API reply, or the oracle for KPIs the page
 *  computes itself). `gains`: tied « Optimisation » values (any one is right). The two
 *  « Marge moyenne » tiles also show « Max x · Min y ». */
export async function checkKpiTiles(page: Page, k: Row, gains?: number[]): Promise<void> {
  for (const [label, field, dflt] of ANALYSE_TILES) {
    const want: (number | null)[] = field === "difference_gain_dh" && gains?.length ? gains : [k[field] ?? dflt];
    const shown = async () => frNumber(await kpiValue(page, label).innerText());
    const ok = await expect.poll(async () => { const v = await shown(); return want.some((w) => near(v, w)); }, { timeout: 10_000 })
      .toBe(true).then(() => true, () => false);
    if (!ok) expect(await shown(), `tuile « ${label} » (attendu ${want.join(" ou ")})`).toBe(want[0]);
  }
  for (const [label, max, min] of [["Marge moyenne (%)", "marge_pct_max", "marge_pct_min"], ["Marge moyenne (DH)", "marge_dh_max", "marge_dh_min"]]) {
    if (!k[max] || !k[min]) continue;
    const text = await kpiValue(page, label).locator("xpath=..").innerText();
    const sub = text.slice(text.indexOf("Max"));
    const nums = (sub.match(/-?\u2212?\d{1,3}(?:[\s\u202f\u00a0]\d{3})*(?:,\d+)?/g) ?? []).map((t) => frNumber(t));
    expect(near(nums[0] ?? null, k[max].value) && near(nums[1] ?? null, k[min].value),
      `« ${label} » : ${sub} ≠ Max ${k[max].value} · Min ${k[min].value}`).toBe(true);
  }
}
