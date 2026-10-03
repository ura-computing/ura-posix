/** The oracle's answers (resources/tests/expected.json, regenerated every run)
 *  + comparison helpers with the tolerance it declares. */
import { readFileSync } from "node:fs";

import { expect } from "./fixtures";
import { EXPECTED_FILE } from "./paths";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Expected = Record<string, any>;

let cache: Expected | null = null;

/** Lazy: the file is written by the backend webServer script, after test collection. */
export function expected(): Expected {
  cache ??= JSON.parse(readFileSync(EXPECTED_FILE, "utf-8")) as Expected;
  return cache;
}

/** The date window every value check uses (≈ last 12 months, see generate.py). */
export function testWindow(): { date_from: string; date_to: string } {
  return expected().window;
}

/** Money: |app − oracle| ≤ tolerance.dh (default 0.05 DH). */
export function closeDh(actual: number | null | undefined, want: number, what: string): void {
  expect(actual, `${what}: missing`).not.toBeNull();
  expect(Math.abs(Number(actual) - want), `${what}: app ${actual} ≠ expected ${want}`).toBeLessThanOrEqual(
    expected().meta.tolerance.dh,
  );
}

/** Percent: |app − oracle| ≤ tolerance.pct (default 0.01 pt). */
export function closePct(actual: number | null | undefined, want: number, what: string): void {
  expect(actual, `${what}: missing`).not.toBeNull();
  expect(Math.abs(Number(actual) - want), `${what}: app ${actual} ≠ expected ${want}`).toBeLessThanOrEqual(
    expected().meta.tolerance.pct,
  );
}
