/** Stock, every control through the UI, every value vs the oracle (window period):
 *  - péremptions on open, ABCD classification (every product, every field);
 *  - the 8 class circles (count of each class);
 *  - the table: default class A, another class, same circle again closes it,
 *    status filter, column sort, next page, « Fermer »;
 *  - the 3 alert cards (references, units, purchase value, PPV potentiel);
 *  - each péremption card → its product list;
 *  - Excel export of the table (file name, French headers, every cell).
 *  The health gauge is a needle only (no number on screen): not checked. */
import type { Locator, Page } from "@playwright/test";

import { sessionFile } from "../lib/auth";
import { checkPeremptions, checkStockAbcd, type Row } from "../lib/checks";
import { expectSameSet } from "../lib/diff";
import { expected, testWindow } from "../lib/expected";
import { expect, test } from "../lib/fixtures";
import { columnTexts, downloadXlsx, frNumber, pageCall, period, setPeriod } from "../lib/ui";

test.use({ storageState: sessionFile("owner") });

const CLASSES = ["A", "A-", "B+", "B", "C", "C-", "C-N", "D"] as const;
const PAGE_SIZE = 25;
const STATUS_LABEL: Record<string, string> = {
  "sous-stock": "Sous-stock",
  ideal: "Idéal",
  "a-surveiller": "À surveiller",
  "sur-stock": "Sur-stock",
  inconnu: "Inconnu",
  negatif: "Stock négatif",
};

const oracle = () => expected().stock_abcd_window;
const productsWhere = (keep: (r: Row) => boolean): Row[] => (oracle().products as Row[]).filter(keep);

/** The table's API answer = the oracle's products of that filter; the banner
 *  count and the first page show it, in the API order. */
async function checkTable(page: Page, api: Row, want: Row[], what: string): Promise<void> {
  expectSameSet(api.products, want, (r) => r.product, `${what}: lignes`);
  const banner = page.getByText(/^·\s*[\d\s  ]+\s+produits$/);
  await expect
    .poll(
      async () => frNumber((await banner.innerText()).replace("produits", "").replace("·", "")),
      `${what}: nombre affiché`,
    )
    .toBe(want.length);
  if (want.length === 0) return;
  await expect(page.locator("table tbody tr").first()).toContainText(api.products[0].product);
  expect(await columnTexts(page, "Produit"), `${what}: page 1`).toEqual(
    (api.products as Row[]).slice(0, PAGE_SIZE).map((r) => r.product),
  );
}

/** One alert card: its 4 numbers = aggregate of the oracle rows (same formula as the page). */
async function checkAlertCard(page: Page, title: string, rows: Row[]): Promise<void> {
  const card: Locator = page
    .getByText(title, { exact: true })
    .locator("xpath=ancestor::div[contains(@class, 'rounded-2xl')][1]")
    .filter({ hasText: "Unités totales" });
  const stock = (r: Row) => Math.abs(r.current_stock ?? 0);
  const want: [string, number][] = [
    ["Références", rows.length],
    ["Unités totales", rows.reduce((s, r) => s + stock(r), 0)],
    [
      "Valeur achats",
      rows.reduce((s, r) => (r.avg_pu != null && r.current_stock != null ? s + r.avg_pu * stock(r) : s), 0),
    ],
    ["PPV potentiel", rows.reduce((s, r) => (r.ppv != null && r.current_stock != null ? s + r.ppv * stock(r) : s), 0)],
  ];
  for (const [label, value] of want) {
    const shown = frNumber(
      await card.getByText(label, { exact: true }).locator("xpath=following-sibling::span[1]").innerText(),
    );
    expect(Math.abs((shown ?? NaN) - value), `« ${title} » ${label}: ${shown} ≠ ${value}`).toBeLessThanOrEqual(0.011);
  }
}

test("stock: ABCD + péremptions", async ({ page }) => {
  const w = testWindow();
  const perem = pageCall(page, "/stats/peremptions");
  await page.goto("/stock");
  await expect(page.getByRole("heading", { level: 1, name: "Stock", exact: true })).toBeVisible();
  checkPeremptions(await perem);

  // The "full" fetch (no class filter) drives the ABCD circles + gauge + alert cards;
  // the table fetch starts on class A, sorted by « Ventes 12m » desc.
  const full = pageCall(page, "/stats/stock-abcd", {
    ...period(w),
    class_filter: null,
  });
  const tableA = pageCall(page, "/stats/stock-abcd", {
    ...period(w),
    class_filter: "A",
    sort_by: "units_sold_12m",
    sort_order: "desc",
  });
  await setPeriod(page, w.date_from, w.date_to);
  const fullApi = await full;
  checkStockAbcd(fullApi, "window");
  // Alert cards add up many products: compare with the page's own answer (same floats), checked = oracle above.
  const apiWhere = (keep: (r: Row) => boolean): Row[] => (fullApi.products as Row[]).filter(keep);

  await test.step("les 8 cercles de classe", async () => {
    const dist = oracle().distribution as Record<string, number>;
    for (const k of CLASSES) {
      await expect(
        page.getByRole("button", {
          name: `Classe ${k} : ${dist[k] ?? 0} références`,
          exact: true,
        }),
      ).toBeVisible();
    }
  });

  await test.step("tableau : classe A par défaut", async () => {
    await checkTable(
      page,
      await tableA,
      productsWhere((r) => r.category === "A"),
      "classe A",
    );
  });

  const dist = oracle().distribution as Record<string, number>;
  const other =
    CLASSES.find((k) => k !== "A" && (dist[k] ?? 0) > PAGE_SIZE) ??
    CLASSES.find((k) => k !== "A" && (dist[k] ?? 0) > 0)!;
  const circle = page.getByRole("button", {
    name: `Classe ${other} : ${dist[other]} références`,
    exact: true,
  });

  await test.step(`tableau : clic sur la classe ${other}, tri, page suivante`, async () => {
    const byClass = pageCall(page, "/stats/stock-abcd", {
      ...period(w),
      class_filter: other,
    });
    await circle.click();
    const api = await byClass;
    await checkTable(
      page,
      api,
      productsWhere((r) => r.category === other),
      `classe ${other}`,
    );

    // « Stock actuel » header: 1st click = ascending, API order sorted, page 1 = that order.
    const sorted = pageCall(page, "/stats/stock-abcd", {
      ...period(w),
      class_filter: other,
      sort_by: "current_stock",
      sort_order: "asc",
    });
    await page.getByRole("columnheader", { name: "Stock actuel", exact: true }).getByRole("button").click();
    const s = await sorted;
    const stocks = (s.products as Row[]).map((r) => r.current_stock).filter((v) => v != null);
    expect(stocks, "tri Stock actuel croissant").toEqual([...stocks].sort((a, b) => a - b));
    await checkTable(
      page,
      s,
      productsWhere((r) => r.category === other),
      `classe ${other} triée`,
    );

    if (s.products.length > PAGE_SIZE) {
      await page.getByRole("button", { name: "Page suivante" }).click();
      await expect(page.locator("table tbody tr").first()).toContainText(s.products[PAGE_SIZE].product);
      expect(await columnTexts(page, "Produit"), "page 2").toEqual(
        (s.products as Row[]).slice(PAGE_SIZE, 2 * PAGE_SIZE).map((r) => r.product),
      );
    }
  });

  let shownRows: Row[] = [];
  await test.step("filtre Statut (+ classe)", async () => {
    const status = Object.keys(STATUS_LABEL).find(
      (st) => productsWhere((r) => r.category === other && r.status === st).length > 0,
    )!;
    const byStatus = pageCall(page, "/stats/stock-abcd", {
      ...period(w),
      class_filter: other,
      status,
    });
    // The filter above the table, not the « Statut » column sort button inside it.
    await page
      .getByRole("button", { name: /^Statut/ })
      .and(page.locator(":not(table *)"))
      .click();
    await page
      .getByRole("button", {
        name: new RegExp(`^${STATUS_LABEL[status]}( \\(|$)`),
      })
      .click();
    const api = await byStatus;
    // Was on page 2: a new status must show page 1 of the new list.
    await checkTable(
      page,
      api,
      productsWhere((r) => r.category === other && r.status === status),
      `classe ${other} + ${status}`,
    );
    shownRows = api.products;
  });

  await test.step("Excel du tableau", async () => {
    // The file = the filtered table (all its rows, not just the page), statuses in French words.
    const x = await downloadXlsx(page, () => page.getByRole("button", { name: "Exporter Excel" }).click());
    expect(x.filename, "nom du fichier").toBe(`APCM - STOCK ${w.date_from} - ${w.date_to}.xlsx`);
    expect(x.rows[0], "en-têtes").toEqual([
      "Produit",
      "Classe",
      "Ventes 12m",
      "Stock actuel",
      "Stock min",
      "Stock max",
      "PPV",
      "PU moyen",
      "Statut",
    ]);
    expect(x.rows.slice(1), "cellules").toEqual(
      shownRows.map((r) => [
        r.product,
        r.category,
        r.units_sold_12m,
        r.current_stock ?? 0,
        r.stock_min,
        r.stock_max,
        r.ppv ?? 0,
        r.avg_pu ?? 0,
        STATUS_LABEL[r.status],
      ]),
    );
  });

  await test.step("« Fermer » puis même cercle deux fois", async () => {
    await page.getByRole("button", { name: "Fermer", exact: true }).click();
    await expect(page.locator("table")).toHaveCount(0);
    await circle.click();
    await expect(page.locator("table")).toHaveCount(1);
    await circle.click(); // same circle again → no filter → no table
    await expect(page.locator("table")).toHaveCount(0);
  });

  await test.step("les 3 cartes d'alerte", async () => {
    await checkAlertCard(
      page,
      "Stock négatif",
      apiWhere((r) => r.status === "negatif"),
    );
    await checkAlertCard(
      page,
      "Sous-stock top références",
      apiWhere((r) => (r.category === "A" || r.category === "A-") && r.status === "sous-stock"),
    );
    await checkAlertCard(
      page,
      "Sur-stock > 100 jours",
      apiWhere((r) => r.status === "sur-stock"),
    );
  });

  await test.step("cartes péremption → liste des produits", async () => {
    const cards = [
      ["expired", "Expirés en stock"],
      ["very_close", "Très proche (<30j)"],
      ["close", "Proche (<90j)"],
      ["no_date", "Sans date"],
    ] as const;
    for (const [key, title] of cards) {
      const want = (expected().peremptions[key].products as Row[]).map((r) => r.product).sort();
      if (want.length === 0) continue; // empty card is disabled
      await page.getByText(title, { exact: true }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      expect((await columnTexts(page, "Produit", dialog.locator("table"))).sort(), `${title}: produits`).toEqual(want);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
  });
});
