/** Produits (owner): every product of the pharmacy (stock file, sold or bought).
 *  List = oracle: page 1 + 2, the « Vendus 12 mois » dates (Stock page window), every
 *  sortable column (desc + asc), search, Pharmacie / Parapharmacie, Excel export.
 *  Photos (scraped fixture, resources/tests/catalog/product-infos.json): found by PID, by a
 *  barcode the admin gives in the catalogue (setup), a dead address → the box icon.
 *  Product sheet (from the list): every case the oracle picked (photos, never bought, not in
 *  the stock file, stock only, negative stock) = oracle, on screen too; photo gallery; « Codes »
 *  tab kept in the address; a product of no pharmacy line → 404 inside the layout.
 *  « Ventes et achats par mois » (table, then chart + tooltip) and the Statistiques tab = oracle.
 *  « Mouvements » (from « Voir tout »): all lines, page 2, Achats, Ventes over the test window,
 *  search, Excel = oracle.
 *  « Modifier » (owner): edit + Enregistrer → « modifié », list and sheet show his values; a stock
 *  import keeps them; « Revenir à la valeur importée », « Annuler », min > max refused. Employee:
 *  « Modifier » disabled + reason, PUT refused.
 *  An employee sees the list + a sheet; feature OFF → no menu entry, 404 inside the layout. */
import type { Page } from "@playwright/test";

import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "../lib/api";
import { LOGGED_OUT, loadState, sessionFile } from "../lib/auth";
import type { Row } from "../lib/checks";
import { expectSame } from "../lib/diff";
import { expected, testWindow } from "../lib/expected";
import { expect, test } from "../lib/fixtures";
import {
  columnTexts,
  downloadXlsx,
  frNumber,
  kpiValue,
  pageCall,
  period,
  pickCategoryType,
  setPeriod,
} from "../lib/ui";

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

/** List → type the PID → click the product: its id + the sheet and statistics the page loaded. */
async function openSheet(page: Page, pid: string): Promise<{ id: number; sheet: Row; stats: Row }> {
  await open(page);
  const found = pageCall(page, "/products", { search: pid });
  await page.getByPlaceholder("Nom, code-barres, PID, laboratoire…").fill(pid);
  const { id, product } = (await found).data.find((r: Row) => r.pid === pid);
  const sheet = pageCall(page, `/products/${id}`);
  const stats = pageCall(page, `/products/${id}/stats`);
  await page.locator("tbody").getByText(product, { exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: product, exact: true })).toBeVisible();
  return { id, sheet: await sheet, stats: await stats };
}

const MONTHS_SHORT = [
  "Janv.",
  "Févr.",
  "Mars",
  "Avr.",
  "Mai",
  "Juin",
  "Juil.",
  "Août",
  "Sept.",
  "Oct.",
  "Nov.",
  "Déc.",
];
const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];
/** « 01 juil. 2025 »: utils/format.tsx formatDate. */
const frDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
const section = (page: Page, title: string) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name: title, exact: true }) });

/** The value printed next to a label in a sheet block (« Prix de vente (PPV) » → « 307,48 MAD »). */
const field = (page: Page, label: string) =>
  page.locator(`xpath=//dt[normalize-space()="${label}"]/following-sibling::dd[1]`);

async function expectNumber(page: Page, label: string, want: number | null): Promise<void> {
  // 1st line: an edited value also shows « modifié · Valeur importée … » under it.
  const got = frNumber((await field(page, label).innerText()).split("\n")[0]);
  if (want == null) expect(got, label).toBeNull();
  else expect(Math.abs((got ?? NaN) - want), `${label}: écran ${got} ≠ ${want}`).toBeLessThanOrEqual(0.011);
}

test("produits: liste = oracle (pages 1 et 2, 50 par page, période « Vendus 12 mois »)", async ({ page }) => {
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

  const fifty = pageCall(page, "/products", { page: "1", limit: "50" });
  await page.getByRole("button", { name: "25 / page" }).click();
  await page.getByRole("button", { name: "50 / page", exact: true }).click();
  expectSame((await fifty).data, e.rows.slice(0, 50), "50 par page (retour page 1)");
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

test("produits: recherche + Pharmacie / Parapharmacie + « Tout réinitialiser »", async ({ page }) => {
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

  await test.step("« Tout réinitialiser »", async () => {
    const searched = pageCall(page, "/products", { search: "90010" });
    await box.fill("90010");
    await searched;
    const back = pageCall(page, "/products", { category_type: "all", search: null, page: "1" });
    await page.getByRole("button", { name: "Tout réinitialiser" }).click();
    expectSame((await back).data, rows().slice(0, LIMIT), "liste du départ");
    await expect(box).toHaveValue("");
  });
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
  const ctx = await browser.newContext({ storageState: LOGGED_OUT }); // else: the owner's session
  try {
    const other = await ctx.newPage();
    await other.goto("/login");
    await other.locator('input[type="email"]').fill(employee.email);
    await other.locator('input[autocomplete="current-password"]').fill(employee.password);
    await other.locator('button[type="submit"]').click();
    await expect(other).not.toHaveURL(/\/login/);
    // Login lands on the home page (no sidebar): « Aller à mon espace » opens the app.
    await other.getByRole("link", { name: "Aller à mon espace" }).first().click();
    const list = pageCall(other, "/products", { page: "1" });
    await other.locator("aside").getByRole("link", { name: "Produits", exact: true }).click();
    const got = await list;
    expect(got.pagination.total, "même liste que le propriétaire").toBe(rows().length);
    expectSame(got.data, rows().slice(0, LIMIT), "page 1 (employé)");
    const first = rows()[0];
    const sheet = pageCall(other, `/products/${got.data[0].id}`);
    await other.locator("tbody").getByText(first.product, { exact: true }).click();
    expectSame(await sheet, expected().products.sheets[first.pid], "fiche (employé)");
    await expect(
      other.getByRole("button", { name: "Modifier", exact: true }),
      "employé : lecture seule",
    ).toBeDisabled();
    await expect(other.getByText("Seul le propriétaire peut modifier ce produit.")).toBeVisible();
    const refused = await apiPut(other, `/products/${got.data[0].id}`, { ppv: 1 }, 403);
    expect(refused.code, "PUT par un employé").toBe("ownerOnly");
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
  await expect(page.getByRole("heading", { name: "Codes du produit", exact: true })).toBeVisible();
  expect(await columnTexts(page, "Code"), "codes").toEqual([pid, barcode1, "—"]);
  await page.reload();
  await expect(page.getByRole("tab", { name: "Codes", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Général", exact: true }).click();
  await expect(page).not.toHaveURL(/tab=/);
  // Breadcrumb « Produits › name », then the browser's back button, then « Retour aux produits ».
  await page.locator("main").getByRole("link", { name: "Produits", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Produits", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: product, exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Retour aux produits" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Produits", exact: true })).toBeVisible();
});

test("fiche produit: en espagnol (onglets, blocs, boutons), choix gardé, retour en français", async ({ page }) => {
  await openSheet(page, Object.keys(expected().products.sheets)[0]);
  await page.getByRole("button", { name: "Espagnol", exact: true }).click();
  for (const name of ["General", "Estadísticas", "Movimientos", "Códigos"]) {
    await expect(page.getByRole("tab", { name, exact: true }), `onglet ${name}`).toBeVisible();
  }
  for (const title of ["Datos generales", "Precios", "Movimientos recientes", "Ventas y compras por mes"]) {
    await expect(page.getByRole("heading", { name: title, exact: true }), title).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Editar", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Volver a los productos" })).toBeVisible();
  await page.reload(); // the language is remembered
  await expect(page.getByRole("tab", { name: "Estadísticas", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Estadísticas", exact: true }).click();
  await expect(page.getByText("Ventas 12 meses", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Francés", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Statistiques", exact: true })).toBeVisible();
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

test("fiche produit: ventes et achats par mois, tableau puis graphique = oracle", async ({ page }) => {
  const all = expected().products.stats;
  for (const pid of Object.keys(all)) {
    await test.step(pid, async () => {
      const e = all[pid];
      const { stats } = await openSheet(page, pid);
      expectSame(stats, e, `statistiques ${pid}`);
      const card = section(page, "Ventes et achats par mois");
      if (e.monthly.length === 0) {
        await expect(card.getByText("Aucune vente ni achat pour ce produit.")).toBeVisible();
        return;
      }
      // Table: per year a « Ventes » row then an « Achats » row.
      const series = (e.monthly as Row[]).flatMap((y) => [
        { label: `Ventes ${y.year}`, months: y.sold, total: y.sold_total },
        { label: `Achats ${y.year}`, months: y.bought, total: y.bought_total },
      ]);
      const table = card.locator("table");
      await expect(table.locator("tbody tr"), "lignes dessinées").toHaveCount(series.length);
      expect(await columnTexts(page, "Série", table), "lignes").toEqual(series.map((r) => r.label));
      for (const [m, label] of MONTHS_SHORT.entries()) {
        const shown = (await columnTexts(page, label, table)).map((x) => frNumber(x) ?? 0);
        expect(shown, label).toEqual(series.map((r) => r.months[m]));
      }
      const totals = (await columnTexts(page, "Total", table)).map((x) => frNumber(x) ?? 0);
      expect(totals, "totaux").toEqual(series.map((r) => r.total));

      // Chart: one curve per series, each its own color (purchases dashed); the month under the
      // mouse shows every series' value.
      await card.getByRole("button", { name: "Graphique", exact: true }).click();
      await expect(table).toHaveCount(0);
      const chart = card.locator("svg.touch-none");
      const curves = chart.locator("path");
      await expect(curves).toHaveCount(series.length);
      await expect(chart.locator('path[stroke-dasharray="5 4"]'), "achats en pointillés").toHaveCount(e.monthly.length);
      const colors = await curves.evaluateAll((els) => els.map((el) => el.getAttribute("stroke")));
      expect(new Set(colors).size, "une couleur par courbe").toBe(series.length);
      const m = 6; // July: the mouse right above its x-axis label
      const label = await chart.locator("text", { hasText: MONTHS_SHORT[m] }).boundingBox();
      const box = await chart.boundingBox();
      if (!label || !box) throw new Error("pas de graphique");
      await page.mouse.move(label.x + label.width / 2, box.y + box.height / 2);
      const tip = card.locator("div.pointer-events-none").filter({ hasText: MONTHS[m] });
      await expect(tip).toBeVisible();
      for (const r of series) {
        const line = tip.locator("div.justify-between").filter({ hasText: r.label });
        expect(frNumber(await line.locator("span.font-mono").innerText()), `${MONTHS[m]} ${r.label}`).toBe(r.months[m]);
      }
      await card.getByRole("button", { name: "Tableau", exact: true }).click();
      await expect(table).toBeVisible();
    });
  }
});

test("fiche produit: onglet « Statistiques » = oracle", async ({ page }) => {
  const all = expected().products.stats;
  const sheets = expected().products.sheets;
  for (const pid of Object.keys(all)) {
    await test.step(pid, async () => {
      const e = all[pid];
      const s = sheets[pid];
      await openSheet(page, pid);
      await page.getByRole("tab", { name: "Statistiques", exact: true }).click();
      await expect(page).toHaveURL(/\?tab=stats$/);
      const tile = async (label: string, want: number | null) => {
        const got = frNumber(await kpiValue(page, label).innerText());
        if (want == null) expect(got, label).toBeNull();
        else expect(Math.abs((got ?? NaN) - want), `${label}: écran ${got} ≠ ${want}`).toBeLessThanOrEqual(0.011);
      };
      await tile("Ventes 30 jours", e.units_30d);
      await tile("Ventes 12 mois", e.units_12m);
      await tile("Chiffre d'affaires 12 mois", e.ca_12m);
      await tile("Marge moyenne", s.prices.marge_pct);
      await tile("Stock actuel", s.stock.current_stock);
      await expect(kpiValue(page, "Couverture")).toHaveText(
        s.stock.coverage_days == null ? "—" : `${s.stock.coverage_days} jours`,
      );

      await expectNumber(page, "Vente moyenne par mois", e.avg_per_month);
      await expectNumber(page, "Vente moyenne par jour", e.avg_per_day);
      await expect(field(page, "Première vente")).toHaveText(e.first_sale ? frDate(e.first_sale) : "—");
      await expect(field(page, "Dernière vente")).toHaveText(e.last_sale ? frDate(e.last_sale) : "—");
      const best = e.best_month;
      await expect(field(page, "Meilleur mois")).toHaveText(
        best
          ? new RegExp(`^${MONTHS[Number(best.month.slice(5, 7)) - 1]} ${best.month.slice(0, 4)} · .+ vendus$`)
          : /^—$/,
      );
      await expect(field(page, "Mois sans vente")).toHaveText(`${e.months_without_sale} sur 12`);

      const years = section(page, "Ventes et achats par année").locator("table");
      if (e.yearly.length === 0) return;
      expect((await columnTexts(page, "Année", years)).map(Number), "années").toEqual(e.yearly.map((y: Row) => y.year));
      for (const [label, key] of [
        ["Unités vendues", "units_sold"],
        ["Chiffre d'affaires", "ca"],
        ["Unités achetées", "units_bought"],
        ["Montant des achats", "amount_bought"],
      ] as const) {
        const shown = (await columnTexts(page, label, years)).map(frNumber);
        shown.forEach((v, i) =>
          expect(Math.abs((v ?? NaN) - e.yearly[i][key]), `${label} ${e.yearly[i].year}`).toBeLessThanOrEqual(0.011),
        );
      }
    });
  }
});

test("fiche produit: onglet « Mouvements » = oracle (filtres, pages, recherche, export)", async ({ page }) => {
  const e = expected().products.movements;
  const w = testWindow();
  const { id } = await openSheet(page, e.pid);
  const path = `/products/${id}/movements`;
  const check = (got: Row, want: Row, what: string) => {
    expect(got.pagination.total, `${what}: nombre de lignes`).toBe(want.total);
    expectSame(
      { units_bought: got.units_bought, units_sold: got.units_sold },
      { units_bought: want.units_bought, units_sold: want.units_sold },
      `${what}: sommes`,
    );
    expectSame(got.data, want.page, `${what}: lignes`);
  };

  // « Voir tout » under « Mouvements récents » opens the tab.
  let call = pageCall(page, path, { page: "1", kind: "all" });
  await section(page, "Mouvements récents").getByRole("button", { name: "Voir tout" }).click();
  await expect(page).toHaveURL(/\?tab=movements$/);
  check(await call, e.all, "tout");
  await expect(page.locator("tbody tr"), "lignes dessinées").toHaveCount(e.all.page.length);
  expect((await columnTexts(page, "Quantité")).map(frNumber), "quantités à l'écran").toEqual(
    e.all.page.map((m: Row) => m.quantity),
  );
  expect(await columnTexts(page, "Fichier importé"), "fichiers à l'écran").toEqual(
    e.all.page.map((m: Row) => m.filename),
  );

  call = pageCall(page, path, { page: "2" });
  await page.getByRole("button", { name: "Page suivante" }).click();
  check(await call, e.all_page2, "page 2");

  call = pageCall(page, path, { kind: "achat" });
  await pickCategoryType(page, "Achats");
  check(await call, e.achats, "achats");

  await pickCategoryType(page, "Ventes");
  call = pageCall(page, path, { kind: "vente", ...period(w) });
  await setPeriod(page, w.date_from, w.date_to);
  check(await call, e.ventes_window, "ventes sur la période");

  call = pageCall(page, path, { kind: "all", date_from: null, date_to: null });
  await page.getByRole("button", { name: "Tout réinitialiser" }).click();
  check(await call, e.all, "tout réinitialisé");
  call = pageCall(page, path, { search: e.client });
  await page.getByPlaceholder("Document, fournisseur, client…").fill(e.client);
  check(await call, e.search, `recherche « ${e.client} »`);

  // Excel: every line of the search, French headers.
  const answer = pageCall(page, path, { export: "true" });
  const { filename, rows: sheet } = await downloadXlsx(page, () =>
    page.getByRole("button", { name: "Exporter Excel" }).click(),
  );
  const all = await answer;
  expect(filename, "nom du fichier").toMatch(new RegExp(`^APCM - MOUVEMENTS ${e.pid} \\d{4}-\\d{2}-\\d{2} - `));
  expect(sheet[0], "en-têtes").toEqual([
    "Date",
    "Type",
    "Quantité",
    "Prix unitaire",
    "Total",
    "Document",
    "Fournisseur / client",
    "Fichier importé",
  ]);
  expect(sheet.length - 1, "lignes du fichier").toBe(e.search.total);
  expect(all.data.length, "réponse de l'export").toBe(e.search.total);
  const first = e.search.page[0];
  expectSame(
    sheet[1],
    [
      first.date,
      first.kind === "achat" ? "Achat" : "Vente",
      first.quantity,
      first.unit_price,
      first.total,
      first.document,
      first.party ?? "",
      first.filename,
    ],
    "1re ligne du fichier",
  );
});

// ── « Modifier » (owner) ────────────────────────────────────────────────────

/** 2nd product the oracle opens (sold, bought, in the stock file, with a description). */
const editPid = (): string => Object.keys(expected().products.sheets)[1];
const frDecimal = (n: number) => n.toFixed(2).replace(".", ",");
const round2 = (n: number) => Number(n.toFixed(2));

/** The pharmacy's stock import of one line (setup): stock / zone / expiry of that product. */
async function importStockLine(page: Page, e: Row, stock: number): Promise<void> {
  const row = {
    PID: e.pid,
    Produit: e.product,
    Stock: String(stock),
    Zone: e.stock.zone ?? "",
    "Date de péremption": e.stock.expiry_date ?? "",
    "Stock min": "",
    "Stock max": "",
  };
  const sent = await apiPost(page, "/uploads/stock-json", { rows: [row], filename: "Sobrus - Stock 20260101.csv" });
  await apiPatch(page, `/uploads/batches/${sent.batch_id}`, { status: "success" });
}

/** Every editable value: [input label (tab), value typed, value sent, imported value]. */
function editPlan(
  e: Row,
): { label: string; tab: "Général" | "Codes"; typed: string; field: string; sent: unknown; imported: unknown }[] {
  const ppv = round2(e.prices.ppv + 10);
  const pph = round2(e.prices.pph + 1);
  return [
    {
      label: "Nom du produit",
      tab: "Général",
      typed: `${e.product} (pharmacie)`,
      field: "product",
      sent: `${e.product} (pharmacie)`,
      imported: e.product,
    },
    {
      label: "Catégorie",
      tab: "Général",
      typed: "Catégorie E2E",
      field: "category",
      sent: "Catégorie E2E",
      imported: e.category,
    },
    {
      label: "Laboratoire",
      tab: "Général",
      typed: "Laboratoire E2E modifié",
      field: "laboratoire",
      sent: "Laboratoire E2E modifié",
      imported: e.laboratoire,
    },
    { label: "TVA", tab: "Général", typed: "TVA (10.00%)", field: "tva", sent: "TVA (10.00%)", imported: e.tva },
    {
      label: "Prix de vente (PPV)",
      tab: "Général",
      typed: frDecimal(ppv),
      field: "ppv",
      sent: ppv,
      imported: e.prices.ppv,
    },
    {
      label: "Prix pharmacien (PPH)",
      tab: "Général",
      typed: frDecimal(pph),
      field: "pph",
      sent: pph,
      imported: e.prices.pph,
    },
    {
      label: "Stock actuel",
      tab: "Général",
      typed: "12",
      field: "current_stock",
      sent: 12,
      imported: e.stock.current_stock,
    },
    { label: "Stock minimum", tab: "Général", typed: "3", field: "stock_min", sent: 3, imported: e.stock.stock_min },
    { label: "Stock maximum", tab: "Général", typed: "9", field: "stock_max", sent: 9, imported: e.stock.stock_max },
    {
      label: "Péremption",
      tab: "Général",
      typed: "31/12/2027",
      field: "expiry_date",
      sent: "2027-12-31",
      imported: e.stock.expiry_date,
    },
    { label: "Zone", tab: "Général", typed: "ZONE E2E", field: "zone", sent: "ZONE E2E", imported: e.stock.zone },
    {
      label: "Description",
      tab: "Général",
      typed: "Description du pharmacien.",
      field: "description",
      sent: "Description du pharmacien.",
      imported: e.info?.description ?? null,
    },
    {
      label: "Code-barres 1",
      tab: "Codes",
      typed: "3760000000082",
      field: "barcode1",
      sent: "3760000000082",
      imported: e.barcode1,
    },
    {
      label: "Code-barres 2",
      tab: "Codes",
      typed: "3760000000099",
      field: "barcode2",
      sent: "3760000000099",
      imported: e.barcode2,
    },
  ];
}

// The 3 tests follow each other: edit every value, an import, then everything back.
test.describe("modifier", () => {
  test.describe.configure({ mode: "serial" });

  test("modifier : chaque valeur changée par le propriétaire, « modifié » sur la fiche, la liste suit", async ({
    page,
  }) => {
    const pid = editPid();
    const e = expected().products.sheets[pid];
    const plan = editPlan(e);
    const { id } = await openSheet(page, pid);

    await page.getByRole("button", { name: "Modifier", exact: true }).click();
    await expect(page.getByText("Ces valeurs comptent seulement pour votre pharmacie")).toBeVisible();
    // The type (Pharmacie / Parapharmacie) stays the catalogue's: no switch for it.
    await expect(page.getByRole("button", { name: "Parapharmacie", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Pharmacie", exact: true })).toHaveCount(0);
    for (const tab of ["Général", "Codes"] as const) {
      await page.getByRole("tab", { name: tab, exact: true }).click(); // still editing on each tab
      for (const f of plan.filter((x) => x.tab === tab)) await page.getByLabel(f.label, { exact: true }).fill(f.typed);
    }
    const put = page.waitForResponse((r) => r.url().endsWith(`/v1/products/${id}`) && r.request().method() === "PUT");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    const res = await put;
    expect(res.status(), "PUT /products/{id}").toBe(200);
    expect(res.request().postDataJSON(), "seuls les champs changés").toEqual(
      Object.fromEntries(plan.map((f) => [f.field, f.sent])),
    );
    const ppv = plan.find((f) => f.field === "ppv")?.sent as number;
    expectSame(
      await res.json(),
      {
        product: `${e.product} (pharmacie)`,
        category: "Catégorie E2E",
        category_type: e.category_type, // unchanged
        laboratoire: "Laboratoire E2E modifié",
        tva: "TVA (10.00%)",
        barcode1: "3760000000082",
        barcode2: "3760000000099",
        info: { description: "Description du pharmacien." },
        prices: {
          ppv,
          pph: plan.find((f) => f.field === "pph")?.sent,
          marge_pct: e.prices.avg_pu == null ? null : (1 - e.prices.avg_pu / ppv) * 100, // follows the PPV shown
        },
        stock: { current_stock: 12, stock_min: 3, stock_max: 9, expiry_date: "2027-12-31", zone: "ZONE E2E" },
        imported: Object.fromEntries(plan.map((f) => [f.field, f.imported])),
      },
      "fiche après Enregistrer",
    );
    await expect(page.getByText("Fiche enregistrée")).toBeVisible();
    await expect(page.getByRole("button", { name: "Modifier", exact: true }), "fin de la modification").toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: `${e.product} (pharmacie)`, exact: true })).toBeVisible();
    await expect(page.getByText("modifié", { exact: true }), "« modifié » sur « Codes »").toHaveCount(2);
    await page.getByRole("tab", { name: "Général", exact: true }).click();
    await expect(page.getByText("modifié", { exact: true }), "« modifié » sur « Général »").toHaveCount(12);
    await expectNumber(page, "Prix de vente (PPV)", ppv);
    await expect(field(page, "Prix de vente (PPV)")).toContainText("Valeur importée :");
    await expect(page.getByText("Description du pharmacien.", { exact: true })).toBeVisible();

    // The list shows his values too (Produits only); the type is still the catalogue's.
    await open(page);
    const found = pageCall(page, "/products", { search: pid });
    await page.getByPlaceholder("Nom, code-barres, PID, laboratoire…").fill(pid);
    expectSame(
      (await found).data[0],
      {
        pid,
        product: `${e.product} (pharmacie)`,
        category: "Catégorie E2E",
        laboratoire: "Laboratoire E2E modifié",
        ppv,
        current_stock: 12,
        category_type: e.category_type,
      },
      "liste après modification",
    );
    // The server refuses a type change too (not an editable value).
    const refused = await apiPut(page, `/products/${id}`, { product_type: "parapharmacie" }, 422);
    expect(refused.code, "type non modifiable").toBe("invalidInput");
  });

  test("modifier : un import de stock garde la valeur du propriétaire, à l'écran aussi", async ({ page }) => {
    const pid = editPid();
    const e = expected().products.sheets[pid];
    const { id } = await openSheet(page, pid);
    await importStockLine(page, e, 999);
    const after = await apiGet(page, `/products/${id}`);
    expect(after.stock.current_stock, "valeur du propriétaire gardée").toBe(12);
    expect(after.imported.current_stock, "nouvelle valeur importée").toBe(999);
    await page.reload();
    await expectNumber(page, "Stock actuel", 12);
    await expect(field(page, "Stock actuel")).toContainText("Valeur importée : 999");
    await importStockLine(page, e, e.stock.current_stock); // back to the oracle's stock
  });

  test("modifier : valeurs fausses refusées, « Annuler », « Revenir à la valeur importée »", async ({ page }) => {
    const pid = editPid();
    const e = expected().products.sheets[pid];
    const ppv = editPlan(e).find((f) => f.field === "ppv")?.sent as number;
    const { id } = await openSheet(page, pid);
    let puts = 0;
    page.on("request", (r) => {
      if (r.method() === "PUT") puts += 1;
    });

    // « Annuler »: nothing sent, nothing changed.
    await page.getByRole("button", { name: "Modifier", exact: true }).click();
    await page.getByLabel("Prix de vente (PPV)", { exact: true }).fill("1,00");
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    expect(puts, "Annuler : rien envoyé").toBe(0);
    await expectNumber(page, "Prix de vente (PPV)", ppv);

    // Wrong values: one message under each, nothing sent.
    await page.getByRole("button", { name: "Modifier", exact: true }).click();
    await page.getByLabel("Prix de vente (PPV)", { exact: true }).fill("douze");
    await page.getByLabel("Stock actuel", { exact: true }).fill("1,5");
    await page.getByLabel("Péremption", { exact: true }).fill("31/02/2027");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Prix invalide (exemple : 12,50).")).toBeVisible();
    await expect(page.getByText("Nombre entier attendu (exemple : 12).")).toBeVisible();
    await expect(page.getByText("Date invalide (exemple : 31/12/2026).")).toBeVisible();
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    // Minimum above maximum (checked once the other values are right).
    await page.getByRole("button", { name: "Modifier", exact: true }).click();
    await page.getByLabel("Stock minimum", { exact: true }).fill("50");
    await page.getByLabel("Stock maximum", { exact: true }).fill("10");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Le stock minimum ne peut pas dépasser le stock maximum.")).toBeVisible();
    expect(puts, "valeurs fausses : rien envoyé").toBe(0);
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    const refused = await apiPut(page, `/products/${id}`, { stock_min: 50, stock_max: 10 }, 400);
    expect(refused.code, "min > max côté serveur").toBe("stockMinAboveMax");

    // « Revenir à la valeur importée » on every edited value → the oracle's sheet again.
    for (const [tab, block] of [
      ["Codes", "Codes du produit"],
      ["Général", "Données générales"],
    ]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      // Count only once the tab is on screen (else: 0 buttons, the loop stops early).
      await expect(page.getByRole("heading", { name: block, exact: true })).toBeVisible();
      const revert = page.getByRole("button", { name: "Revenir à la valeur importée" });
      for (let left = await revert.count(); left > 0; left--) {
        const done = page.waitForResponse((r) => r.request().method() === "PUT");
        await revert.first().click();
        expect((await done).status(), "Revenir").toBe(200);
        await expect(revert, "une valeur de moins").toHaveCount(left - 1);
      }
    }
    await expect(page.getByText("modifié", { exact: true })).toHaveCount(0);
    const back = await apiGet(page, `/products/${id}`);
    expectSame(back, e, "fiche revenue aux valeurs importées");
    expect(back.imported, "plus rien de modifié").toEqual({});
  });
});
