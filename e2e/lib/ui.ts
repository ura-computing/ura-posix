/** Drive the real UI: type a period like a user, and read back the JSON the
 *  PAGE ITSELF loaded (so the check covers the frontend call + the backend). */
import type { Locator, Page, Response } from "@playwright/test";
import * as XLSX from "xlsx";

import { expect } from "./fixtures";
import { API } from "./paths";

/** Type `from` / `to` (YYYY-MM-DD) into the FilterBar date fields (JJ / MM / AAAA). */
export async function setPeriod(page: Page, from: string, to: string): Promise<void> {
  for (const [side, iso] of [
    ["Date début", from],
    ["Date fin", to],
  ] as const) {
    const [y, m, d] = iso.split("-");
    await page.getByLabel(`${side} jour`, { exact: true }).fill(d);
    await page.getByLabel(`${side} mois`, { exact: true }).fill(m);
    await page.getByLabel(`${side} année`, { exact: true }).fill(y);
  }
}

const pad = (n: number) => String(n).padStart(2, "0");
/** « jj/mm/aaaa » of a Date (local day, like the page). */
export const shown = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

/** The 2 date fields of the page's filter bar, as « jj/mm/aaaa → jj/mm/aaaa » (« → » alone when empty). */
export async function dates(page: Page): Promise<string> {
  const side = async (s: "début" | "fin") => {
    const v: string[] = [];
    for (const part of ["jour", "mois", "année"])
      v.push(await page.getByLabel(`Date ${s} ${part}`, { exact: true }).inputValue());
    return v.every((x) => !x) ? "" : v.join("/");
  };
  return `${await side("début")} → ${await side("fin")}`.trim();
}

/** Each quick period of the calendar → its dates (« jj/mm/aaaa → jj/mm/aaaa »): a whole month, quarter or year. */
export function quickPeriods(today: Date): [string, string][] {
  const [y, m] = [today.getFullYear(), today.getMonth()];
  const q = Math.floor(m / 3) - 1; // the quarter before (-1 = last year's 4th)
  const [qy, qm] = q < 0 ? [y - 1, 9] : [y, q * 3];
  const range = (from: Date, to: Date) => `${shown(from)} → ${shown(to)}`;
  return [
    ["Année en cours", range(new Date(y, 0, 1), today)],
    ["Mois actuel", range(new Date(y, m, 1), today)],
    ["Mois antérieur", range(new Date(y, m - 1, 1), new Date(y, m, 0))],
    ["Trimestre antérieur", range(new Date(qy, qm, 1), new Date(qy, qm + 3, 0))],
    ["Année antérieure", range(new Date(y - 1, 0, 1), new Date(y - 1, 11, 31))],
  ];
}

/** Query params the request must carry; `null` = the param must be absent. */
export type Match = Record<string, string | null>;

/** Resolve with the JSON of the page's next `GET /v1<path>` matching `params`.
 *  Call it BEFORE the click / goto / setPeriod that triggers the request. */
export function pageCall<T = any>(page: Page, path: string, params: Match = {}): Promise<T> {
  // eslint-disable-line @typescript-eslint/no-explicit-any
  return page
    .waitForResponse(
      (res) => {
        const u = new URL(res.url());
        if (u.origin !== API || u.pathname !== `/v1${path}` || res.request().method() !== "GET") return false;
        return Object.entries(params).every(([k, v]) =>
          v === null ? !u.searchParams.has(k) : u.searchParams.get(k) === v,
        );
      },
      { timeout: 60_000 },
    )
    .then(async (res) => {
      expect(res.status(), `GET ${res.url()}`).toBe(200);
      return res.json() as Promise<T>;
    });
}

/** Same as pageCall for the page's next write (POST / PUT / PATCH / DELETE)
 *  to /v1<path>: checks the status, resolves with the response JSON (null
 *  for 204 No Content). */
export function pageSend<T = any>( // eslint-disable-line @typescript-eslint/no-explicit-any
  page: Page,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string | RegExp,
  status = 200,
): Promise<T> {
  return page
    .waitForResponse(
      (res) => {
        const u = new URL(res.url());
        const pathOk = typeof path === "string" ? u.pathname === `/v1${path}` : path.test(u.pathname);
        return u.origin === API && pathOk && res.request().method() === method;
      },
      { timeout: 60_000 },
    )
    .then(async (res) => {
      expect(res.status(), `${method} ${res.url()}`).toBe(status);
      return (status === 204 ? null : res.json()) as Promise<T>;
    });
}

export function pagePost<T = any>(page: Page, path: string, status = 200): Promise<T> {
  // eslint-disable-line @typescript-eslint/no-explicit-any
  return pageSend<T>(page, "POST", path, status);
}

export const period = (w: { date_from: string; date_to: string }): Match => ({
  date_from: w.date_from,
  date_to: w.date_to,
});

/** Click the Mixte / Pharmacie / Parapharmacie segment. */
export async function pickCategoryType(page: Page, label: string): Promise<void> {
  await page.getByRole("button", { name: label, exact: true }).click();
}

// ── Reading what the page SHOWS ─────────────────────────────────────────────

/** A number as the page prints it (« −1 234,56 MAD », « 12,30 % », « 1 200 ») → number;
 *  « — » or empty → null. */
export function frNumber(text: string | null): number | null {
  const t = (text ?? "")
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(/MAD|DH|%/g, "")
    .replace("\u2212", "-")
    .replace(",", ".");
  if (!t || t === "—") return null;
  const n = Number(t);
  if (Number.isNaN(n)) throw new Error(`not a number: « ${text} »`);
  return n;
}

/** The big value of a KPI tile, found by its label. */
export function kpiValue(page: Page, label: string): Locator {
  return page
    .getByText(label, { exact: true })
    .locator("xpath=ancestor::*[contains(@class, 'rounded-2xl')][1]") // div, or <a> / <button> when clickable
    .locator("span.font-mono.font-bold:not(.rounded-full)"); // not the count badge
}

/** Text of every cell of one DataTable column (by its header label) on the current page.
 *  `table`: the page's first table unless given (pages with several tables). */
export async function columnTexts(
  page: Page,
  header: string,
  table: Locator = page.locator("table").first(),
): Promise<string[]> {
  const headers = (await table.locator("thead th").allInnerTexts()).map((h) => h.trim().toLowerCase());
  const i = headers.indexOf(header.toLowerCase());
  if (i < 0) throw new Error(`no column « ${header} » (${headers.join(" | ")})`);
  return table.locator(`tbody tr td:nth-child(${i + 1})`).allInnerTexts();
}

/** « 1 234 résultats » under a DataTable → 1234. */
export async function resultsCount(page: Page): Promise<number> {
  const text = await page.getByText(/^[\d\s\u00a0\u202f]+ résultats$/).innerText();
  return Number(text.replace(/\D/g, ""));
}

/** Click « Exporter Excel » on a ledger page (`api` = "/v1/ventes" or "/v1/achats"): the
 *  export answer, the saved .xlsx path + name (null when refused, e.g. 413) and the time from
 *  the click to the file on disk (speed gate FLOW). */
export async function exportLedger(
  page: Page,
  api: string,
): Promise<{ res: Response; path: string | null; filename: string | null; ms: number }> {
  const exported = page.waitForResponse((r) => r.url().includes(`${api}?`) && r.url().includes("export=true"));
  const download = page.waitForEvent("download").catch(() => null); // none when the export is refused
  const t0 = Date.now();
  await page.getByRole("button", { name: "Exporter Excel" }).click();
  const res = await exported;
  if (res.status() !== 200) return { res, path: null, filename: null, ms: Date.now() - t0 };
  const file = await download;
  const path = (await file?.path()) ?? null;
  return { res, path, filename: file?.suggestedFilename() ?? null, ms: Date.now() - t0 };
}

/** Click something that downloads an .xlsx; returns its name + first sheet as rows. */
export async function downloadXlsx(
  page: Page,
  click: () => Promise<void>,
): Promise<{ filename: string; sheet: string; rows: unknown[][] }> {
  const download = page.waitForEvent("download");
  await click();
  const d = await download;
  const wb = XLSX.readFile(await d.path());
  const sheet = wb.SheetNames[0];
  return {
    filename: d.suggestedFilename(),
    sheet,
    rows: XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: null }),
  };
}
