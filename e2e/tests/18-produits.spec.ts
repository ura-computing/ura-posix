/** Produits (owner): every product of the pharmacy (stock file, sold or bought).
 *  List = oracle: page 1 + 2, the « Vendus 12 mois » dates (Stock page window), every
 *  sortable column (desc + asc), search, Pharmacie / Parapharmacie, Excel export.
 *  Photos (scraped fixture, resources/tests/catalog/product-infos.json): found by PID, by a
 *  barcode the admin gives in the catalogue (setup), a dead address → the box icon.
 *  Product sheet (from the list): every case the oracle picked (photos, never bought, not in
 *  the stock file, stock only, negative stock) = oracle, on screen too: header (PID / catégorie /
 *  TVA, type + stock badges, code barre drawn), Général (5 prices, stock, 30 days, informations
 *  générales, 5 latest lines, performance %); copy the barcode; header photo; « Codes » tab kept
 *  in the address, breadcrumb; a product of no pharmacy line → 404 inside the layout.
 *  Statistiques = oracle for every product (30 jours), then every period button + a custom range
 *  + « Copier » on the best seller: KPIs and % vs the days before, 3 charts (12 months, tooltips),
 *  « Détail mensuel », « Tendances », top suppliers, latest prices.
 *  « Mouvements » (from « Voir tout »): all lines, page 2, Achats, Ventes over the test window,
 *  search = oracle, every column on screen (remise, TVA, total), 10 per page. « Voir détail » =
 *  the whole ticket on Ventes / BL on Achats (exact number, period cleared, removable filter).
 *  « Imprimer »: header + open tab, light theme, no menu / buttons / tabs; disabled while editing.
 *  « Codes »: PID / barcodes + « Copier », barcode drawn, format + length, « Scanner / Rechercher
 *  un code barre » (barcode, PID, unknown code, Échap / Annuler).
 *  « Modifier » (owner): edit + Enregistrer → « modifié », list and sheet show his values; a stock
 *  import keeps them; « Éditer » of a block = the same edit mode; « Revenir à la valeur importée »,
 *  « Annuler », min > max refused. Employee: « Modifier » and « Éditer » disabled + reason, PUT refused.
 *  An employee sees the list + a sheet; feature OFF → no menu entry, 404 inside the layout. */
import type { Locator, Page } from "@playwright/test";

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

/** List → type the PID → click the product: its id + the sheet and the statistics (30 jours) the
 *  page loads with it (« Statistiques » then opens without waiting). */
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

/** The value next to a label inside one block (« Code barre 1 » is in 2 blocks of « Codes »). */
const fieldIn = (scope: Locator, label: string) =>
  scope.locator(`xpath=.//dt[normalize-space()="${label}"]/following-sibling::dd[1]`);

/** « EAN-13 » / « UPC-A » / « EAN-8 » when the length and the check digit fit, else « Autre ». */
function barcodeFormat(code: string): string {
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(code)) return "Autre";
  const d = [...code].map(Number);
  const sum = d
    .slice(0, -1)
    .reverse()
    .reduce((acc, x, i) => acc + x * (i % 2 === 0 ? 3 : 1), 0);
  if ((10 - (sum % 10)) % 10 !== d[d.length - 1]) return "Autre";
  return code.length === 13 ? "EAN-13" : code.length === 12 ? "UPC-A" : "EAN-8";
}

/** The big value of the KPI tile labelled `label` in `scope` (« Prix d'achat moyen » is also a
 *  row of « Informations générales »: kpiValue would find both). */
const tile = (scope: Page | Locator, label: string) =>
  scope
    .locator(`xpath=.//div[contains(@class, 'rounded-2xl')][./div/span[normalize-space()="${label}"]]`)
    .locator("span.font-mono.font-bold")
    .first();

async function expectTile(scope: Page | Locator, label: string, want: number | null): Promise<void> {
  const got = frNumber((await tile(scope, label).innerText()).replace(/unités/, ""));
  if (want == null) expect(got, label).toBeNull();
  else expect(Math.abs((got ?? NaN) - want), `${label}: écran ${got} ≠ ${want}`).toBeLessThanOrEqual(0.011);
}

/** « Médicament (30.000%) » → « Médicament »; « Exonéré (0.00%) » → « Exonéré »; « TVA (20.00%) » → « 20,00 % ». */
const withoutRate = (label: string) => label.replace(/\s*\([^()]*\)\s*$/, "");
function tvaShort(tva: string): string {
  const m = /^(.*?)\s*\((\d+(?:\.\d+)?)%\)$/.exec(tva);
  if (!m) return tva;
  return m[1].toLowerCase() === "tva" ? `${Number(m[2]).toFixed(2).replace(".", ",")} %` : m[1];
}

/** Header badge of the stock: in the file with more than 0, 0 or less, not in the file. */
const stockState = (stock: number | null) => (stock == null ? "Hors stock" : stock > 0 ? "En stock" : "Rupture");

/** % change shown by « Performance » (none when nothing the 30 days before). */
const change = (now: number, before: number) => (before ? ((now - before) / before) * 100 : null);

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
    await expect(other.getByRole("button", { name: "Imprimer", exact: true }), "employé : imprimer").toBeEnabled();
    const blocks = other.getByRole("button", { name: "Éditer", exact: true });
    await expect(blocks, "« Éditer » de Stock + Informations générales").toHaveCount(2);
    for (const button of await blocks.all()) await expect(button).toBeDisabled();
    await expect(other.getByText("Seul le propriétaire peut modifier ce produit.")).toBeVisible();
    const refused = await apiPut(other, `/products/${got.data[0].id}`, { ppv: 1 }, 403);
    expect(refused.code, "PUT par un employé").toBe("ownerOnly");

    // « Voir détail » follows his permissions: no « Achats » → disabled on a purchase only.
    await apiPut(page, `/owner/employees/${member.id}/permissions`, { permissions: { achats: false } });
    await other.reload();
    await other.getByRole("tab", { name: "Mouvements", exact: true }).click();
    await other.getByRole("button", { name: "Achats", exact: true }).click();
    await expect(other.locator("tbody tr").first().getByRole("button", { name: "Voir détail" })).toBeDisabled();
    await other.getByRole("button", { name: "Ventes", exact: true }).click();
    await expect(other.locator("tbody tr").first().getByRole("button", { name: "Voir détail" })).toBeEnabled();
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

      // Header: PID | Catégorie | TVA (without their rate), type + stock badges, code barre.
      const header = page.locator("main header");
      await expect(header).toContainText(`PID : ${pid}`);
      await expect(header).toContainText(`Catégorie : ${withoutRate(e.category)}`);
      await expect(header).toContainText(`TVA : ${tvaShort(e.tva)}`);
      // The badge comes after « Catégorie : … » (the category can be the same word: « Parapharmacie »).
      await expect(
        header.getByText(e.category_type === "pharmacie" ? "Pharmacie" : "Parapharmacie", { exact: true }).last(),
      ).toHaveClass(/rounded-md/);
      await expect(header.getByText(stockState(e.stock.current_stock), { exact: true })).toBeVisible();
      if (e.barcode1) {
        await expect(header.getByText(e.barcode1, { exact: true })).toBeVisible();
        await expect(
          header
            .getByRole("img", { name: `Code barre ${e.barcode1}` })
            .locator("rect")
            .first(),
        ).toBeAttached();
      } else await expect(header.getByText("Non disponible", { exact: true })).toBeVisible();

      // 5 tiles: prices and marge.
      const { ppv, avg_pu, last_pu, last_pu_date, marge_pct } = e.prices;
      await expectTile(page, "Prix de vente (PPV)", ppv);
      await expectTile(page, "Prix d'achat moyen", avg_pu);
      await expectTile(page, "Dernier prix d'achat", last_pu);
      if (last_pu_date) await expect(page.getByText(`(${frDate(last_pu_date)})`, { exact: true })).toBeVisible();
      await expectTile(page, "Marge brute", avg_pu == null ? null : ppv - avg_pu);
      await expectTile(page, "Marge %", marge_pct);

      // Stock (Stock page rules).
      if (e.stock.current_stock == null) await expect(field(page, "Stock actuel")).toHaveText("Hors stock");
      else await expectNumber(page, "Stock actuel", e.stock.current_stock);
      await expectNumber(page, "Stock minimum", e.stock.stock_min);
      await expectNumber(page, "Stock maximum", e.stock.stock_max);

      // Ventes / Achats 30 jours, and « Performance » = the same units + % vs the 30 days before.
      const { sold, bought, sold_before, bought_before } = e.last_30d;
      await expectTile(page, "Ventes 30 jours", sold);
      await expectTile(page, "Achats 30 jours", bought);
      const perf = section(page, "Performance");
      for (const [label, now, before] of [
        ["Ventes", sold, sold_before],
        ["Achats", bought, bought_before],
      ] as const) {
        await expectTile(perf, label, now);
        const pill = perf
          .locator(`xpath=.//div[contains(@class, 'rounded-2xl')][./div/span[normalize-space()="${label}"]]`)
          .locator("span.rounded-full");
        const want = change(now, before);
        if (want == null) await expect(pill, `${label} : pas de %`).toHaveCount(0);
        else
          expect(Math.abs((frNumber(await pill.innerText()) ?? NaN) - want), `${label} %`).toBeLessThanOrEqual(0.006);
      }

      // Informations générales: the values as imported (« Non disponible » when none).
      const infos: [string, string][] = [
        ["Produit", e.product],
        ["PID", pid],
        ["Catégorie", e.category],
        ["TVA", e.tva],
        ["Code barre", e.barcode1 ?? "Non disponible"],
        ["Laboratoire", e.laboratoire ?? "Non disponible"],
      ];
      for (const [label, want] of infos) await expect(field(page, label), label).toHaveText(want);
      await expectNumber(page, "PPV", ppv);
      // Never bought with a price: « Non disponible » (the tile shows « — »).
      if (avg_pu == null) await expect(field(page, "Prix d'achat moyen")).toHaveText("Non disponible");
      else await expectNumber(page, "Prix d'achat moyen", avg_pu);
      if (last_pu_date) await expect(field(page, "Dernier prix d'achat")).toContainText(`(${frDate(last_pu_date)})`);
      else await expect(field(page, "Dernier prix d'achat")).toHaveText("Non disponible");

      // Mouvements récents: the 5 latest lines.
      const moves: Row[] = e.recent_movements;
      if (moves.length === 0) await expect(page.getByText("Aucun achat ni vente pour ce produit.")).toBeVisible();
      else {
        expect(await columnTexts(page, "Type"), "types").toEqual(
          moves.map((m) => (m.kind === "achat" ? "Achat" : "Vente")),
        );
        expect(await columnTexts(page, "Référence"), "références").toEqual(moves.map((m) => m.document ?? "—"));
        expect((await columnTexts(page, "Quantité")).map(frNumber), "quantités").toEqual(moves.map((m) => m.quantity));
      }
    });
  }
});

test("fiche produit: copier le code barre (en-tête)", async ({ page }) => {
  const [pid, e] = Object.entries<Row>(expected().products.sheets).find(([, s]) => s.barcode1) as [string, Row];
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await openSheet(page, pid);
  await page.locator("main header").getByRole("button", { name: "Copier le code barre", exact: true }).click();
  await expect(page.getByText(`Copié : ${e.barcode1}`, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText()), "presse-papiers").toBe(e.barcode1);
});

test("fiche produit: « Imprimer » = l'en-tête + l'onglet ouvert, en thème clair, sans menu ni boutons", async ({
  page,
}) => {
  const [pid, e] = Object.entries<Row>(expected().products.sheets)[0];
  await openSheet(page, pid);
  await page.getByRole("tab", { name: "Statistiques", exact: true }).click();
  const print = page.getByRole("button", { name: "Imprimer", exact: true });

  // window.print opens the browser's print window: replaced here to see the theme it prints in.
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
    const w = window as unknown as { printed: boolean[] };
    w.printed = [];
    window.print = () => w.printed.push(document.documentElement.classList.contains("dark"));
  });
  await print.click();
  expect(await page.evaluate(() => (window as unknown as { printed: boolean[] }).printed), "imprimé en clair").toEqual([
    false,
  ]);
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark")), "sombre ensuite").toBe(true);
  await page.evaluate(() => document.documentElement.classList.remove("dark"));

  // On paper: the header and the open tab (its name as a title), no menu, buttons or tabs.
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("aside"), "menu").toBeHidden();
  await expect(print).toBeHidden();
  await expect(page.getByRole("button", { name: "Modifier", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "30 jours", exact: true })).toBeHidden();
  await expect(page.getByRole("tablist")).toBeHidden();
  await expect(page.getByRole("heading", { level: 1, name: e.product, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Statistiques", exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Ventes par mois", exact: true })).toBeVisible();
  await expect(page.getByText(/^Du .+ au .+ · les % comparent/), "la période").toBeVisible();
  // « Mouvements » on paper: a line says which lines (no filter fields), no « Action » column.
  await page.goto(page.url().replace("tab=stats", "tab=movements"));
  await expect(page.getByText(/^Tous · toutes les dates · lignes 1 à 10 sur [\d\s\u202f]+$/)).toBeVisible();
  await expect(page.getByPlaceholder("Rechercher une référence, un client…")).toBeHidden();
  await expect(page.getByRole("columnheader", { name: "Action" })).toBeHidden();
  await expect(page.getByRole("columnheader", { name: "Total" })).toBeVisible();
  await page.emulateMedia({ media: null });
  await expect(page.getByRole("heading", { level: 2, name: "Statistiques", exact: true }), "écran").toBeHidden();

  // While editing: disabled, with the reason.
  await page.getByRole("button", { name: "Modifier", exact: true }).click();
  await expect(print).toBeDisabled();
  await expect(print).toHaveAttribute("title", "Enregistrez ou annulez la modification avant d'imprimer.");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(print).toBeEnabled();
});

test("fiche produit: photo de l'en-tête (première photo, adresse morte, aucune)", async ({ page }) => {
  const sheets = expected().products.sheets;
  const [withTwo, , dead] = Object.keys(sheets);
  const header = page.locator("main header");

  await openSheet(page, withTwo);
  await expect(header.locator("img").first()).toHaveAttribute("src", sheets[withTwo].info.images[0]);

  await openSheet(page, dead);
  await expect(header.getByRole("img", { name: "Pas de photo" })).toBeVisible();

  const without = Object.keys(sheets).find((pid) => sheets[pid].info === null) as string;
  await openSheet(page, without);
  await expect(header.getByRole("img", { name: "Pas de photo" })).toBeVisible();
});

test("fiche produit: onglet « Codes » (identifiants, copier, format, longueur), gardé dans l'adresse, fil d'Ariane", async ({
  page,
}) => {
  const { product, barcode1 } = expected().products.barcode_setup;
  const pid = rows().find((r) => r.product === product)?.pid as string;
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await openSheet(page, pid);
  await page.getByRole("tab", { name: "Codes", exact: true }).click();
  await expect(page).toHaveURL(/\?tab=codes$/);

  // « Identifiants du produit »: PID, code barre 1 (the admin's), code barre 2 (none).
  const ids = section(page, "Identifiants du produit");
  await expect(ids.getByText(/^Le PID est le numéro unique du produit chez Sobrus/)).toBeVisible();
  await expect(fieldIn(ids, "PID")).toContainText(pid);
  await expect(fieldIn(ids, "Code barre 1")).toContainText(barcode1);
  await expect(fieldIn(ids, "Code barre 2")).toContainText("Non disponible");
  await expect(
    ids.getByRole("button", { name: "Copier le code barre 2", exact: true }),
    "rien à copier",
  ).toBeDisabled();
  for (const [button, value] of [
    ["Copier le PID", pid],
    ["Copier le code barre 1", barcode1],
  ]) {
    await ids.getByRole("button", { name: button, exact: true }).click();
    await expect(page.getByText(`Copié : ${value}`, { exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText()), button).toBe(value);
  }
  await expect(
    ids
      .getByRole("img", { name: `Code barre ${barcode1}`, exact: true })
      .locator("rect")
      .first(),
  ).toBeAttached();
  await expect(ids.getByText(barcode1, { exact: true }).last(), "numéro sous le dessin").toBeVisible();

  // One block per barcode: value, format (check digit), length; none → « Non disponible » + a note.
  const first = section(page, "Code barre 1");
  await expect(fieldIn(first, "Code barre 1")).toContainText(barcode1);
  await expect(fieldIn(first, "Format")).toHaveText(barcodeFormat(barcode1));
  await expect(fieldIn(first, "Longueur")).toHaveText(`${barcode1.length} chiffres`);
  await expect(first.getByRole("button", { name: "Copier le code barre 1", exact: true })).toBeEnabled();
  const second = section(page, "Code barre 2");
  for (const label of ["Code barre 2", "Format", "Longueur"]) {
    await expect(fieldIn(second, label), label).toContainText("Non disponible");
  }
  await expect(second.getByText(/^Le code barre 2 n'est pas renseigné pour ce produit\./)).toBeVisible();
  await expect(second.getByRole("button", { name: "Copier le code barre 2", exact: true })).toBeDisabled();

  // A barcode from the stock file (not a real EAN: wrong check digit → « Autre »).
  const [otherPid, other] = Object.entries<Row>(expected().products.sheets).find(
    ([p, e]) => p !== pid && e.barcode1,
  ) as [string, Row];
  await openSheet(page, otherPid);
  await page.getByRole("tab", { name: "Codes", exact: true }).click();
  await expect(fieldIn(section(page, "Code barre 1"), "Format")).toHaveText(barcodeFormat(other.barcode1));
  await expect(fieldIn(section(page, "Code barre 1"), "Longueur")).toHaveText(`${other.barcode1.length} chiffres`);

  // The tab stays on reload; « Général » takes it out of the address.
  await page.reload();
  await expect(page.getByRole("tab", { name: "Codes", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Général", exact: true }).click();
  await expect(page).not.toHaveURL(/tab=/);
  // Breadcrumb « ⌂ › Produits › name », then the browser's back button.
  const crumbs = page.locator("main nav");
  await expect(crumbs.getByRole("link", { name: "Accueil", exact: true })).toHaveAttribute("href", "/");
  await expect(crumbs.getByText(other.product, { exact: true })).toBeVisible();
  await crumbs.getByRole("link", { name: "Produits", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Produits", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: other.product, exact: true })).toBeVisible();
});

test("fiche produit: « Scanner / Rechercher un code barre » (code barre, PID, code inconnu, Échap, Annuler)", async ({
  page,
}) => {
  const sheets = Object.entries<Row>(expected().products.sheets);
  const [pidA, a] = sheets[0];
  const [pidB, b] = sheets.find(([p, e]) => p !== pidA && e.barcode1) as [string, Row];
  const { id: idA } = await openSheet(page, pidA);
  await page.getByRole("tab", { name: "Codes", exact: true }).click();
  const scan = () => page.getByRole("button", { name: "Scanner / Rechercher un code barre", exact: true }).click();
  const field = page.getByRole("dialog").getByLabel("Code barre ou PID", { exact: true });

  // Unknown code: the message, the field empty and ready for the next scan, same page.
  await scan();
  await expect(field, "prêt à scanner").toBeFocused();
  let answer = page.waitForResponse((r) => r.url().includes("/v1/products/lookup?"));
  await page.keyboard.type("0000000000000");
  await page.keyboard.press("Enter"); // a USB reader types the code, then « Entrée »
  const res = await answer;
  expect(res.status(), "code inconnu").toBe(404);
  expect((await res.json()).code, "code d'erreur").toBe("productNotFound");
  await expect(page.getByRole("alert")).toHaveText("Aucun produit avec le code 0000000000000 dans votre pharmacie.");
  await expect(field).toHaveValue("");
  await expect(page).toHaveURL(new RegExp(`/produits/${idA}\\?tab=codes$`));

  // A barcode of another product → its sheet, on « Général ».
  answer = page.waitForResponse((r) => r.url().includes("/v1/products/lookup?"));
  await page.keyboard.type(b.barcode1);
  await page.keyboard.press("Enter");
  const found = await (await answer).json();
  await expect(page.getByRole("heading", { level: 1, name: b.product, exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/produits/${found.id}$`));
  await expect(page.getByRole("tab", { name: "Général", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(found.id, "autre produit").not.toBe(idA);
  expect((await apiGet(page, `/products/${found.id}`)).pid, "PID du produit trouvé").toBe(pidB);

  // The PID typed by hand + « Rechercher » → back to the first product.
  await page.getByRole("tab", { name: "Codes", exact: true }).click();
  await scan();
  await field.fill(pidA);
  await page.getByRole("dialog").getByRole("button", { name: "Rechercher", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: a.product, exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/produits/${idA}$`));

  // « Échap » and « Annuler » close without searching.
  await page.getByRole("tab", { name: "Codes", exact: true }).click();
  await scan();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await scan();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Rechercher", exact: true }),
    "rien tapé",
  ).toBeDisabled();
  await page.getByRole("dialog").getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/produits/${idA}\\?tab=codes$`));
});

test("fiche produit: en espagnol (onglets, blocs, boutons), choix gardé, retour en français", async ({ page }) => {
  await openSheet(page, Object.keys(expected().products.sheets)[0]);
  await page.getByRole("button", { name: "Espagnol", exact: true }).click();
  for (const name of ["General", "Estadísticas", "Movimientos", "Códigos"]) {
    await expect(page.getByRole("tab", { name, exact: true }), `onglet ${name}`).toBeVisible();
  }
  for (const title of ["Stock", "Información general", "Movimientos recientes", "Rendimiento"]) {
    await expect(page.getByRole("heading", { name: title, exact: true }), title).toBeVisible();
  }
  for (const label of ["Margen bruto", "Ventas 30 días", "Compras 30 días"]) {
    await expect(page.getByText(label, { exact: true }), label).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Editar", exact: true }), "Editar + 2 « Editar »").toHaveCount(3);
  await expect(page.getByRole("button", { name: "Imprimir", exact: true })).toBeVisible();
  await page.reload(); // the language is remembered
  await expect(page.getByRole("tab", { name: "Estadísticas", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Estadísticas", exact: true }).click();
  await expect(page.getByText("Cantidad vendida (total)", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Personalizado", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Movimientos", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ver detalle", exact: true }).first()).toBeVisible();
  await expect(page.getByPlaceholder("Buscar una referencia, un cliente…")).toBeVisible();
  await page.getByRole("tab", { name: "Códigos", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Identificadores del producto", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Escanear / Buscar un código de barras", exact: true })).toBeVisible();
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

/** The % pill of the KPI tile `label` in `scope` (none when nothing the days before). */
async function expectChange(scope: Page | Locator, label: string, now: number | null, before: number | null) {
  const pill = scope
    .locator(`xpath=.//div[contains(@class, 'rounded-2xl')][./div/span[normalize-space()="${label}"]]`)
    .locator("span.rounded-full");
  const want = now == null || before == null ? null : change(now, before);
  if (want == null) await expect(pill, `${label} : pas de %`).toHaveCount(0);
  else expect(Math.abs((frNumber(await pill.innerText()) ?? NaN) - want), `${label} %`).toBeLessThanOrEqual(0.006);
}

const monthName = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
/** A number as « Copier » puts it for Excel: French style, no thousands space. */
const excel = (n: number | null, decimals: number) => (n == null ? "" : n.toFixed(decimals).replace(".", ","));

/** Statistiques tab for one period = the oracle, on screen. */
async function expectStats(page: Page, e: Row): Promise<void> {
  await expect(page.getByText(/^Du .+ au .+ · les % comparent/)).toHaveText(
    `Du ${frDate(e.date_from)} au ${frDate(e.date_to)} · les % comparent aux jours d'avant, du ${frDate(e.previous_from)} au ${frDate(e.previous_to)}.`,
  );
  const { period: now, previous: before } = e;
  for (const [label, key] of [
    ["Quantité vendue (total)", "sold"],
    ["Quantité achetée (total)", "bought"],
    ["Chiffre d'affaires", "ca"],
    ["Marge générée", "marge"],
    ["Nb. de transactions vente", "transactions"],
  ] as const) {
    await expectTile(page, label, now[key]);
    await expectChange(page, label, now[key], before[key]);
  }

  // 3 charts over the last 12 months: 12 bars, or 2 solid curves of 2 colors; the last month's tooltip.
  const monthly: Row[] = e.monthly;
  const last = monthly[11];
  for (const [title, keys] of [
    ["Ventes par mois", ["sold"]],
    ["Achats par mois", ["bought"]],
    ["Ventes vs Achats", ["sold", "bought"]],
  ] as const) {
    const chart = page.getByRole("img", { name: title, exact: true });
    if (keys.length === 1) await expect(chart.locator("rect"), `${title} : 12 barres`).toHaveCount(12);
    else {
      await expect(chart.locator("path"), `${title} : 2 courbes`).toHaveCount(2);
      // framer-motion draws a line with one dash as long as the line (« 1 1 » on pathLength 1) =
      // a solid line once drawn; a dashed curve would have a pattern (« 5 4 »).
      await expect
        .poll(
          () =>
            chart
              .locator("path")
              .evaluateAll((els) =>
                els.map((el) => [el.getAttribute("stroke-dasharray"), el.getAttribute("pathLength")].join(" / ")),
              ),
          { message: "traits pleins" },
        )
        .toEqual(["1 1 / 1", "1 1 / 1"]);
      const colors = await chart.locator("path").evaluateAll((els) => els.map((el) => el.getAttribute("stroke")));
      expect(new Set(colors).size, "une couleur par courbe").toBe(2);
    }
    const label = await chart.locator("text").last().boundingBox();
    const box = await chart.boundingBox();
    if (!label || !box) throw new Error(`pas de graphique ${title}`);
    await page.mouse.move(label.x + label.width / 2, box.y + box.height / 2);
    const tip = section(page, title)
      .locator("div.pointer-events-none")
      .filter({ hasText: monthName(last.month) });
    await expect(tip, `${title} : info-bulle`).toBeVisible();
    for (const key of keys) {
      const line = tip.locator("div.justify-between").filter({ hasText: key === "sold" ? "Ventes" : "Achats" });
      expect(frNumber(await line.locator("span.font-mono").innerText()), `${title} ${key}`).toBe(last[key]);
    }
  }
  await page.mouse.move(0, 0);

  // « Détail mensuel »: one line per month, oldest first.
  const table = section(page, "Détail mensuel").locator("table");
  expect(await columnTexts(page, "Mois", table), "mois").toEqual(monthly.map((m) => monthName(m.month)));
  for (const [header, key] of [
    ["Ventes (unités)", "sold"],
    ["Achats (unités)", "bought"],
    ["CA (MAD)", "ca"],
    ["Marge (MAD)", "marge"],
  ] as const) {
    const shown = (await columnTexts(page, header, table)).map(frNumber);
    shown.forEach((v, i) => {
      const want = monthly[i][key];
      if (want == null) expect(v, `${header} ${monthly[i].month}`).toBeNull();
      else expect(Math.abs((v ?? NaN) - want), `${header} ${monthly[i].month}`).toBeLessThanOrEqual(0.011);
    });
  }

  // « Tendances »: the same % as the quantities, one dot per day / week / month (value on hover).
  const trend: Row[] = e.trend;
  for (const [label, key] of [
    ["Tendance des ventes", "sold"],
    ["Tendance des achats", "bought"],
  ] as const) {
    await expectChange(section(page, "Tendances"), label, now[key], before[key]);
    const dots = page.getByRole("img", { name: label, exact: true }).locator("circle title");
    const values = (await dots.allTextContents()).map((x) => frNumber(x.split(" : ")[1]));
    expect(values, `${label} : points`).toEqual(trend.map((p) => p[key]));
  }

  // « Top fournisseurs » (+ « Autres ») and the latest price of each supplier.
  const suppliers: Row[] = [
    ...e.top_suppliers,
    ...(e.other_suppliers ? [{ ...e.other_suppliers, supplier: "Autres" }] : []),
  ];
  const top = section(page, "Top fournisseurs");
  if (suppliers.length === 0) await expect(top.getByText("Aucun achat sur la période.")).toBeVisible();
  else {
    const t = top.locator("table");
    expect(await columnTexts(page, "Fournisseur", t), "fournisseurs").toEqual(suppliers.map((r) => r.supplier));
    expect((await columnTexts(page, "Quantité", t)).map(frNumber), "quantités").toEqual(
      suppliers.map((r) => r.quantity),
    );
    const pcts = (await columnTexts(page, "% du total", t)).map(frNumber);
    pcts.forEach((v, i) => expect(Math.abs((v ?? NaN) - suppliers[i].pct), "% du total").toBeLessThanOrEqual(0.006));
  }
  const prices: Row[] = e.last_prices;
  const lastPrices = section(page, "Derniers prix d'achat par fournisseur");
  if (prices.length === 0) await expect(lastPrices.getByText("Aucun achat avec un prix.")).toBeVisible();
  else {
    const t = lastPrices.locator("table");
    expect(await columnTexts(page, "Fournisseur", t), "derniers prix : fournisseurs").toEqual(
      prices.map((r) => r.supplier),
    );
    const pus = (await columnTexts(page, "Prix unitaire", t)).map(frNumber);
    pus.forEach((v, i) =>
      expect(Math.abs((v ?? NaN) - prices[i].unit_price), "prix unitaire").toBeLessThanOrEqual(0.006),
    );
  }
}

test("fiche produit: onglet « Statistiques » (30 jours) = oracle, chaque produit", async ({ page }) => {
  const all = expected().products.stats;
  for (const pid of Object.keys(all)) {
    await test.step(pid, async () => {
      const e = all[pid]["30d"];
      const { stats } = await openSheet(page, pid);
      expectSame(stats, e, `statistiques ${pid} (30 jours, chargées avec la fiche)`);
      await page.getByRole("tab", { name: "Statistiques", exact: true }).click();
      await expect(page).toHaveURL(/\?tab=stats$/);
      await expect(page.getByRole("button", { name: "30 jours", exact: true })).toHaveClass(/bg-primary/);
      await expectStats(page, e);
    });
  }
});

test("fiche produit: Statistiques, chaque période + Personnalisé, « Copier » le détail mensuel", async ({ page }) => {
  const pid = Object.keys(expected().products.stats)[0];
  const all = expected().products.stats[pid];
  const { id } = await openSheet(page, pid);
  await page.getByRole("tab", { name: "Statistiques", exact: true }).click();
  for (const [button, key] of [
    ["7 jours", "7d"],
    ["3 mois", "3m"],
    ["12 mois", "12m"],
  ] as const) {
    await test.step(button, async () => {
      const e = all[key];
      const stats = pageCall(page, `/products/${id}/stats`, { date_from: e.date_from, date_to: e.date_to });
      await page.getByRole("button", { name: button, exact: true }).click();
      expectSame(await stats, e, `statistiques ${button}`);
      await expectStats(page, e);
    });
  }
  await test.step("Personnalisé", async () => {
    const e = all.custom;
    await page.getByRole("button", { name: "Personnalisé", exact: true }).click();
    // The date fields start from the dates shown (12 mois), then change the period.
    await expect(page.getByLabel("Date fin année", { exact: true })).toHaveValue(all["12m"].date_to.slice(0, 4));
    const stats = pageCall(page, `/products/${id}/stats`, { date_from: e.date_from, date_to: e.date_to });
    await setPeriod(page, e.date_from, e.date_to);
    expectSame(await stats, e, "statistiques Personnalisé");
    await expectStats(page, e);
    // The period stays while going to another tab and back.
    await page.getByRole("tab", { name: "Général", exact: true }).click();
    await page.getByRole("tab", { name: "Statistiques", exact: true }).click();
    await expect(page.getByLabel("Date début année", { exact: true })).toHaveValue(e.date_from.slice(0, 4));
  });
  await test.step("Copier", async () => {
    const e = all.custom;
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await section(page, "Détail mensuel").getByRole("button", { name: "Copier le tableau", exact: true }).click();
    await expect(page.getByText("Tableau copié : collez-le dans Excel.")).toBeVisible();
    const lines = ["Mois\tVentes (unités)\tAchats (unités)\tCA (MAD)\tMarge (MAD)"].concat(
      (e.monthly as Row[]).map((m) =>
        [monthName(m.month), excel(m.sold, 0), excel(m.bought, 0), excel(m.ca, 2), excel(m.marge, 2)].join("\t"),
      ),
    );
    const copied = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\u2212/g, "-");
    expect(copied.split("\n"), "presse-papiers").toEqual(lines);
  });
});

test("fiche produit: onglet « Mouvements » = oracle (type, période, recherche, 10 par page, chaque colonne)", async ({
  page,
}) => {
  const e = expected().products.movements;
  const w = testWindow();
  const { id, sheet } = await openSheet(page, e.pid);
  const path = `/products/${id}/movements`;
  const tva = tvaShort(sheet.tva);
  const check = (got: Row, want: Row, what: string) => {
    expect(got.pagination.total, `${what}: nombre de lignes`).toBe(want.total);
    expectSame(got.data, want.page, `${what}: lignes`);
  };
  /** The lines drawn = the oracle's page, column by column. */
  const expectRows = async (want: Row[], what: string) => {
    await expect(page.locator("tbody tr"), `${what}: lignes dessinées`).toHaveCount(want.length);
    expect(await columnTexts(page, "Type"), `${what}: types`).toEqual(
      want.map((m) => (m.kind === "achat" ? "Achat" : "Vente")),
    );
    expect(await columnTexts(page, "Référence"), `${what}: références`).toEqual(want.map((m) => m.document ?? "—"));
    expect(await columnTexts(page, "Client / Fournisseur"), `${what}: clients / fournisseurs`).toEqual(
      want.map((m) => m.party ?? "—"),
    );
    expect((await columnTexts(page, "Quantité")).map(frNumber), `${what}: quantités`).toEqual(
      want.map((m) => m.quantity),
    );
    for (const [header, key] of [
      ["Prix unitaire", "unit_price"],
      ["Total", "total"],
    ] as const) {
      const shown = (await columnTexts(page, header)).map(frNumber);
      shown.forEach((v, i) =>
        expect(Math.abs((v ?? NaN) - want[i][key]), `${what}: ${header}`).toBeLessThanOrEqual(0.011),
      );
    }
    // Remise: a sale's % (0 when none), « — » for a purchase. TVA: the product's.
    const remises = await columnTexts(page, "Remise");
    remises.forEach((v, i) =>
      want[i].kind === "achat"
        ? expect(v, `${what}: remise d'un achat`).toBe("—")
        : expect(frNumber(v), `${what}: remise`).toBe(want[i].discount ?? 0),
    );
    expect(await columnTexts(page, "TVA"), `${what}: TVA`).toEqual(want.map(() => tva));
    await expect(page.getByRole("button", { name: "Voir détail", exact: true }), `${what}: Voir détail`).toHaveCount(
      want.length,
    );
  };

  // « Voir tout » under « Mouvements récents » opens the tab: 10 lines a page.
  let call = pageCall(page, path, { page: "1", kind: "all", limit: "10" });
  await section(page, "Mouvements récents").getByRole("button", { name: "Voir tout" }).click();
  await expect(page).toHaveURL(/\?tab=movements$/);
  check(await call, e.all, "tout");
  await expectRows(e.all.page, "tout");
  await expect(page.getByText(/10 \/ page/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Exporter Excel" }), "plus d'export").toHaveCount(0);

  call = pageCall(page, path, { page: "2" });
  await page.getByRole("button", { name: "Page suivante" }).click();
  check(await call, e.all_page2, "page 2");
  await expectRows(e.all_page2.page, "page 2");

  call = pageCall(page, path, { kind: "achat", page: "1" });
  await pickCategoryType(page, "Achats");
  check(await call, e.achats, "achats");
  await expectRows(e.achats.page, "achats");

  await pickCategoryType(page, "Ventes");
  call = pageCall(page, path, { kind: "vente", ...period(w) });
  await setPeriod(page, w.date_from, w.date_to);
  check(await call, e.ventes_window, "ventes sur la période");
  await expectRows(e.ventes_window.page, "ventes sur la période");

  call = pageCall(page, path, { kind: "all", date_from: null, date_to: null });
  await page.getByRole("button", { name: "Tout réinitialiser" }).click();
  check(await call, e.all, "tout réinitialisé");
  call = pageCall(page, path, { search: e.client });
  await page.getByPlaceholder("Rechercher une référence, un client…").fill(e.client);
  check(await call, e.search, `recherche « ${e.client} »`);
  await expectRows(e.search.page, "recherche");
});

test("fiche produit: « Voir détail » = tout le ticket dans Ventes, tout le BL dans Achats (période retirée)", async ({
  page,
}) => {
  const e = expected().products.movements;
  const w = testWindow();
  const { id } = await openSheet(page, e.pid);
  await page.getByRole("tab", { name: "Mouvements", exact: true }).click();

  // Its latest sale, with a period chosen: « Voir détail » removes the period (the whole ticket).
  await pickCategoryType(page, "Ventes");
  let moves = pageCall(page, `/products/${id}/movements`, { kind: "vente", ...period(w) });
  await setPeriod(page, w.date_from, w.date_to);
  expect((await moves).data[0].document, "dernière vente").toBe(e.ticket.ref);
  const ventes = pageCall(page, "/ventes", { ref: e.ticket.ref, date_from: null, date_to: null });
  await page.locator("tbody tr").first().getByRole("button", { name: "Voir détail", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/ventes\\?ref=${e.ticket.ref}$`));
  const ticket = await ventes;
  expect(ticket.pagination.total, "lignes du ticket").toBe(e.ticket.products.length);
  expect(ticket.data.map((r: Row) => r.product).sort(), "produits du ticket").toEqual(e.ticket.products);
  await expect(page.getByText(`Ticket : ${e.ticket.ref}`, { exact: true })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(e.ticket.products.length);
  for (const ref of await columnTexts(page, "N° Transaction")) expect(ref, "N° du ticket").toContain(e.ticket.ref);
  await expect(page.getByLabel("Date début jour", { exact: true }), "période retirée").toHaveValue("");
  // Removing the filter → every sale again.
  const all = pageCall(page, "/ventes", { ref: null });
  await page
    .locator("span", { hasText: `Ticket : ${e.ticket.ref}` })
    .getByRole("button", { name: "Supprimer le filtre" })
    .click();
  expect((await all).pagination.total, "toutes les ventes").toBeGreaterThan(e.ticket.products.length);
  await expect(page).not.toHaveURL(/ref=/);

  // Its latest purchase → the whole BL on Achats; « Tout réinitialiser » removes it.
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/produits/${id}\\?tab=movements$`));
  moves = pageCall(page, `/products/${id}/movements`, { kind: "achat" });
  await pickCategoryType(page, "Achats");
  expect((await moves).data[0].document, "dernier achat").toBe(e.bl.ref);
  const achats = pageCall(page, "/achats", { ref: e.bl.ref, date_from: null, date_to: null });
  await page.locator("tbody tr").first().getByRole("button", { name: "Voir détail", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/achats\\?ref=${e.bl.ref}$`));
  const bl = await achats;
  expect(bl.pagination.total, "lignes du BL").toBe(e.bl.products.length);
  expect(bl.data.map((r: Row) => r.product).sort(), "produits du BL").toEqual(e.bl.products);
  await expect(page.getByText(`BL : ${e.bl.ref}`, { exact: true })).toBeVisible();
  for (const ref of await columnTexts(page, "Référence")) expect(ref, "N° du BL").toContain(e.bl.ref);
  await page.getByRole("button", { name: "Tout réinitialiser" }).click();
  await expect(page).not.toHaveURL(/ref=/);
  await expect(page.getByText(`BL : ${e.bl.ref}`, { exact: true })).toHaveCount(0);
});

// ── « Modifier » (owner) ────────────────────────────────────────────────────

/** 2nd product the oracle opens (sold, bought, in the stock file). */
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
  return [
    {
      label: "Produit",
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
      label: "PPV",
      tab: "Général",
      typed: frDecimal(ppv),
      field: "ppv",
      sent: ppv,
      imported: e.prices.ppv,
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
      label: "Code barre 1",
      tab: "Codes",
      typed: "3760000000082",
      field: "barcode1",
      sent: "3760000000082",
      imported: e.barcode1,
    },
    {
      label: "Code barre 2",
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
        prices: {
          ppv,
          marge_pct: e.prices.avg_pu == null ? null : (1 - e.prices.avg_pu / ppv) * 100, // follows the PPV shown
        },
        stock: { current_stock: 12, stock_min: 3, stock_max: 9 },
        imported: Object.fromEntries(plan.map((f) => [f.field, f.imported])),
      },
      "fiche après Enregistrer",
    );
    await expect(page.getByText("Fiche enregistrée")).toBeVisible();
    await expect(page.getByRole("button", { name: "Modifier", exact: true }), "fin de la modification").toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: `${e.product} (pharmacie)`, exact: true })).toBeVisible();
    await expect(page.getByText("modifié", { exact: true }), "« modifié » sur « Codes »").toHaveCount(2);
    await page.getByRole("tab", { name: "Général", exact: true }).click();
    // 8 values + « Code barre » (= code barre 1); the tiles and the header show his PPV / name too.
    await expect(page.getByText("modifié", { exact: true }), "« modifié » sur « Général »").toHaveCount(9);
    await expectNumber(page, "PPV", ppv);
    await expect(field(page, "PPV")).toContainText("Valeur importée :");
    await expectTile(page, "Prix de vente (PPV)", ppv);
    await expect(field(page, "Code barre")).toContainText("3760000000082");
    await expect(page.locator("main header").getByText("3760000000082", { exact: true })).toBeVisible();

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
    // « Scanner / Rechercher un code barre » finds the product by the owner's barcode too.
    expect((await apiGet(page, "/products/lookup", { code: "3760000000099" })).id, "code barre du propriétaire").toBe(
      id,
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

    // « Éditer » of each block = the same edit mode (« Annuler » / « Enregistrer » in the header).
    for (const block of ["Stock", "Informations générales"]) {
      await section(page, block).getByRole("button", { name: "Éditer", exact: true }).click();
      await expect(page.getByLabel("Stock actuel", { exact: true }), `${block} : saisie`).toBeEditable();
      await expect(page.getByLabel("PPV", { exact: true }), `${block} : saisie`).toBeEditable();
      await expect(section(page, block).getByRole("button", { name: "Éditer", exact: true })).toBeDisabled();
      await page.getByRole("button", { name: "Annuler", exact: true }).click();
    }

    // « Annuler »: nothing sent, nothing changed.
    await page.getByRole("button", { name: "Modifier", exact: true }).click();
    await page.getByLabel("PPV", { exact: true }).fill("1,00");
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    expect(puts, "Annuler : rien envoyé").toBe(0);
    await expectNumber(page, "PPV", ppv);

    // Wrong values: one message under each, nothing sent.
    await page.getByRole("button", { name: "Modifier", exact: true }).click();
    await page.getByLabel("PPV", { exact: true }).fill("douze");
    await page.getByLabel("Stock actuel", { exact: true }).fill("1,5");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Prix invalide (exemple : 12,50).")).toBeVisible();
    await expect(page.getByText("Nombre entier attendu (exemple : 12).")).toBeVisible();
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
      ["Codes", "Identifiants du produit"],
      ["Général", "Informations générales"],
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
