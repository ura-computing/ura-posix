/** Direct API calls with the page's logged-in cookies — used to compare exact
 *  numbers with the oracle. Every call is recorded like the UI ones. */
import type { Page } from "@playwright/test";

import { expect, recordCall } from "./fixtures";
import { API } from "./paths";


type Params = Record<string, string | number | boolean | null | undefined>;


function url(path: string, params: Params = {}): URL {
  const u = new URL(`${API}/v1${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  }
  return u;
}


async function call<T>(page: Page, method: "GET" | "POST", path: string, params: Params, body?: unknown): Promise<T> {
  const u = url(path, params);
  const t0 = performance.now();
  const res = method === "GET"
    ? await page.request.get(u.toString())
    : await page.request.post(u.toString(), { data: body });
  const ms = Math.round(performance.now() - t0);
  recordCall({ method, path: u.pathname, status: res.status(), ms, source: "api", test: path });
  expect(res.status(), `${method} ${u.pathname}${u.search} → ${await res.text()}`).toBe(200);
  return res.json() as Promise<T>;
}


export const apiGet  = <T = any>(page: Page, path: string, params: Params = {}) => call<T>(page, "GET", path, params);
export const apiPost = <T = any>(page: Page, path: string, body: unknown, params: Params = {}) => call<T>(page, "POST", path, params, body);
