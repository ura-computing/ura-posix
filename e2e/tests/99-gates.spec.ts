/** Runs last (file order). Two gates over every call recorded during the run
 *  (.results/calls.jsonl, written by lib/fixtures.ts + lib/api.ts):
 *
 *  1. COVERAGE — every backend route in /openapi.json must have been called at
 *     least once with a 2xx/3xx answer. Only /v1/store-website/* is allowlisted
 *     (feature hidden, see memory "store website skipped").
 *  2. SPEED — median duration per route (and total per FLOW, e.g. import/ventes)
 *     ≤ max(baseline × 1.2, baseline + 50 ms). Baseline = e2e/perf-baseline.json
 *     (committed, recorded for one ROWS size — other sizes are not compared).
 *     First run, or `make e2e UPDATE_BASELINE=1`, (re)writes it.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type CallRecord } from "../lib/fixtures";
import { API, CALLS_FILE, E2E_DIR } from "../lib/paths";


const ALLOWLIST = [/^\/v1\/store-website\//];
const BASELINE_FILE = resolve(E2E_DIR, "perf-baseline.json");
const METHODS = ["get", "post", "put", "patch", "delete"];


function readCalls(): CallRecord[] {
  if (!existsSync(CALLS_FILE)) return [];
  return readFileSync(CALLS_FILE, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

interface Route { key: string; method: string; re: RegExp }

async function openApiRoutes(request: import("@playwright/test").APIRequestContext): Promise<Route[]> {
  const spec = await (await request.get(`${API}/openapi.json`)).json();
  const routes: Route[] = [];
  for (const [path, ops] of Object.entries<Record<string, unknown>>(spec.paths)) {
    if (!path.startsWith("/v1/") || ALLOWLIST.some((re) => re.test(path))) continue;
    const re = new RegExp("^" + path.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\\?\{[^/]+?\\?\}/g, "[^/]+") + "$");
    for (const method of Object.keys(ops).filter((m) => METHODS.includes(m))) {
      routes.push({ key: `${method.toUpperCase()} ${path}`, method: method.toUpperCase(), re });
    }
  }
  return routes;
}

function routeOf(call: CallRecord, routes: Route[]): Route | undefined {
  return routes.find((r) => r.method === call.method && r.re.test(call.path));
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
};


test("gate: every API route is called by the suite", async ({ request }) => {
  const routes = await openApiRoutes(request);
  const covered = new Set(
    readCalls()
      .filter((c) => c.source !== "flow" && c.status >= 200 && c.status < 400)
      .map((c) => routeOf(c, routes)?.key)
      .filter(Boolean),
  );
  const missing = routes.map((r) => r.key).filter((k) => !covered.has(k)).sort();
  test.info().annotations.push({ type: "coverage", description: `${routes.length - missing.length}/${routes.length} routes` });
  expect(missing, `routes never called (${missing.length}):\n  ${missing.join("\n  ")}\n`).toEqual([]);
});


test("gate: no route got slower than the baseline", async ({ request }) => {
  const routes = await openApiRoutes(request);
  const samples: Record<string, number[]> = {};
  for (const c of readCalls()) {
    if (c.status < 200 || c.status >= 400 || c.ms < 0) continue;
    const key = c.source === "flow" ? `FLOW ${c.path}` : routeOf(c, routes)?.key;
    if (key) (samples[key] ??= []).push(c.ms);
  }
  const current = Object.fromEntries(
    Object.entries(samples).sort().map(([k, xs]) => [k, k.startsWith("FLOW") ? Math.max(...xs) : median(xs)]),
  );

  // Timings depend on the data size: a baseline only applies to the ROWS it was recorded with.
  const rows = Number(process.env.E2E_ROWS ?? 100_000);
  const saved = existsSync(BASELINE_FILE) ? JSON.parse(readFileSync(BASELINE_FILE, "utf-8")) : null;
  if (process.env.E2E_UPDATE_BASELINE === "1" || !saved?.routes) {
    writeFileSync(BASELINE_FILE, JSON.stringify({ rows, routes: current }, null, 2) + "\n");
    test.info().annotations.push({ type: "speed", description: `baseline written for ${rows} rows: ${Object.keys(current).length} entries` });
    return;
  }
  if (saved.rows !== rows) {
    test.info().annotations.push({ type: "speed", description: `baseline is for ${saved.rows} rows, this run has ${rows}: not compared` });
    return;
  }

  const baseline: Record<string, number> = saved.routes;
  const slower: string[] = [];
  const fresh: string[] = [];
  for (const [key, ms] of Object.entries(current)) {
    const base = baseline[key];
    if (base === undefined) { fresh.push(key); continue; }
    const limit = Math.max(base * 1.2, base + 50);
    if (ms > limit) slower.push(`${key}: ${ms} ms (baseline ${base} ms, limit ${Math.round(limit)} ms)`);
  }
  if (fresh.length) {
    test.info().annotations.push({ type: "speed", description: `not in baseline yet (run UPDATE_BASELINE=1): ${fresh.join(", ")}` });
  }
  expect(slower, `slower than baseline:\n  ${slower.join("\n  ")}\n`).toEqual([]);
});
