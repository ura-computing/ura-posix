/** Runs last (file order). Gates 1-2 read every call recorded during the run
 *  (.results/calls.jsonl, written by lib/fixtures.ts + lib/api.ts):
 *
 *  1. COVERAGE — every backend route in /openapi.json must have been called at
 *     least once with a 2xx/3xx answer.
 *  2. SPEED — median duration per route (and total per FLOW, e.g. import/ventes, +35 %)
 *     ≤ max(baseline × 1.2, baseline + 50 ms); FLOW ≤ max(baseline × 1.35, baseline + 150 ms). Baseline = e2e/perf-baseline.json
 *     (committed, recorded for one ROWS size — other sizes are not compared).
 *     First run, or `make tests` answered "y" to "Record a new speed
 *     baseline?", (re)writes it.
 *  3. ERROR CODES — backend `errors.py` ErrorCode values = frontend `api/errors.ts`
 *     (fr.ts / es.ts already fail the build when a frontend code has no text).
 *  4. REACT COMPILER — 0 `react-hooks` lint errors: the compiler skips (no auto
 *     memo) every component with one.
 *  5. DIGITALOCEAN LIMITS (E2E_DO=1, `make tests` asks) — from e2e/.logs/resources.log (written every 5 s by
 *     scripts/start-stack.sh): backend and worker (Sobrus robot) never killed (out of memory) or stopped, each
 *     under 512 MB, no robot inside the backend; Postgres never
 *     refused a connection, at most 22, database under 10 GB. Speed gate: its own e2e/perf-baseline.do.json.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type CallRecord } from "../lib/fixtures";
import { API, CALLS_FILE, E2E_DIR, REPO_DIR, RESULTS_DIR, UI_FILE } from "../lib/paths";

const ALLOWLIST: RegExp[] = [];
const DO_LIMITS = process.env.E2E_DO === "1";
// Under DigitalOcean's limits the timings differ: their own baseline.
const BASELINE_FILE = resolve(E2E_DIR, DO_LIMITS ? "perf-baseline.do.json" : "perf-baseline.json");
const RESOURCES_FILE = resolve(E2E_DIR, ".logs/resources.log");
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
  /** Its query params and request-body fields (/openapi.json). */
  query: string[];
  body: string[];
}

/** What a run may leave out, each with its reason (e2e/coverage-allowlist.json): patterns per gate. */
const COVERAGE_ALLOW: Record<"params" | "body" | "codes" | "ui", { pattern: string; why: string }[]> = JSON.parse(
  readFileSync(resolve(E2E_DIR, "coverage-allowlist.json"), "utf-8"),
);
const allowed = (gate: keyof typeof COVERAGE_ALLOW, key: string) =>
  COVERAGE_ALLOW[gate].some((a) => new RegExp(a.pattern).test(key));

async function openApiRoutes(request: import("@playwright/test").APIRequestContext): Promise<Route[]> {
  const spec = await (await request.get(`${API}/openapi.json`)).json();
  const ref = (s: { $ref?: string } | undefined) =>
    s?.$ref ? spec.components.schemas[s.$ref.split("/").at(-1) as string] : s;
  const routes: Route[] = [];
  for (const [path, ops] of Object.entries<Record<string, unknown>>(spec.paths)) {
    if (!path.startsWith("/v1/") || ALLOWLIST.some((re) => re.test(path))) continue;
    const re = new RegExp("^" + path.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\\?\{[^/]+?\\?\}/g, "[^/]+") + "$");
    for (const method of Object.keys(ops).filter((m) => METHODS.includes(m))) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const op = ops[method] as any;
      const query = (op.parameters ?? [])
        .filter((p: { in: string }) => p.in === "query")
        .map((p: { name: string }) => p.name);
      const content = op.requestBody?.content ?? {};
      const schema = ref((content["application/json"] ?? content["multipart/form-data"])?.schema);
      routes.push({
        key: `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        re,
        query,
        body: Object.keys(schema?.properties ?? {}),
      });
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
    // A FLOW is timed once per run: short ones (one stock chunk ≈ 170 ms) jitter ±50 ms → +150 ms floor.
    const limit = key.startsWith("FLOW") ? Math.max(base * 1.35, base + 150) : Math.max(base * 1.2, base + 50);
    if (ms > limit) slower.push(`${key}: ${ms} ms (baseline ${base} ms, limit ${Math.round(limit)} ms)`);
  }
  if (fresh.length) {
    test.info().annotations.push({
      type: "speed",
      description: `not in baseline yet (make tests, answer y): ${fresh.join(", ")}`,
    });
  }
  expect(slower, `slower than baseline:\n  ${slower.join("\n  ")}\n`).toEqual([]);
});

const UNIT_MB: Record<string, number> = { B: 1 / 2 ** 20, KiB: 1 / 1024, MiB: 1, GiB: 1024 };
/** « 40.11MiB » (docker stats) → 40.11. */
function megabytes(text: string): number {
  const m = /^([\d.]+)\s*(B|KiB|MiB|GiB)$/.exec(text.trim());
  return m ? Number(m[1]) * UNIT_MB[m[2]] : NaN;
}

interface ResourceSample {
  t: string;
  stats: { Name: string; MemUsage: string }[];
  /** The backend's processes: uvicorn (master + workers), the Sobrus robot. */
  procs?: { kb: number; cmd: string }[];
  backend: string;
  oom: boolean;
  worker: string;
  worker_oom: boolean;
  connections?: number;
  db_bytes?: number;
  db_error?: string;
}

test("gate: the app stays inside DigitalOcean's limits (512 MB backend + worker, 22 connections, 10 GB)", () => {
  test.skip(!DO_LIMITS, "run without DigitalOcean's limits");
  const samples: ResourceSample[] = existsSync(RESOURCES_FILE)
    ? readFileSync(RESOURCES_FILE, "utf-8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];
  expect(samples.length, "e2e/.logs/resources.log (scripts/start-stack.sh)").toBeGreaterThan(0);
  // docker stats « MemUsage »: « 40.11MiB / 512MiB »; containers apcm-e2e-backend-1, -worker-1, -db-1.
  const used = (s: ResourceSample, name: string) =>
    megabytes(s.stats.find((x) => x.Name.includes(name))?.MemUsage.split("/")[0] ?? "0B");
  const peak = (name: string) => Math.max(0, ...samples.map((s) => used(s, name)));
  const backendMb = peak("-backend-");
  const workerMb = peak("-worker-");
  const dbMb = peak("-db-");
  const connections = Math.max(0, ...samples.map((s) => s.connections ?? 0));
  const dbGb = Math.max(0, ...samples.map((s) => s.db_bytes ?? 0)) / 2 ** 30;
  // Who holds the memory at the backend's peak (uvicorn: master + workers).
  const top = samples.reduce((a, b) => (used(b, "-backend-") > used(a, "-backend-") ? b : a), samples[0]);
  const holders = [...(top.procs ?? [])]
    .sort((a, b) => b.kb - a.kb)
    .slice(0, 4)
    .map((p) => `${Math.round(p.kb / 1024)} MB ${p.cmd.slice(0, 60).trim()}`);
  for (const description of [
    `backend max ${Math.round(backendMb)} MB / 512 at ${top.t}: ${holders.join(" · ") || "?"}`,
    `worker (Sobrus robot) max ${Math.round(workerMb)} MB / 512`,
    `Postgres max ${Math.round(dbMb)} MB / 1024`,
    `connections max ${connections} / 22`,
    `database ${dbGb.toFixed(2)} GB / 10`,
  ]) {
    test.info().annotations.push({ type: "DigitalOcean", description });
  }
  // oom = one of its processes was killed for lack of memory (the backend container may still run: uvicorn
  // starts a new worker, but that worker's requests are gone).
  const killed = samples.find((s) => s.oom || s.backend !== "running");
  const why = killed?.oom ? "a backend process killed for lack of memory (512 MB)" : `backend ${killed?.backend}`;
  expect(killed && `${killed.t}: ${why}`).toBeFalsy();
  const robotKilled = samples.find((s) => s.worker_oom || s.worker !== "running");
  const robotWhy = robotKilled?.worker_oom
    ? "the Sobrus robot killed for lack of memory (512 MB)"
    : `worker ${robotKilled?.worker}`;
  expect(robotKilled && `${robotKilled.t}: ${robotWhy}`).toBeFalsy();
  // The robot runs only in its own container (DigitalOcean « Worker »), never inside the API.
  const inside = samples.find((s) => s.procs?.some((p) => p.cmd.includes("app.sobrus.worker")));
  expect(inside && `${inside.t}: Sobrus robot inside the backend container`).toBeFalsy();
  const refused = samples.filter((s) => s.db_error).map((s) => `${s.t}: ${s.db_error}`);
  expect(refused, "Postgres refused connections (22 max)").toEqual([]);
  expect(backendMb, "backend RAM (MB)").toBeLessThan(512);
  expect(workerMb, "worker RAM (MB)").toBeLessThan(512);
  expect(connections, "Postgres connections").toBeLessThanOrEqual(22);
  expect(dbGb, "database size (GB)").toBeLessThan(10);
});

test("gate: every query param and request field of every route is sent by the suite", async ({ request }) => {
  test.skip(process.env.E2E_PARTIAL === "1", "partial run (failed tests only): not every param is sent");
  const routes = await openApiRoutes(request);
  const sent = new Map<string, Set<string>>();
  for (const c of readCalls()) {
    const r = c.source === "flow" ? undefined : routeOf(c, routes);
    if (!r) continue;
    const s = sent.get(r.key) ?? new Set<string>();
    for (const q of c.query ?? []) s.add(`?${q}`);
    for (const b of c.body ?? []) s.add(`.${b}`);
    sent.set(r.key, s);
  }
  const missing: string[] = [];
  for (const r of routes) {
    const s = sent.get(r.key) ?? new Set<string>();
    for (const q of r.query)
      if (!s.has(`?${q}`) && !allowed("params", `${r.key} ?${q}`)) missing.push(`${r.key} ?${q}`);
    for (const b of r.body) if (!s.has(`.${b}`) && !allowed("body", `${r.key} .${b}`)) missing.push(`${r.key} .${b}`);
  }
  const total = routes.reduce((n, r) => n + r.query.length + r.body.length, 0);
  test.info().annotations.push({ type: "params", description: `${total - missing.length}/${total} params + fields` });
  writeFileSync(resolve(RESULTS_DIR, "params-missing.txt"), missing.join("\n") + "\n");
  expect(missing, `params / fields never sent (${missing.length}):\n  ${missing.join("\n  ")}\n`).toEqual([]);
});

test("gate: every error code the backend can send is triggered by the suite", () => {
  test.skip(process.env.E2E_PARTIAL === "1", "partial run (failed tests only): not every error is triggered");
  const codes = [
    ...readFileSync(resolve(REPO_DIR, "backend/app/core/errors.py"), "utf-8").matchAll(/^ {4}[A-Z_]+\s*=\s*"(\w+)"$/gm),
  ].map((m) => m[1]);
  const seen = new Set(
    readCalls()
      .flatMap((c) => [c.code, ...(c.codes ?? [])])
      .filter(Boolean),
  );
  const missing = codes.filter((c) => !seen.has(c) && !allowed("codes", c)).sort();
  test
    .info()
    .annotations.push({ type: "codes", description: `${codes.length - missing.length}/${codes.length} codes` });
  writeFileSync(resolve(RESULTS_DIR, "codes-missing.txt"), missing.join("\n") + "\n");
  expect(missing, `error codes never triggered (${missing.length}):\n  ${missing.join("\n  ")}\n`).toEqual([]);
});

test("gate: every button, link, tab, menu, checkbox and field shown is used by the suite", () => {
  test.skip(process.env.E2E_PARTIAL === "1", "partial run (failed tests only): not every page is opened");
  const records: { kind: string; key: string; test: string }[] = existsSync(UI_FILE)
    ? readFileSync(UI_FILE, "utf-8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];
  const seen = new Map<string, string>(); // key → first test that showed it
  const used = new Set<string>();
  for (const r of records) {
    if (r.kind === "seen" && !seen.has(r.key)) seen.set(r.key, r.test);
    if (r.kind === "used") used.add(r.key);
  }
  const missing = [...seen.keys()].filter((k) => !used.has(k) && !allowed("ui", k)).sort();
  test.info().annotations.push({
    type: "ui",
    description: `${seen.size - missing.length}/${seen.size} elements used (page | role | name)`,
  });
  writeFileSync(
    resolve(RESULTS_DIR, "ui-missing.txt"),
    missing.map((k) => `${k}    ← seen in « ${seen.get(k)} »`).join("\n") + "\n",
  );
  expect(missing, `shown but never used (${missing.length}):\n  ${missing.join("\n  ")}\n`).toEqual([]);
});

test("gate: same error codes in backend and frontend", () => {
  const values = (file: string, re: RegExp) =>
    [...readFileSync(resolve(REPO_DIR, file), "utf-8").matchAll(re)].map((m) => m[1]).sort();
  const backend = values("backend/app/core/errors.py", /^ {4}[A-Z_]+\s*=\s*"(\w+)"$/gm);
  const frontend = values("frontend/src/api/errors.ts", /^ {2}[A-Z_]+:\s*"(\w+)",$/gm);
  expect(backend.length, "codes in backend/app/core/errors.py").toBeGreaterThan(0);
  expect(frontend, "frontend/src/api/errors.ts vs backend/app/core/errors.py").toEqual(backend);
});

test("gate: the React Compiler compiles every component (0 react-hooks lint errors)", () => {
  test.setTimeout(120_000);
  const run = spawnSync("npx", ["eslint", "src", "-f", "json"], {
    cwd: resolve(REPO_DIR, "frontend"),
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });
  // No JSON = eslint itself failed (not installed, config error…): show its own message.
  expect(run.stdout.trim(), `npx eslint failed (exit ${run.status}): ${run.stderr || run.error?.message}`).not.toBe("");
  const files: { filePath: string; messages: { ruleId: string | null; line: number }[] }[] = JSON.parse(run.stdout);
  const found = files.flatMap((f) =>
    f.messages
      .filter((m) => m.ruleId?.startsWith("react-hooks/"))
      .map((m) => `${f.filePath.replace(/^.*\/frontend\//, "")}:${m.line} ${m.ruleId}`),
  );
  expect(found, "react-hooks lint errors (npx eslint src in frontend/)").toEqual([]);
});
