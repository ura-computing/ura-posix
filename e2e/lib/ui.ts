/** Drive the real UI: type a period like a user, and read back the JSON the
 *  PAGE ITSELF loaded (so the check covers the frontend call + the backend). */
import type { Page } from "@playwright/test";

import { expect } from "./fixtures";
import { API } from "./paths";


/** Type `from` / `to` (YYYY-MM-DD) into the FilterBar date fields (JJ / MM / AAAA). */
export async function setPeriod(page: Page, from: string, to: string): Promise<void> {
  for (const [side, iso] of [["Date début", from], ["Date fin", to]] as const) {
    const [y, m, d] = iso.split("-");
    await page.getByLabel(`${side} jour`, { exact: true }).fill(d);
    await page.getByLabel(`${side} mois`, { exact: true }).fill(m);
    await page.getByLabel(`${side} année`, { exact: true }).fill(y);
  }
}


/** Query params the request must carry; `null` = the param must be absent. */
export type Match = Record<string, string | null>;

/** Resolve with the JSON of the page's next `GET /v1<path>` matching `params`.
 *  Call it BEFORE the click / goto / setPeriod that triggers the request. */
export function pageCall<T = any>(page: Page, path: string, params: Match = {}): Promise<T> {   // eslint-disable-line @typescript-eslint/no-explicit-any
  return page.waitForResponse((res) => {
    const u = new URL(res.url());
    if (u.origin !== API || u.pathname !== `/v1${path}` || res.request().method() !== "GET") return false;
    return Object.entries(params).every(([k, v]) => (v === null ? !u.searchParams.has(k) : u.searchParams.get(k) === v));
  }, { timeout: 60_000 }).then(async (res) => {
    expect(res.status(), `GET ${res.url()}`).toBe(200);
    return res.json() as Promise<T>;
  });
}


/** Same as pageCall for the page's next POST /v1<path>; returns the response JSON. */
export function pagePost<T = any>(page: Page, path: string): Promise<T> {   // eslint-disable-line @typescript-eslint/no-explicit-any
  return page.waitForResponse((res) => {
    const u = new URL(res.url());
    return u.origin === API && u.pathname === `/v1${path}` && res.request().method() === "POST";
  }, { timeout: 60_000 }).then(async (res) => {
    expect(res.status(), `POST ${res.url()}`).toBe(200);
    return res.json() as Promise<T>;
  });
}


export const period = (w: { date_from: string; date_to: string }): Match =>
  ({ date_from: w.date_from, date_to: w.date_to });


/** Click the Mixte / Pharmacie / Parapharmacie segment. */
export async function pickCategoryType(page: Page, label: string): Promise<void> {
  await page.getByRole("button", { name: label, exact: true }).click();
}
