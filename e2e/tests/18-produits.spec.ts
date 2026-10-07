/** Produits (owner): every product of the pharmacy (stock file, sold or bought).
 *  List = oracle: page 1 + 2, the « Vendus 12 mois » dates (Stock page window), every
 *  sortable column (desc + asc), search, Pharmacie / Parapharmacie, Excel export. */
import type { Page } from "@playwright/test";

import { sessionFile } from "../lib/auth";
import type { Row } from "../lib/checks";
import { expectSame } from "../lib/diff";
import { expected } from "../lib/expected";
import { expect, test } from "../lib/fixtures";
import { columnTexts, downloadXlsx, pageCall, pickCategoryType } from "../lib/ui";

test.use({ storageState: sessionFile("owner") });

const LIMIT = 25;
const SORTABLE = [
  ["product", "Produit"],
  ["laboratoire", "Laboratoire"],
  ["category", "Catégorie"],
  ["current_stock", "Stock"],
  ["units_sold_12m", "Vendus 12 mois"],
  ["ppv", "PPV"],
  ["marge_pct", "Marge %"],
] as const;

const rows = (): Row[] => expected().products.rows;
const collator = new Intl.Collator("en");

/** Backend order: the column (empty values last), then the product name. */
function sorted(list: Row[], key: string, order: "asc" | "desc"): Row[] {
  const cmp = (a: Row, b: Row): number => {
    const x = a[key];
    const y = b[key];
    if (x == null || y == null) return x == null && y == null ? 0 : x == null ? 1 : -1;
    const c = typeof x === "number" ? x - y : collator.compare(String(x), String(y));
    return order === "asc" ? c : -c;
  };
  return [...list].sort((a, b) => cmp(a, b) || collator.compare(a.product, b.product));
}

/** Sidebar → « Produits »: page 1, sorted by name. */
async function open(page: Page): Promise<Row> {
  await page.goto("/auth/me");
  const list = pageCall(page, "/products", { page: "1", sort_by: "product", sort_order: "asc" });
  await page.locator("aside").getByRole("link", { name: "Produits", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Produits", exact: true })).toBeVisible();
  return list;
}

test("produits: liste = oracle (pages 1 et 2, période « Vendus 12 mois »)", async ({ page }) => {
  const e = expected().products;
  const first = await open(page);
  expectSame(
    first,
    { pagination: { page: 1, limit: LIMIT, total: e.rows.length }, sales_from: e.sales_from, sales_to: e.sales_to },
    "liste",
  );
  expectSame(first.data, e.rows.slice(0, LIMIT), "page 1");

  const shown = (await columnTexts(page, "Produit")).map((t) => t.split("\n")[0].trim());
  expect(shown, "noms à l'écran").toEqual(e.rows.slice(0, LIMIT).map((r: Row) => r.product));
  // « 01 juil. 2025 »: utils/format.tsx formatDate.
  const day = (iso: string) =>
    new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
  await expect(page.getByText(`du ${day(e.sales_from)} au ${day(e.sales_to)}`)).toBeVisible();

  const second = pageCall(page, "/products", { page: "2" });
  await page.getByRole("button", { name: "Page suivante" }).click();
  expectSame((await second).data, e.rows.slice(LIMIT, 2 * LIMIT), "page 2");
});

test("produits: tri de chaque colonne (desc puis asc)", async ({ page }) => {
  await open(page);
  for (const [key, label] of SORTABLE) {
    // A new column starts « desc »; « Produit » is already the sort column (asc → desc).
    for (const order of ["desc", "asc"] as const) {
      await test.step(`${label} ${order}`, async () => {
        const list = pageCall(page, "/products", { sort_by: key, sort_order: order });
        await page.getByRole("columnheader", { name: label, exact: true }).getByRole("button").click();
        const want = sorted(rows(), key, order).slice(0, LIMIT);
        expectSame(
          (await list).data.map((r: Row) => r[key] ?? null),
          want.map((r) => r[key] ?? null),
          `tri ${key} ${order}`,
        );
      });
    }
  }
});

test("produits: recherche + Pharmacie / Parapharmacie", async ({ page }) => {
  await open(page);
  const box = page.getByPlaceholder("Nom, code-barres, PID, laboratoire…");
  for (const [q, pids] of Object.entries<string[]>(expected().products.search)) {
    await test.step(q, async () => {
      const list = pageCall(page, "/products", { search: q });
      await box.fill(q);
      const got = await list;
      expect(got.pagination.total, `« ${q} »: nombre`).toBe(pids.length);
      expect(
        got.data.map((r: Row) => r.pid),
        `« ${q} »: produits`,
      ).toEqual(pids.slice(0, LIMIT));
    });
  }
  // The box sends 300 ms after the last key: wait for the cleared search before the next click.
  const cleared = pageCall(page, "/products", { search: null, category_type: "all" });
  await box.fill("");
  await cleared;

  for (const [ct, label] of [
    ["pharmacie", "Pharmacie"],
    ["parapharmacie", "Parapharmacie"],
  ] as const) {
    await test.step(label, async () => {
      const list = pageCall(page, "/products", { category_type: ct, search: null });
      await pickCategoryType(page, label);
      const want = rows().filter((r) => r.category_type === ct);
      const got = await list;
      expect(got.pagination.total, `${label}: nombre`).toBe(want.length);
      expectSame(got.data, want.slice(0, LIMIT), `${label}: page 1`);
    });
  }
});

test("produits: export Excel = toute la liste, en-têtes en français", async ({ page }) => {
  await open(page);
  const answer = pageCall(page, "/products", { export: "true" });
  const { filename, rows: sheet } = await downloadXlsx(page, () =>
    page.getByRole("button", { name: "Exporter Excel" }).click(),
  );
  await answer;
  expect(filename, "nom du fichier").toMatch(/^APCM - PRODUITS \d{4}-\d{2}-\d{2} - \d{4}-\d{2}-\d{2}\.xlsx$/);
  expect(sheet[0], "en-têtes").toEqual([
    "PID",
    "Produit",
    "Laboratoire",
    "Catégorie",
    "Type",
    "Stock actuel",
    "Vendus 12 mois",
    "PPV",
    "PU moyen",
    "Marge %",
  ]);
  // An empty value is written as an empty text cell.
  const want = rows().map((r) => [
    r.pid,
    r.product,
    r.laboratoire ?? "",
    r.category ?? "",
    r.category_type === "pharmacie" ? "Pharmacie" : "Parapharmacie",
    r.current_stock ?? "",
    r.units_sold_12m,
    r.ppv ?? "",
    r.avg_pu ?? "",
    r.marge_pct ?? "",
  ]);
  expectSame(sheet.slice(1), want, "lignes du fichier");
});
