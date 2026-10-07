/** Produits (owner): every product of the pharmacy (stock file, sold or bought).
 *  List = oracle: page 1 + 2, the « Vendus 12 mois » dates (Stock page window), every
 *  sortable column (desc + asc), search, Pharmacie / Parapharmacie, Excel export.
 *  Photos (scraped fixture, resources/tests/catalog/product-infos.json): found by PID, by a
 *  barcode the admin gives in the catalogue (setup), a dead address → the box icon.
 *  Product sheet (from the list): every case the oracle picked (photos, never bought, not in
 *  the stock file, stock only, negative stock) = oracle, on screen too; photo gallery; « Codes »
 *  tab kept in the address; a product of no pharmacy line → 404 inside the layout.
 *  An employee sees the list + a sheet; feature OFF → no menu entry, 404 inside the layout. */
import type { Page } from "@playwright/test";

import { apiDelete, apiGet, apiPost, apiPut } from "../lib/api";
import { loadState, sessionFile } from "../lib/auth";
import type { Row } from "../lib/checks";
import { expectSame } from "../lib/diff";
import { expected } from "../lib/expected";
import { expect, test } from "../lib/fixtures";
import { columnTexts, downloadXlsx, frNumber, pageCall, pickCategoryType } from "../lib/ui";

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

// Setup: the admin catalogue gives one product the barcode of a scraped photo.
test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: sessionFile("admin") });
  const admin = await ctx.newPage();
  const { product, barcode1 } = expected().products.barcode_setup;
  const found = await apiGet(admin, "/admin/catalog", { search: product });
  const med = found.data.find((m: Row) => m.product === product);
  await apiPut(admin, `/admin/catalog/${med.id}`, { barcode1 });
  await ctx.close();
});

/** Sidebar → « Produits »: page 1, sorted by name. */
async function open(page: Page): Promise<Row> {
  await page.goto("/auth/me");
  const list = pageCall(page, "/products", { page: "1", sort_by: "product", sort_order: "asc" });
  await page.locator("aside").getByRole("link", { name: "Produits", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Produits", exact: true })).toBeVisible();
  return list;
}

/** List → type the PID → click the product: its id + the sheet the page loaded. */
async function openSheet(page: Page, pid: string): Promise<{ id: number; sheet: Row }> {
  await open(page);
  const found = pageCall(page, "/products", { search: pid });
  await page.getByPlaceholder("Nom, code-barres, PID, laboratoire…").fill(pid);
  const { id, product } = (await found).data.find((r: Row) => r.pid === pid);
  const sheet = pageCall(page, `/products/${id}`);
  await page.locator("tbody").getByText(product, { exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: product, exact: true })).toBeVisible();
  return { id, sheet: await sheet };
}

/** The value printed next to a label in a sheet block (« Prix de vente (PPV) » → « 307,48 MAD »). */
const field = (page: Page, label: string) =>
  page.locator(`xpath=//dt[normalize-space()="${label}"]/following-sibling::dd[1]`);

async function expectNumber(page: Page, label: string, want: number | null): Promise<void> {
  const got = frNumber(await field(page, label).innerText());
  if (want == null) expect(got, label).toBeNull();
  else expect(Math.abs((got ?? NaN) - want), `${label}: écran ${got} ≠ ${want}`).toBeLessThanOrEqual(0.011);
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

test("produits: photos (PID, code-barres, adresse morte → icône)", async ({ page }) => {
  await open(page);
  for (const r of rows().slice(0, 5)) {
    await test.step(r.product, async () => {
      const row = page.getByRole("row").filter({ hasText: r.product });
      const loads = r.photo && !r.photo.includes("introuvable");
      if (loads) await expect(row.getByRole("img", { name: r.product })).toHaveAttribute("src", r.photo);
      else await expect(row.getByRole("img", { name: "Pas de photo" })).toBeVisible();
    });
  }
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
      // No suggestion list on this page: nothing may say « Aucun résultat » over the found rows.
      await expect(page.getByText("Aucun résultat", { exact: true })).toHaveCount(0);
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

test("produits: un employé voit la liste", async ({ page, browser }) => {
  const employee = { email: "employe.produits@pharmagest.ma", password: "EmployeProduits#2026" };
  const { member } = await apiPost(page, "/owner/employees", {
    full_name: "Employé Produits",
    ...employee,
    role: "employee",
    pharmacy_id: loadState().pharmacyId,
  });
  const ctx = await browser.newContext();
  try {
    const other = await ctx.newPage();
    await other.goto("/login");
    await other.locator('input[type="email"]').fill(employee.email);
    await other.locator('input[autocomplete="current-password"]').fill(employee.password);
    await other.locator('button[type="submit"]').click();
    await expect(other).not.toHaveURL(/\/login/);
    const list = pageCall(other, "/products", { page: "1" });
    await other.locator("aside").getByRole("link", { name: "Produits", exact: true }).click();
    const got = await list;
    expect(got.pagination.total, "même liste que le propriétaire").toBe(rows().length);
    expectSame(got.data, rows().slice(0, LIMIT), "page 1 (employé)");
    const first = rows()[0];
    const sheet = pageCall(other, `/products/${got.data[0].id}`);
    await other.locator("tbody").getByText(first.product, { exact: true }).click();
    expectSame(await sheet, expected().products.sheets[first.pid], "fiche (employé)");
  } finally {
    await ctx.close();
    await apiDelete(page, `/owner/employees/${member.id}`, 204);
  }
});

test("produits: fonctionnalité coupée → absente du menu, 404 dans le cadre", async ({ page, browser }) => {
  const ctx = await browser.newContext({ storageState: sessionFile("admin") });
  const admin = await ctx.newPage();
  const features = `/admin/pharmacies/${loadState().pharmacyId}/features`;
  await apiPut(admin, features, { features: { produits: false } });
  try {
    await page.goto("/produits");
    await expect(page.getByText("Page introuvable", { exact: true })).toBeVisible();
    const sidebar = page.locator("aside");
    await expect(sidebar.getByRole("link", { name: "Stock", exact: true })).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "Produits", exact: true })).toHaveCount(0);
    await page.goto("/produits/1");
    await expect(page.getByText("Page introuvable", { exact: true })).toBeVisible();
  } finally {
    await apiPut(admin, features, { features: { produits: true } });
    await ctx.close();
  }
});

test("fiche produit: chaque cas = oracle, à l'écran aussi", async ({ page }) => {
  for (const [pid, e] of Object.entries<Row>(expected().products.sheets)) {
    await test.step(`${pid} ${e.product}`, async () => {
      const { sheet } = await openSheet(page, pid);
      expectSame(sheet, e, `fiche ${pid}`);

      await expect(page.getByText(`PID ${pid}`, { exact: true })).toBeVisible();
      await expectNumber(page, "Prix de vente (PPV)", e.prices.ppv);
      await expectNumber(page, "Prix pharmacien (PPH)", e.prices.pph);
      await expectNumber(page, "Prix d'achat moyen", e.prices.avg_pu);
      await expectNumber(page, "Marge %", e.prices.marge_pct);
      const stock = field(page, "Stock actuel");
      if (e.stock.current_stock == null) await expect(stock).toHaveText("Pas dans le dernier fichier de stock");
      else await expectNumber(page, "Stock actuel", e.stock.current_stock);
      await expectNumber(page, "Stock minimum", e.stock.stock_min);
      await expectNumber(page, "Stock maximum", e.stock.stock_max);
      await expect(field(page, "Couverture")).toHaveText(
        e.stock.coverage_days == null ? "—" : `${e.stock.coverage_days} jours`,
      );
      await expect(field(page, "Zone")).toHaveText(e.stock.zone ?? "—");
      await expect(
        page.getByText(e.info?.description ?? "Pas de description pour ce produit.", { exact: true }),
      ).toBeVisible();

      const moves: Row[] = e.recent_movements;
      if (moves.length === 0) await expect(page.getByText("Aucun achat ni vente pour ce produit.")).toBeVisible();
      else
        expect((await columnTexts(page, "Quantité")).map(frNumber), "mouvements récents").toEqual(
          moves.map((m) => m.quantity),
        );
    });
  }
});

test("fiche produit: photos (galerie, autre photo, adresse morte, aucune)", async ({ page }) => {
  const sheets = expected().products.sheets;
  const [withTwo, , dead] = Object.keys(sheets);
  const photos = page.locator("section").filter({ has: page.getByRole("heading", { name: "Photos", exact: true }) });

  await openSheet(page, withTwo);
  const { images } = sheets[withTwo].info;
  await expect(photos.locator("img").first()).toHaveAttribute("src", images[0]);
  await photos.getByRole("button", { name: "Photo 2", exact: true }).click();
  await expect(photos.locator("img").first()).toHaveAttribute("src", images[1]);

  await openSheet(page, dead);
  await expect(photos.getByRole("img", { name: "Pas de photo" })).toBeVisible();

  const without = Object.keys(sheets).find((pid) => sheets[pid].info === null) as string;
  await openSheet(page, without);
  await expect(photos.getByRole("img", { name: "Pas de photo" })).toBeVisible();
});

test("fiche produit: onglet « Codes » gardé dans l'adresse, retour à la liste", async ({ page }) => {
  const { product, barcode1 } = expected().products.barcode_setup;
  const pid = rows().find((r) => r.product === product)?.pid as string;
  await openSheet(page, pid);
  await page.getByRole("tab", { name: "Codes", exact: true }).click();
  await expect(page).toHaveURL(/\?tab=codes$/);
  expect(await columnTexts(page, "Code"), "codes").toEqual([pid, barcode1, "—"]);
  await page.reload();
  await expect(page.getByRole("tab", { name: "Codes", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Général", exact: true }).click();
  await expect(page).not.toHaveURL(/tab=/);
  await page.getByRole("link", { name: "Retour aux produits" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Produits", exact: true })).toBeVisible();
});

test("fiche produit: produit sans ligne dans la pharmacie → 404 dans le cadre", async ({ page, browser }) => {
  const ctx = await browser.newContext({ storageState: sessionFile("admin") });
  const admin = await ctx.newPage();
  const med = await apiPost(admin, "/admin/catalog", { product: "E2E PRODUIT HORS PHARMACIE" }, {}, 201);
  try {
    const answer = page.waitForResponse((r) => r.url().endsWith(`/v1/products/${med.id}`));
    await page.goto(`/produits/${med.id}`);
    const res = await answer;
    expect(res.status(), "GET /products/{id}").toBe(404);
    expect((await res.json()).code, "code d'erreur").toBe("productNotFound");
    await expect(page.getByText("Page introuvable", { exact: true })).toBeVisible();
    await expect(page.locator("aside").getByRole("link", { name: "Produits", exact: true })).toBeVisible();
  } finally {
    await apiDelete(admin, `/admin/catalog/${med.id}`, 204);
    await ctx.close();
  }
});
