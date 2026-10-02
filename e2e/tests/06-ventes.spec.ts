/** Ventes: every call the page makes, every field.
 *  List (page 1 + 2), categories, TVA rates, surveillance counts + each tab,
 *  remise gauge, every sortable column (desc + asc), search + suggestions,
 *  category / TVA filters, and the Excel export (all rows of the period). */
import type { Page } from "@playwright/test";

import { sessionFile } from "../lib/auth";
import { checkLedgerPage, checkLedgerRows, checkSortPage, subsetSummary, type Row } from "../lib/checks";
import { expectSame } from "../lib/diff";
import { expected, testWindow } from "../lib/expected";
import { expect, recordCall, test } from "../lib/fixtures";
import { pageCall, period, setPeriod } from "../lib/ui";


test.use({ storageState: sessionFile("owner") });

const SORTABLE = [
  ["date", "Date"], ["transaction_ref", "N° Transaction"], ["client", "Client"], ["product", "Produit"],
  ["category", "Catégorie"], ["quantity", "Qté"], ["discount", "Remise"], ["ppv", "PPV"], ["total", "Total"],
  ["marge_pct", "Marge %"], ["marge_dh", "Marge DH"],
] as const;

const TABS = [
  ["all_flagged", /^Ventes à surveiller/], ["marge_negative", /^Marge négative/],
  ["marge_low", /^Marge < 10 %/], ["remises_high", /^Remise > 20 %/],
] as const;

async function open(page: Page): Promise<void> {
  await page.goto("/ventes");
  await expect(page.getByRole("heading", { level: 1, name: "Ventes", exact: true })).toBeVisible();
}

/** Open /ventes and type the period; resolves with the page-1 list for it. */
async function openWithPeriod(page: Page): Promise<Row> {
  await open(page);
  const list = pageCall(page, "/ventes", { ...period(testWindow()), page: "1" });
  await setPeriod(page, testWindow().date_from, testWindow().date_to);
  return list;
}


test("ventes: liste, pagination, catégories, TVA, surveillance, remises", async ({ page }) => {
  const e = expected();
  const w = testWindow();
  const cats = pageCall(page, "/ventes/categories");
  const tvas = pageCall(page, "/ventes/tva-rates");
  await open(page);
  expect(await cats, "catégories").toEqual(e.ventes_categories);
  expect(await tvas, "taux de TVA").toEqual(e.ventes_tva_rates);

  const list = pageCall(page, "/ventes", { ...period(w), page: "1" });
  const counts = pageCall(page, "/ventes/surveillance-counts", period(w));
  const discount = pageCall(page, "/ventes/discount-summary", period(w));
  await setPeriod(page, w.date_from, w.date_to);
  checkLedgerPage("ventes", await list, e.ventes_list, 1);
  expectSame(await counts, e.surveillance_counts, "surveillance counts");
  expectSame(await discount, e.discount_summary, "remises");

  const page2 = pageCall(page, "/ventes", { ...period(w), page: "2" });
  await page.getByRole("button", { name: "Page suivante" }).click();
  checkLedgerPage("ventes", await page2, e.ventes_list, 2);
});

test("ventes: onglets « à surveiller »", async ({ page }) => {
  await openWithPeriod(page);
  for (const [tab, name] of TABS) {
    await test.step(tab, async () => {
      const list = pageCall(page, "/ventes", { ...period(testWindow()), surveillance: tab });
      await page.getByRole("button", { name }).click();
      checkLedgerPage("ventes", await list, expected().surveillance_lists[tab], 1);
    });
  }
});

test("ventes: tri de chaque colonne (desc puis asc)", async ({ page }) => {
  await openWithPeriod(page);
  for (const [key, label] of SORTABLE) {
    for (const order of ["desc", "asc"] as const) {
      await test.step(`${label} ${order}`, async () => {
        const list = pageCall(page, "/ventes", { ...period(testWindow()), sort_by: key, sort_order: order });
        await page.getByRole("columnheader", { name: label, exact: true }).getByRole("button").click();
        checkSortPage("ventes", await list, key, order);
      });
    }
  }
});

test("ventes: recherche + suggestions", async ({ page }) => {
  await openWithPeriod(page);
  const box = page.getByPlaceholder("Produit, client, N° transaction…");
  for (const [q, summary] of Object.entries<Row>(expected().search.ventes)) {
    await test.step(q, async () => {
      const list = pageCall(page, "/ventes", { ...period(testWindow()), search: q });
      const suggest = pageCall(page, "/ventes/suggestions", { q });
      await box.fill(q);
      checkLedgerPage("ventes", await list, summary, 1);
      const s = await suggest;
      expect({ products: [...s.products].sort(), clients: [...s.clients].sort(), refs: [...s.refs].sort() }, `suggestions « ${q} »`)
        .toEqual(expected().suggestions.ventes[q]);
    });
  }
});

test("ventes: filtre catégorie « Médicament »", async ({ page }) => {
  await openWithPeriod(page);
  const list = pageCall(page, "/ventes", { ...period(testWindow()), category: "Médicament" });
  await page.getByRole("button", { name: "Catégorie" }).first().click();
  await page.getByRole("checkbox", { name: "Médicament", exact: true }).check();
  checkLedgerPage("ventes", await list, subsetSummary("ventes", (r) => r.category.toLowerCase().startsWith("médicament")), 1);
});

test("ventes: filtre TVA « TVA (20.00%) »", async ({ page }) => {
  await openWithPeriod(page);
  const list = pageCall(page, "/ventes", { ...period(testWindow()), tva: "TVA (20.00%)" });
  await page.getByRole("button", { name: "TVA", exact: true }).click();
  await page.getByRole("checkbox", { name: "TVA (20.00%)", exact: true }).check();
  checkLedgerPage("ventes", await list, subsetSummary("ventes", (r) => r.tva === "TVA (20.00%)"), 1);
});

test("ventes: export Excel — toutes les lignes de la période", async ({ page }) => {
  await openWithPeriod(page);
  const total = expected().ventes_list.rows_total;
  const exported = page.waitForResponse((r) => r.url().includes("/v1/ventes?") && r.url().includes("export=true"));
  const download = page.waitForEvent("download").catch(() => null);   // none when the export is refused (413)
  const t0 = Date.now();                                  // timed: click → .xlsx written (speed gate)
  await page.getByRole("button", { name: "Exporter Excel" }).click();
  const res = await exported;
  if (total > 50_000) {                                   // backend cap MAX_EXPORT_ROWS
    expect(res.status(), "export over 50 000 rows is refused").toBe(413);
    return;
  }
  expect(res.status()).toBe(200);
  await (await download)?.path();
  recordCall({ method: "FLOW", path: "ventes/export", status: 200, ms: Date.now() - t0, source: "flow", test: "ventes export" });
  checkLedgerRows("ventes", (await res.json()).data, expected().ventes_rows);
});
