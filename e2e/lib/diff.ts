/** Field-by-field comparison of an app payload with the oracle. Collects EVERY
 *  mismatch (not just the first) so one run shows all that is wrong. */
import { appendFileSync, mkdirSync } from "node:fs";

import { expect } from "./fixtures";
import { COMPARED_FILE, RESULTS_DIR } from "./paths";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

/** Numbers match within TOL: covers float-sum order + round(…, 2|3|4) edges. */
export const TOL = 0.02;

/** Compare `actual` with `expected`. Only keys present in `expected` are checked
 *  (the app may add ids); numbers within TOL, everything else strictly. */
export function diff(actual: unknown, expected: unknown, path = "", out: string[] = []): string[] {
  const show = (v: unknown) => JSON.stringify(v);
  if (typeof expected === "number") {
    if (typeof actual !== "number" || Math.abs(actual - expected) > TOL)
      out.push(`${path}: app ${show(actual)} ≠ expected ${expected}`);
  } else if (expected === null || typeof expected !== "object") {
    if (actual !== expected) out.push(`${path}: app ${show(actual)} ≠ expected ${show(expected)}`);
  } else if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      out.push(`${path}: app ${show(actual)} is not a list`);
      return out;
    }
    if (actual.length !== expected.length)
      out.push(`${path}: app has ${actual.length} items, expected ${expected.length}`);
    expected.forEach((e, i) => {
      if (i < actual.length) diff(actual[i], e, `${path}[${i}]`, out);
    });
  } else {
    if (actual === null || typeof actual !== "object") {
      out.push(`${path}: app ${show(actual)} is not an object`);
      return out;
    }
    for (const [k, e] of Object.entries(expected as Row)) diff((actual as Row)[k], e, path ? `${path}.${k}` : k, out);
  }
  return out;
}

/** Number of single values (numbers, texts, null…) in an oracle payload = values compared. */
function countValues(expected: unknown): number {
  if (expected === null || typeof expected !== "object") return 1;
  return Object.values(expected as Row).reduce((n: number, v) => n + countValues(v), 0);
}

/** One assertion listing up to 40 differences. */
export function expectSame(actual: unknown, expected: unknown, what: string): void {
  mkdirSync(RESULTS_DIR, { recursive: true });
  appendFileSync(COMPARED_FILE, `${countValues(expected)}\n`); // run summary (lib/summary-reporter.ts)
  const d = diff(actual, expected);
  expect(d.slice(0, 40), `${what}: ${d.length} difference(s)`).toEqual([]);
}

/** Unordered lists: index both sides by `key`, same key set, then every field.
 *  `repeats`: the same key may come back (n-th copy keyed `key#n`), e.g. ledger
 *  lines with the same BL + product (G1); otherwise a repeated key fails. */
export function expectSameSet(
  actual: Row[],
  expected: Row[],
  key: (r: Row) => string,
  what: string,
  { repeats = false } = {},
): void {
  // One expect for the whole set: a per-row expect is recorded in the trace (×45k on exports).
  const index = (rows: Row[]) => {
    const out: Record<string, Row> = {};
    const dup: string[] = [];
    const seen: Record<string, number> = {};
    for (const r of rows) {
      let k = key(r);
      if (repeats) {
        seen[k] = (seen[k] ?? 0) + 1;
        if (seen[k] > 1) k = `${k}#${seen[k]}`;
      } else if (k in out) dup.push(k);
      out[k] = r;
    }
    expect(dup.slice(0, 20), `${what}: duplicate keys`).toEqual([]);
    return out;
  };
  const a = index(actual);
  const e = index(expected);
  const missing = Object.keys(e).filter((k) => !(k in a));
  const extra = Object.keys(a).filter((k) => !(k in e));
  expect({ missing: missing.slice(0, 20), extra: extra.slice(0, 20) }, `${what}: rows`).toEqual({
    missing: [],
    extra: [],
  });
  expectSame(a, e, what);
}

/** A best/worst KPI the app picks with max()/min() over rows in SQL order: the
 *  value is fixed, the label/qty may be any of the tied rows. */
export function expectTiedPick(
  actual: Row | null,
  value: number | undefined,
  ties: Row[] | undefined,
  what: string,
): void {
  if (value === undefined) {
    expect(actual, what).toBeNull();
    return;
  }
  expect(actual, `${what}: missing`).not.toBeNull();
  expect(Math.abs(Number(actual!.value) - value), `${what}: value ${actual!.value} ≠ ${value}`).toBeLessThanOrEqual(
    TOL,
  );
  // Match label AND qty: the tied row must be the one the app picked.
  const tie = (ties ?? []).find(
    (t) => t.label === actual!.label && Math.abs(Number(actual!.qty) - Number(t.qty)) <= TOL,
  );
  expect(tie, `${what}: « ${actual!.label} » qty ${actual!.qty} not among ${JSON.stringify(ties)}`).toBeDefined();
}
