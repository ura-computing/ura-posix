/** Runs last (file order). Gates 1-2 read every call recorded during the run
 *  (.results/calls.jsonl, written by lib/fixtures.ts + lib/api.ts):
 *
 *  1. COVERAGE — every backend route in /openapi.json must have been called at
 *     least once with a 2xx/3xx answer. Only /v1/store-website/* is allowlisted
 *     (feature hidden, see memory "store website skipped").
 *  2. SPEED — median duration per route (and total per FLOW, e.g. import/ventes, +35 %)
 *     ≤ max(baseline × 1.2 (FLOW: × 1.35), baseline + 50 ms). Baseline = e2e/perf-baseline.json
 *     (committed, recorded for one ROWS size — other sizes are not compared).
 *     First run, or `make e2e-tests` answered "y" to "Record a new speed
 *     baseline?", (re)writes it.
 *  3. ERROR CODES — backend `errors.py` ErrorCode values = frontend `api/errors.ts`
 *     (fr.ts / es.ts already fail the build when a frontend code has no text).
 *  4. REACT COMPILER — 0 `react-hooks` lint errors: the compiler skips (no auto
 *     memo) every component with one. Hidden store pages (moved as-is) excluded.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type CallRecord } from "../lib/fixtures";
import { API, CALLS_FILE, E2E_DIR, REPO_DIR, RESULTS_DIR } from "../lib/paths";

const ALLOWLIST = [/^\/v1\/store-website\//];
const BASELINE_FILE = resolve(E2E_DIR, "perf-baseline.json");
const METHODS = ["get", "post", "put", "patch", "delete"];

function readCalls(): CallRecord[] {
  if (!existsSync(CALLS_FILE)) return [];
  return readFileSync(CALLS_FILE, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

interface Route {
  key: string;
  method: string;
  re: RegExp;
}

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

/** Not a gate: .results/slowest.txt = time spent per route, biggest first, so a
 *  slow run can be explained without running it again. */
test("report: time per route", async ({ request }) => {
  const routes = await openApiRoutes(request);
  const acc: Record<string, number[]> = {};
  for (const c of readCalls()) {
    if (c.ms < 0) continue;
    const key = c.source === "flow" ? `FLOW ${c.path}` : (routeOf(c, routes)?.key ?? `${c.method} ${c.path}`);
    (acc[key] ??= []).push(c.ms);
  }
  const lines = Object.entries(acc)
    .map(([key, xs]) => ({
      key,
      n: xs.length,
      total: xs.reduce((a, b) => a + b, 0),
      med: median(xs),
      max: Math.max(...xs),
    }))
    .sort((a, b) => b.total - a.total)
    .map(
      (r) =>
        `${String(r.total).padStart(9)} ms  ${String(r.n).padStart(4)} calls  median ${String(r.med).padStart(6)}  max ${String(r.max).padStart(6)}  ${r.key}`,
    );
  writeFileSync(resolve(RESULTS_DIR, "slowest.txt"), `rows: ${process.env.E2E_ROWS ?? 100_000}\n${lines.join("\n")}\n`);
});

test("gate: every API route is called by the suite", async ({ request }) => {
  test.skip(process.env.E2E_PARTIAL === "1", "partial run (failed tests only): not every route is called");
  const routes = await openApiRoutes(request);
  const covered = new Set(
    readCalls()
      .filter((c) => c.source !== "flow" && c.status >= 200 && c.status < 400)
      .map((c) => routeOf(c, routes)?.key)
      .filter(Boolean),
  );
  const missing = routes
    .map((r) => r.key)
    .filter((k) => !covered.has(k))
    .sort();
  test
    .info()
    .annotations.push({ type: "coverage", description: `${routes.length - missing.length}/${routes.length} routes` });
  expect(missing, `routes never called (${missing.length}):\n  ${missing.join("\n  ")}\n`).toEqual([]);
});

test("gate: no route got slower than the baseline", async ({ request }) => {
  test.skip(process.env.E2E_PARTIAL === "1", "partial run (failed tests only): timings not comparable");
  const routes = await openApiRoutes(request);
  const samples: Record<string, number[]> = {};
  for (const c of readCalls()) {
    if (c.status < 200 || c.status >= 400 || c.ms < 0) continue;
    const key = c.source === "flow" ? `FLOW ${c.path}` : routeOf(c, routes)?.key;
    if (key) (samples[key] ??= []).push(c.ms);
  }
  const current = Object.fromEntries(
    Object.entries(samples)
      .sort()
      .map(([k, xs]) => [k, k.startsWith("FLOW") ? Math.max(...xs) : median(xs)]),
  );

  // Timings depend on the data size: a baseline only applies to the ROWS it was recorded with.
  const rows = Number(process.env.E2E_ROWS ?? 100_000);
  const saved = existsSync(BASELINE_FILE) ? JSON.parse(readFileSync(BASELINE_FILE, "utf-8")) : null;
  if (process.env.E2E_UPDATE_BASELINE === "1" || !saved?.routes) {
    writeFileSync(BASELINE_FILE, JSON.stringify({ rows, routes: current }, null, 2) + "\n");
    test.info().annotations.push({
      type: "speed",
      description: `baseline written for ${rows} rows: ${Object.keys(current).length} entries`,
    });
    return;
  }
  if (saved.rows !== rows) {
    test.info().annotations.push({
      type: "speed",
      description: `baseline is for ${saved.rows} rows, this run has ${rows}: not compared`,
    });
    return;
  }

  const baseline: Record<string, number> = saved.routes;
  const slower: string[] = [];
  const fresh: string[] = [];
  for (const [key, ms] of Object.entries(current)) {
    const base = baseline[key];
    if (base === undefined) {
      fresh.push(key);
      continue;
    }
    // A FLOW is ONE timing of a whole flow (browser + many calls): ±25 % between runs on a
    // shared machine, so +35 %. A route is a median of many calls: +20 %.
    const limit = key.startsWith("FLOW") ? Math.max(base * 1.35, base + 50) : Math.max(base * 1.2, base + 50);
    if (ms > limit) slower.push(`${key}: ${ms} ms (baseline ${base} ms, limit ${Math.round(limit)} ms)`);
  }
  if (fresh.length) {
    test.info().annotations.push({
      type: "speed",
      description: `not in baseline yet (make e2e-tests, answer y): ${fresh.join(", ")}`,
    });
  }
  expect(slower, `slower than baseline:\n  ${slower.join("\n  ")}\n`).toEqual([]);
});

test("gate: same error codes in backend and frontend", () => {
  const values = (file: string, re: RegExp) =>
    [...readFileSync(resolve(REPO_DIR, file), "utf-8").matchAll(re)].map((m) => m[1]).sort();
  const backend = values("backend/errors.py", /^ {4}[A-Z_]+\s*=\s*"(\w+)"$/gm);
  const frontend = values("frontend/src/api/errors.ts", /^ {2}[A-Z_]+:\s*"(\w+)",$/gm);
  expect(backend.length, "codes in backend/errors.py").toBeGreaterThan(0);
  expect(frontend, "frontend/src/api/errors.ts vs backend/errors.py").toEqual(backend);
});

test("gate: the React Compiler compiles every component (0 react-hooks lint errors)", () => {
  test.setTimeout(120_000);
  const run = spawnSync("npx", ["eslint", "src", "-f", "json"], {
    cwd: resolve(REPO_DIR, "frontend"),
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const files: { filePath: string; messages: { ruleId: string | null; line: number }[] }[] = JSON.parse(run.stdout);
  const found = files
    .flatMap((f) =>
      f.messages
        .filter((m) => m.ruleId?.startsWith("react-hooks/"))
        .map((m) => `${f.filePath.replace(/^.*\/frontend\//, "")}:${m.line} ${m.ruleId}`),
    )
    .filter((s) => !s.startsWith("src/pages/store/"));
  expect(found, "react-hooks lint errors (npx eslint src in frontend/)").toEqual([]);
});
