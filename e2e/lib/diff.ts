/** Field-by-field comparison of an app payload with the oracle. Collects EVERY
 *  mismatch (not just the first) so one run shows all that is wrong. */
import { expect } from "./fixtures";


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

/** Numbers match within TOL: covers float-sum order + round(…, 2|3|4) edges. */
export const TOL = 0.02;


/** Compare `actual` with `expected`. Only keys present in `expected` are checked
 *  (the app may add ids); numbers within TOL, everything else strictly. */
export function diff(actual: unknown, expected: unknown, path = "", out: string[] = []): string[] {
  const show = (v: unknown) => JSON.stringify(v);
  if (typeof expected === "number") {
    if (typeof actual !== "number" || Math.abs(actual - expected) > TOL) out.push(`${path}: app ${show(actual)} ≠ expected ${expected}`);
  } else if (expected === null || typeof expected !== "object") {
    if (actual !== expected) out.push(`${path}: app ${show(actual)} ≠ expected ${show(expected)}`);
  } else if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) { out.push(`${path}: app ${show(actual)} is not a list`); return out; }
    if (actual.length !== expected.length) out.push(`${path}: app has ${actual.length} items, expected ${expected.length}`);
    expected.forEach((e, i) => { if (i < actual.length) diff(actual[i], e, `${path}[${i}]`, out); });
  } else {
    if (actual === null || typeof actual !== "object") { out.push(`${path}: app ${show(actual)} is not an object`); return out; }
    for (const [k, e] of Object.entries(expected as Row)) diff((actual as Row)[k], e, path ? `${path}.${k}` : k, out);
  }
  return out;
}


/** One assertion listing up to 40 differences. */
export function expectSame(actual: unknown, expected: unknown, what: string): void {
  const d = diff(actual, expected);
  expect(d.slice(0, 40), `${what}: ${d.length} difference(s)`).toEqual([]);
}


/** Unordered lists: index both sides by `key`, same key set, then every field. */
export function expectSameSet(actual: Row[], expected: Row[], key: (r: Row) => string, what: string): void {
  const index = (rows: Row[]) => {
    const out: Record<string, Row> = {};
    for (const r of rows) {
      const k = key(r);
      expect(out[k], `${what}: duplicate key ${k}`).toBeUndefined();
      out[k] = r;
    }
    return out;
  };
  const a = index(actual);
  const e = index(expected);
  const missing = Object.keys(e).filter((k) => !(k in a));
  const extra = Object.keys(a).filter((k) => !(k in e));
  expect({ missing: missing.slice(0, 20), extra: extra.slice(0, 20) }, `${what}: rows`).toEqual({ missing: [], extra: [] });
  expectSame(a, e, what);
}


/** A best/worst KPI the app picks with max()/min() over rows in SQL order: the
 *  value is fixed, the label/qty may be any of the tied rows. */
export function expectTiedPick(actual: Row | null, value: number | undefined, ties: Row[] | undefined, what: string): void {
  if (value === undefined) { expect(actual, what).toBeNull(); return; }
  expect(actual, `${what}: missing`).not.toBeNull();
  expect(Math.abs(Number(actual!.value) - value), `${what}: value ${actual!.value} ≠ ${value}`).toBeLessThanOrEqual(TOL);
  const tie = (ties ?? []).find((t) => t.label === actual!.label);
  expect(tie, `${what}: label "${actual!.label}" not among ${JSON.stringify(ties)}`).toBeDefined();
  expect(Math.abs(Number(actual!.qty) - Number(tie!.qty)), `${what}: qty`).toBeLessThanOrEqual(TOL);
}
