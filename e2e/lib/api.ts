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

async function call<T>(
  page: Page,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  params: Params,
  body?: unknown,
  status = 200,
): Promise<T> {
  const u = url(path, params);
  const t0 = performance.now();
  const res = await page.request.fetch(u.toString(), { method, data: body });
  const ms = Math.round(performance.now() - t0);
  recordCall({ method, path: u.pathname, status: res.status(), ms, source: "api", test: path });
  expect(res.status(), `${method} ${u.pathname}${u.search} → ${await res.text()}`).toBe(status);
  return (status === 204 ? null : res.json()) as Promise<T>;
}

export const apiGet = <T = any>(page: Page, path: string, params: Params = {}, status = 200) =>
  call<T>(page, "GET", path, params, undefined, status);
export const apiPost = <T = any>(page: Page, path: string, body: unknown, params: Params = {}, status = 200) =>
  call<T>(page, "POST", path, params, body, status);
export const apiPut = <T = any>(page: Page, path: string, body: unknown, status = 200) =>
  call<T>(page, "PUT", path, {}, body, status);
export const apiPatch = <T = any>(page: Page, path: string, body: unknown, status = 200) =>
  call<T>(page, "PATCH", path, {}, body, status);
/** Cleanup helper (the UI deletes are tested with pageSend); `status` = what the route answers. */
export const apiDelete = (page: Page, path: string, status = 200) =>
  call<unknown>(page, "DELETE", path, {}, undefined, status);
