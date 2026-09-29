/** Achats: every call the page makes, every field.
 *  List (page 1 + 2), categories, TVA rates, grossistes / direct labo gauge,
 *  every sortable column (desc + asc), search + suggestions, category / TVA
 *  filters, and the Excel export (all rows of the period). */
import type { Page } from "@playwright/test";

import { sessionFile } from "../lib/auth";
import { checkLedgerPage, checkLedgerRows, checkSortPage, subsetSummary, type Row } from "../lib/checks";
import { expectSame } from "../lib/diff";
import { expected, testWindow } from "../lib/expected";
import { expect, test } from "../lib/fixtures";
import { pageCall, period, setPeriod } from "../lib/ui";


test.use({ storageState: sessionFile("owner") });

const SORTABLE = [
  ["delivery_date", "Date BL"], ["delivery_ref", "Référence"], ["supplier", "Fournisseur"],
  ["product", "Produit"], ["category", "Catégorie"], ["quantity", "Qté"], ["pph", "PPH"],
  ["unit_price", "PU (achat)"], ["expiry_date", "Péremption"], ["total", "Total"],
] as const;

async function open(page: Page): Promise<void> {
  await page.goto("/achats");
  await expect(page.getByRole("heading", { level: 1, name: "Achats", exact: true })).toBeVisible();
}

async function openWithPeriod(page: Page): Promise<Row> {
  await open(page);
  const list = pageCall(page, "/achats", { ...period(testWindow()), page: "1" });
  await setPeriod(page, testWindow().date_from, testWindow().date_to);
  return list;
}


test("achats: liste, pagination, catégories, TVA, grossistes / direct labo", async ({ page }) => {
  const e = expected();
  const w = testWindow();
  const cats = pageCall(page, "/achats/categories");
  const tvas = pageCall(page, "/achats/tva-rates");
  await open(page);
  expect(await cats, "catégories").toEqual(e.achats_categories);
  expect(await tvas, "taux de TVA").toEqual(e.achats_tva_rates);

  const list = pageCall(page, "/achats", { ...period(w), page: "1" });
  const suppliers = pageCall(page, "/achats/supplier-summary", period(w));
  await setPeriod(page, w.date_from, w.date_to);
  checkLedgerPage("achats", await list, e.achats_list, 1);
  expectSame(await suppliers, e.supplier_summary, "grossistes / direct labo");

  const page2 = pageCall(page, "/achats", { ...period(w), page: "2" });
  await page.getByRole("button", { name: "Page suivante" }).click();
  checkLedgerPage("achats", await page2, e.achats_list, 2);
});

test("achats: tri de chaque colonne (desc puis asc)", async ({ page }) => {
  await openWithPeriod(page);
  for (const [key, label] of SORTABLE) {
    for (const order of ["desc", "asc"] as const) {
      await test.step(`${label} ${order}`, async () => {
        const list = pageCall(page, "/achats", { ...period(testWindow()), sort_by: key, sort_order: order });
        await page.getByRole("columnheader", { name: label, exact: true }).getByRole("button").click();
        checkSortPage("achats", await list, key, order);
      });
    }
  }
});

test("achats: recherche + suggestions", async ({ page }) => {
  await openWithPeriod(page);
  const box = page.getByPlaceholder("Produit, fournisseur, référence…");
  for (const [q, summary] of Object.entries<Row>(expected().search.achats)) {
    await test.step(q, async () => {
      const list = pageCall(page, "/achats", { ...period(testWindow()), search: q });
      const suggest = pageCall(page, "/achats/suggestions", { q });
      await box.fill(q);
      checkLedgerPage("achats", await list, summary, 1);
      const s = await suggest;
      expect({ products: [...s.products].sort(), suppliers: [...s.suppliers].sort(), refs: [...s.refs].sort() }, `suggestions « ${q} »`)
        .toEqual(expected().suggestions.achats[q]);
    });
  }
});

test("achats: filtre catégorie « Médicament »", async ({ page }) => {
  await openWithPeriod(page);
  const list = pageCall(page, "/achats", { ...period(testWindow()), category: "Médicament" });
  await page.getByRole("button", { name: "Catégorie" }).first().click();
  await page.getByRole("checkbox", { name: "Médicament", exact: true }).check();
  checkLedgerPage("achats", await list, subsetSummary("achats", (r) => r.category.toLowerCase().startsWith("médicament")), 1);
});

test("achats: filtre TVA « TVA (20.00%) »", async ({ page }) => {
  await openWithPeriod(page);
  const list = pageCall(page, "/achats", { ...period(testWindow()), tva: "TVA (20.00%)" });
  await page.getByRole("button", { name: "TVA", exact: true }).click();
  await page.getByRole("checkbox", { name: "TVA (20.00%)", exact: true }).check();
  checkLedgerPage("achats", await list, subsetSummary("achats", (r) => r.tva === "TVA (20.00%)"), 1);
});

test("achats: export Excel — toutes les lignes de la période", async ({ page }) => {
  await openWithPeriod(page);
  const total = expected().achats_list.rows_total;
  const exported = page.waitForResponse((r) => r.url().includes("/v1/achats?") && r.url().includes("export=true"));
  await page.getByRole("button", { name: "Exporter Excel" }).click();
  const res = await exported;
  if (total > 50_000) {                                   // backend cap MAX_EXPORT_ROWS
    expect(res.status(), "export over 50 000 rows is refused").toBe(413);
    return;
  }
  expect(res.status()).toBe(200);
  checkLedgerRows("achats", (await res.json()).data, expected().achats_rows);
});
