/** Produits (owner): every product of the pharmacy (stock file, sold or bought).
 *  List = oracle: page 1 + 2, the « Vendus 12 mois » dates (Stock page window), every
 *  sortable column (desc + asc), search, Pharmacie / Parapharmacie, Excel export; a barcode reader
 *  in the search field (exact code + Entrée = the sheet) and « Scanner / Rechercher un code barre ».
 *  Photos (scraped fixture, resources/tests/catalog/product-infos.json): found by PID, by a
 *  barcode the admin gives in the catalogue (setup), a dead address → the box icon.
 *  Product sheet (from the list): every case the oracle picked (photos, never bought, not in
 *  the stock file, stock only, negative stock) = oracle, on screen too: header (PID / catégorie /
 *  TVA, type + stock badges, tiles Emplacement / Code barre drawn / Observations), Général (5 prices,
 *  stock tiles, informations générales without PID / purchase prices, 5 latest lines, performance =
 *  the page dates + %); copy the barcode; header photo; « Codes » tab kept in the address, no
 *  breadcrumb, « Retour à la liste des produits »; a product of no pharmacy line → 404 inside the layout.
 *  One date picker for the page (toolbar under the tabs), the current year first.
 *  Statistiques = oracle for every product (current year), then the Ventes date picker (2 quick
 *  periods, typed dates) + « Copier » on the best seller: KPIs and % vs the period before (whole
 *  months: the months before; the year so far: the same dates a year before), 3 charts (the
 *  period's months, at least 12; a whole year = Jan → Dec; tooltips), « Détail mensuel »,
 *  « Historique » Tous / Ventes / Achats (colors), top suppliers + latest prices with « Voir tout »;
 *  no « Tendances ».
 *  « Traçabilité » (from « Voir tout »): the page dates (current year), then the test window: page
 *  1 + 2, sort by type, Achats, Ventes, search, « Tout réinitialiser » keeps the dates = oracle;
 *  dates without a line → the message, no details; list (type, date + hour, quantité) + every
 *  line's details (BL / ticket, prices, remise, TVA, total, import), 20 per page. « Voir tout le
 *  ticket / BL » = the whole ticket on Ventes / BL on Achats (exact number, period cleared, removable
 *  filter).
 *  No « Imprimer » button (owner, employee).
 *  « Codes »: PID / barcodes + « Copier », barcode drawn (no format / length blocks), « Scanner / Rechercher
 *  un code barre » (barcode, PID, unknown code, Échap / Annuler).
 *  Général: emplacement + date de péremption (file) with « Périmé » / < 30 j / < 90 j.
 *  « Observations »: add, the window at opening (click, scan), list badge, employee rights, delete;
 *  « Fermer » when there is none to read.
 *  « Modifier » (owner) on each block (« Identité », « Prix et marge », « Stock et réappro », « Identifiants du produit »): its
 *  values only, « Annuler » / « Enregistrer » next to it → « modifié », list and sheet show his values;
 *  a stock import keeps them; « Revenir à la valeur importée », « Annuler », min > max refused.
 *  Employee: the block's « Modifier » disabled + reason, PUT refused.
 *  An employee sees the list + a sheet; feature OFF → no menu entry, 404 inside the layout. */
import type { Locator, Page } from "@playwright/test";

import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "../lib/api";
import { LOGGED_OUT, OWNER, loadState, sessionFile } from "../lib/auth";
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
  pageSend,
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

/** List → type the PID → click the product: its id + the sheet and the statistics (current year)
 *  the page loads with it (« Statistiques » then opens without waiting). */
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

/** Short month names as the year table prints them (utils « Janv. » without its dot). */
const MONTHS_SHORT = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];
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

/** The hint next to an expiry date, as the page computes it from today (Alertes thresholds). */
function expiryHint(iso: string): string | null {
  const now = new Date();
  const [y, m, d] = iso.split("-").map(Number);
  const days = Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000,
  );
  return days < 0 ? "Périmé" : days < 30 ? "Moins de 30 jours" : days < 90 ? "Moins de 90 jours" : null;
}

/** ISO date `n` days from today (local day, like the page). */
function daysFromToday(n: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The value next to a label inside one block. */
const fieldIn = (scope: Locator, label: string) =>
  scope.locator(`xpath=.//dt[normalize-space()="${label}"]/following-sibling::dd[1]`);

/** The KPI tile labelled `label` in `scope` (« Observations » in the header is a button tile). */
const tileBox = (scope: Page | Locator, label: string) =>
  scope.locator(`xpath=.//*[contains(@class, 'rounded-2xl')][./div/span[normalize-space()="${label}"]]`);

/** The big value of the KPI tile labelled `label` in `scope` (« Code barre » is also a row of
 *  « Informations générales »: kpiValue would find both). */
const tile = (scope: Page | Locator, label: string) =>
  tileBox(scope, label).locator("span.font-mono.font-bold").first();

async function expectTile(scope: Page | Locator, label: string, want: number | null): Promise<void> {
  // 1st line: an edited stock value also shows « modifié · Valeur importée … » under it.
  const got = frNumber((await tile(scope, label).innerText()).split("\n")[0].replace(/unités/, ""));
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

/** % change shown by « Performance » (none when nothing the period before). */
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

test("produits: lecteur de code barre (recherche, n'importe où sur la page, sans Entrée, code inconnu), « Scanner / Rechercher un code barre »", async ({
  page,
}) => {
  const { product, barcode1 } = expected().products.barcode_setup;
  const search = page.getByPlaceholder("Nom, code-barres, PID, laboratoire…");
  const sheetShown = async () => {
    await expect(page.getByRole("heading", { level: 1, name: product, exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/produits\/\d+$/);
  };

  // The reader types the code + Entrée in the search field → that product's sheet.
  await open(page);
  await search.fill(barcode1);
  await search.press("Enter");
  await sheetShown();

  // An unknown code: the list stays, filtered by the text (nothing found), no page change.
  await page.getByRole("link", { name: "Retour à la liste des produits", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Produits", exact: true })).toBeVisible();
  const filtered = pageCall(page, "/products", { search: "0000000000000" });
  await search.fill("0000000000000");
  await search.press("Enter");
  expect((await filtered).pagination.total, "code inconnu : liste vide").toBe(0);
  await expect(page.getByText("Aucun produit trouvé")).toBeVisible();
  await expect(page).toHaveURL(/\/produits$/);

  // The big button on the list: the same window as on « Codes ».
  await page.getByRole("button", { name: "Scanner / Rechercher un code barre", exact: true }).click();
  const input = page.getByLabel("Code barre ou PID", { exact: true });
  await expect(input).toBeFocused();
  await input.fill(barcode1);
  await input.press("Enter");
  await sheetShown();

  // A reader anywhere on the page, no field clicked: fast keys + Entrée (list), fast keys without
  // Entrée (product page → another product), an unknown code → a message, the page stays.
  const [otherPid, other] = Object.entries<Row>(expected().products.sheets).find(
    ([, e]) => e.barcode1 && e.product !== product,
  ) as [string, Row];
  await page.getByRole("link", { name: "Retour à la liste des produits", exact: true }).click();
  await page.getByRole("heading", { level: 1, name: "Produits", exact: true }).click(); // no field focused
  await expect(page.getByText("Scannez un code barre à tout moment sur cette page")).toBeVisible();
  await page.keyboard.type(barcode1, { delay: 10 });
  await page.keyboard.press("Enter");
  await sheetShown();
  await page.getByRole("heading", { level: 1, name: product, exact: true }).click();
  await page.keyboard.type(other.barcode1, { delay: 10 }); // no Entrée: the pause ends the code
  await expect(page.getByRole("heading", { level: 1, name: other.product, exact: true })).toBeVisible();
  expect((await apiGet(page, "/products/lookup", { code: other.barcode1 })).id, otherPid).toBeTruthy();
  await page.getByRole("heading", { level: 1, name: other.product, exact: true }).click();
  await page.keyboard.type("0000000000000", { delay: 10 });
  await page.keyboard.press("Enter");
  await expect(page.getByText("Aucun produit avec le code 0000000000000 dans votre pharmacie.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: other.product, exact: true }), "page gardée").toBeVisible();
  // Typed slowly (a person, not a reader): nothing happens.
  await page.keyboard.type(barcode1, { delay: 120 });
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: other.product, exact: true }), "frappe lente").toBeVisible();
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
      section(other, "Identité").getByRole("button", { name: "Modifier", exact: true }),
      "employé : lecture seule",
    ).toBeDisabled();
    await expect(other.getByRole("button", { name: "Imprimer", exact: true }), "employé : pas d'imprimer").toHaveCount(
      0,
    );
    await expect(other.getByText("Seul le propriétaire peut modifier ce produit.").first()).toBeVisible();
    const refused = await apiPut(other, `/products/${got.data[0].id}`, { ppv: 1 }, 403);
    expect(refused.code, "PUT par un employé").toBe("ownerOnly");

    // « Voir tout le ticket / BL » follows his permissions: no « Achats » → disabled + why, on a purchase only.
    // On the Traçabilité product (it has purchases and sales, even with small files).
    await apiPut(page, `/owner/employees/${member.id}/permissions`, { permissions: { achats: false } });
    const traced = rows().find((r) => r.pid === expected().products.movements.pid) as Row;
    const tracedId = (await apiGet(other, "/products", { search: traced.pid })).data.find(
      (r: Row) => r.pid === traced.pid,
    ).id;
    await other.goto(`/produits/${tracedId}?tab=movements`);
    await expect(other.getByRole("tab", { name: "Traçabilité", exact: true })).toHaveAttribute("aria-selected", "true");
    const details = section(other, "Détails de la ligne");
    // The test window (the current year may have no line yet early in January).
    await setPeriod(other, testWindow().date_from, testWindow().date_to);
    await other.getByRole("button", { name: "Achats", exact: true }).click();
    await expect(details.getByRole("button", { name: "Voir tout le BL" })).toBeDisabled();
    await expect(details.getByText("Vous n'avez pas accès à cette page. Demandez au propriétaire.")).toBeVisible();
    await other.getByRole("button", { name: "Ventes", exact: true }).click();
    await expect(details.getByRole("button", { name: "Voir tout le ticket" })).toBeEnabled();
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

      // Header (kept calm): type + stock badges, PID, code barre. Catégorie, TVA, emplacement: the cards.
      const header = page.locator("main header");
      await expect(header).toContainText(`PID : ${pid}`);
      await expect(header).not.toContainText("Catégorie :");
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
      } else await expect(header.getByRole("img", { name: /^Code barre/ }), "pas de code barre").toHaveCount(0);

      // 6 tiles: prix de vente, prix d'achat moyen, marge unitaire (+ %), stock, ventes 12 mois, rythme.
      const { ppv, avg_pu, marge_pct } = e.prices;
      await expectTile(page, "Prix de vente (PPV)", ppv);
      await expectTile(page, "Prix d'achat moyen", avg_pu);
      await expectTile(page, "Marge unitaire", avg_pu == null ? null : ppv - avg_pu);
      if (marge_pct != null) {
        await expect(tileBox(page, "Marge unitaire")).toContainText(
          `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(marge_pct)} %`,
        );
      }
      await expectTile(page, "Ventes 12 mois", e.stock.units_sold_12m);
      await expect(tileBox(page, "Rythme de vente")).toContainText(
        new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
          e.stock.units_sold_12m / 12,
        ),
      );

      // Card « Stock et réappro » (Stock page rules): actuel, minimum, maximum (0 = the default from the sales).
      if (e.stock.current_stock == null) await expect(field(page, "Stock actuel")).toHaveText("Hors stock");
      else await expectNumber(page, "Stock actuel", e.stock.current_stock);
      for (const [label, value] of [
        ["Stock minimum", e.stock.stock_min],
        ["Stock maximum", e.stock.stock_max],
      ] as const) {
        if (value > 0) await expectNumber(page, label, value);
        else if (e.stock.units_sold_12m > 0) await expect(field(page, label), label).toContainText("par défaut");
      }
      // Emplacement + date de péremption (stock file), with its hint (Périmé / < 30 j / < 90 j).
      await expect(field(page, "Emplacement")).toHaveText(e.stock.zone || "Non disponible");
      if (!e.stock.expiry_date) await expect(field(page, "Date de péremption")).toHaveText("Non disponible");
      else {
        await expect(field(page, "Date de péremption")).toContainText(frDate(e.stock.expiry_date));
        const hint = expiryHint(e.stock.expiry_date);
        for (const label of ["Périmé", "Moins de 30 jours", "Moins de 90 jours"]) {
          await expect(field(page, "Date de péremption").getByText(label, { exact: true }), label).toHaveCount(
            label === hint ? 1 : 0,
          );
        }
      }

      // « Performance » = the page dates (current year first, in the toolbar) vs the period before.
      await expect(page.getByText("Ventes 30 jours", { exact: true }), "pas de tuile en double").toHaveCount(0);
      const year = expected().products.stats[pid].year;
      await expectDates(page, year.date_from, year.date_to);
      await expectPerformance(page, year);

      // Cards « Identité » / « Prix et marge »: as imported (« Non disponible » when none); Catégorie and TVA without
      // their rate; DCI, forme, statut, délai, lots: « À renseigner » (no source yet). PID: header and Codes only.
      const infos: [string, string][] = [
        ["Produit", e.product],
        ["Catégorie", withoutRate(e.category)],
        ["TVA", tvaShort(e.tva)],
        ["Code barre", e.barcode1 ?? "Non disponible"],
        ["Laboratoire", e.laboratoire ?? "Non disponible"],
      ];
      for (const [label, want] of infos) await expect(field(page, label), label).toHaveText(want);
      await expect(field(page, "PID"), "PID : pas dans la liste").toHaveCount(0);
      for (const label of ["DCI", "Forme", "Statut", "Délai grossiste", "Lots en stock"]) {
        await expect(field(page, label), label).toHaveText("À renseigner");
      }
      await expectNumber(page, "PPV", ppv);
      await expectNumber(page, "PPH", e.prices.pph);
      await expectNumber(page, "Prix d'achat moyen", avg_pu);
      const lastIn = e.last_purchase;
      if (!lastIn) await expect(field(page, "Dernier achat")).toHaveText("—");
      else {
        await expect(field(page, "Dernier achat")).toContainText(frDate(lastIn.date));
        if (lastIn.supplier) await expect(field(page, "Dernier achat")).toContainText(lastIn.supplier);
        await expect(field(page, "Dernière entrée")).toContainText(`${frDate(lastIn.date)} · +`);
      }

      // « Historique des ventes (par année) »: the Ventes lines only (no « Type »), every year.
      const salesCard = section(page, "Historique des ventes (par année)");
      const lines = historyLines(year.history, "Ventes");
      if (lines.length === 0) await expect(salesCard).toContainText("Aucune vente pour ce produit.");
      else {
        const years = salesCard.locator("table");
        await expect(years.locator("tbody tr"), "ventes : lignes").toHaveCount(lines.length);
        expect((await columnTexts(page, "Année", years)).map(Number), "ventes : années").toEqual(
          lines.map((l) => l.year),
        );
        await expect(years.getByRole("columnheader", { name: "Type", exact: true }), "pas de Type").toHaveCount(0);
        for (const [m, label] of MONTHS_SHORT.entries()) {
          const shown = (await columnTexts(page, label, years)).map((x) => frNumber(x) ?? 0);
          expect(shown, `ventes : ${label}`).toEqual(lines.map((l) => l.units[m]));
        }
        expect(
          (await columnTexts(page, "Total", years)).map((x) => frNumber(x) ?? 0),
          "ventes : total",
        ).toEqual(lines.map((l) => l.total));
        const amounts = (await columnTexts(page, "Montant (MAD)", years)).map(frNumber);
        amounts.forEach((v, i) =>
          expect(Math.abs((v ?? NaN) - lines[i].amount), `ventes : montant ${lines[i].year}`).toBeLessThanOrEqual(
            0.011,
          ),
        );
      }

      // Traçabilité récente: the 5 latest lines (its own table: the sales by year come first).
      const moves: Row[] = e.recent_movements;
      if (moves.length === 0) await expect(page.getByText("Aucun achat ni vente pour ce produit.")).toBeVisible();
      else {
        const recent = section(page, "Traçabilité récente").locator("table");
        expect(await columnTexts(page, "Type", recent), "types").toEqual(
          moves.map((m) => (m.kind === "achat" ? "Achat" : "Vente")),
        );
        expect(await columnTexts(page, "Référence", recent), "références").toEqual(moves.map((m) => m.document ?? "—"));
        expect((await columnTexts(page, "Quantité", recent)).map(frNumber), "quantités").toEqual(
          moves.map((m) => m.quantity),
        );
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

test("fiche produit: « Étiquette » et « Commander » : désactivés avec la raison, puis ouverts par l'administrateur (« Étiquette » : sa fenêtre)", async ({
  page,
  browser,
}) => {
  // A product with something to order (« Commander N », N = maximum − stock).
  const [pid] = Object.entries<Row>(expected().products.sheets).find(
    ([, s]) => s.stock.stock_max - Math.max(0, s.stock.current_stock ?? 0) > 0,
  ) as [string, Row];
  const header = page.locator("main header");
  await openSheet(page, pid);
  await expect(header.getByRole("button", { name: /^Étiquette/ })).toBeDisabled();
  await expect(header.getByRole("button", { name: /^Commander/ })).toBeDisabled();
  await expect(header.getByText("Accès pas encore activé : demandez-le à l'administrateur.")).toBeVisible();
  const ctx = await browser.newContext({ storageState: sessionFile("admin") });
  const admin = await ctx.newPage();
  const features = `/admin/pharmacies/${loadState().pharmacyId}/features`;
  await apiPut(admin, features, { features: { labels: true, orders: true } });
  try {
    await page.reload();
    // « Étiquette »: its window (preview, copies, « Imprimer »).
    await header.getByRole("button", { name: /^Étiquette/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Étiquette" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Imprimer" })).toBeEnabled();
    await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
    // « Commander N »: N boxes into today's order of its supplier.
    const added = pageSend(page, "POST", "/orders/lines", 201);
    await header.getByRole("button", { name: /^Commander/ }).click();
    await added;
    await expect(page.getByText(/ajoutée\(s\) à la commande du jour/).first()).toBeVisible();
  } finally {
    await apiPut(admin, features, { features: { labels: false, orders: false } });
    await ctx.close();
  }
});

test("fiche produit: pas de bouton « Imprimer »", async ({ page }) => {
  await openSheet(page, Object.keys(expected().products.sheets)[0]);
  await expect(page.getByRole("button", { name: "Modifier", exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Imprimer", exact: true })).toHaveCount(0);
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

test("fiche produit: onglet « Codes » (identifiants, copier, sans blocs format / longueur), gardé dans l'adresse, « Retour »", async ({
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

  // No more « Code barre 1 » / « Code barre 2 » blocks (format, longueur): only the identifiers.
  for (const title of ["Code barre 1", "Code barre 2"]) {
    await expect(page.getByRole("heading", { name: title, exact: true }), `bloc ${title}`).toHaveCount(0);
  }
  await expect(page.getByText("Longueur", { exact: true })).toHaveCount(0);

  // A barcode from the stock file: shown in the identifiers.
  const [otherPid, other] = Object.entries<Row>(expected().products.sheets).find(
    ([p, e]) => p !== pid && e.barcode1,
  ) as [string, Row];
  await openSheet(page, otherPid);
  await page.getByRole("tab", { name: "Codes", exact: true }).click();
  await expect(fieldIn(section(page, "Identifiants du produit"), "Code barre 1")).toContainText(other.barcode1);

  // The tab stays on reload; « Général » takes it out of the address.
  await page.reload();
  await expect(page.getByRole("tab", { name: "Codes", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Général", exact: true }).click();
  await expect(page).not.toHaveURL(/tab=/);
  // No breadcrumb (the top bar shows where we are): « Retour à la liste des produits », then the
  // browser's back button.
  await expect(page.locator("main").getByRole("link", { name: "Accueil", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Retour à la liste des produits", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Produits", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: other.product, exact: true })).toBeVisible();
  // The big button is on every tab: the list.
  await page.getByRole("tab", { name: "Traçabilité", exact: true }).click();
  await page.getByRole("link", { name: "Retour à la liste des produits", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Produits", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/produits$/);
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
  for (const name of ["General", "Estadísticas", "Trazabilidad", "Códigos"]) {
    await expect(page.getByRole("tab", { name, exact: true }), `onglet ${name}`).toBeVisible();
  }
  for (const title of [
    "Identidad",
    "Precio y margen",
    "Stock y reposición",
    "Historial de ventas (por año)",
    "Trazabilidad reciente",
    "Rendimiento",
  ]) {
    await expect(page.getByRole("heading", { name: title, exact: true }), title).toBeVisible();
  }
  await expect(page.getByText("Margen bruto", { exact: true })).toBeVisible();
  for (const label of ["Ventas", "Compras"]) {
    await expect(section(page, "Rendimiento").getByText(label, { exact: true }), label).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Editar", exact: true }), "« Editar » de cada bloque").toHaveCount(3);
  await expect(page.getByRole("link", { name: "Volver a la lista de productos", exact: true })).toBeVisible();
  await page.reload(); // the language is remembered
  await expect(page.getByRole("tab", { name: "Estadísticas", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Estadísticas", exact: true }).click();
  await expect(page.getByText("Cantidad vendida (total)", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir el calendario", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Trazabilidad", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Detalles de la línea", exact: true })).toBeVisible();
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

/** « Historique (par année) » lines of a filter: per year (newest first) the Ventes line, then the
 *  Achats line; a kind without any unit that year is left out. */
type HistoryLine = { year: number; kind: "Ventes" | "Achats"; units: number[]; total: number; amount: number };
function historyLines(history: Row[], filter: "Tous" | "Ventes" | "Achats"): HistoryLine[] {
  return history
    .flatMap((y): HistoryLine[] => [
      { year: y.year, kind: "Ventes", units: y.sold, total: y.total, amount: y.ca },
      { year: y.year, kind: "Achats", units: y.bought, total: y.bought_total, amount: y.spent },
    ])
    .filter((l) => (filter === "Tous" || l.kind === filter) && l.units.some((n) => n !== 0));
}

/** The 2 date fields of the page show `from` → `to`. */
async function expectDates(page: Page, from: string, to: string) {
  for (const [side, iso] of [
    ["Date début", from],
    ["Date fin", to],
  ] as const) {
    const [y, m, d] = iso.split("-");
    await expect(page.getByLabel(`${side} jour`, { exact: true }), `${side} jour`).toHaveValue(d);
    await expect(page.getByLabel(`${side} mois`, { exact: true }), `${side} mois`).toHaveValue(m);
    await expect(page.getByLabel(`${side} année`, { exact: true }), `${side} année`).toHaveValue(y);
  }
}
/** A number as « Copier » puts it for Excel: French style, no thousands space. */
const excel = (n: number | null, decimals: number) => (n == null ? "" : n.toFixed(decimals).replace(".", ","));

/** « Performance » (Général) for one period of the page: its dates, units sold / bought, % vs the
 *  period before (none when nothing then). */
async function expectPerformance(page: Page, s: Row): Promise<void> {
  const perf = section(page, "Performance");
  await expect(perf).toContainText(`(du ${frDate(s.date_from)} au ${frDate(s.date_to)})`);
  for (const [label, key] of [
    ["Ventes", "sold"],
    ["Achats", "bought"],
  ] as const) {
    await expectTile(perf, label, s.period[key]);
    const pill = perf
      .locator(`xpath=.//div[contains(@class, 'rounded-2xl')][./div/span[normalize-space()="${label}"]]`)
      .locator("span.rounded-full");
    const want = change(s.period[key], s.previous[key]);
    if (want == null) await expect(pill, `${label} : pas de %`).toHaveCount(0);
    else {
      expect(Math.abs((frNumber(await pill.innerText()) ?? NaN) - want), `${label} %`).toBeLessThanOrEqual(0.006);
      await expect(perf).toContainText(`vs du ${frDate(s.previous_from)} au ${frDate(s.previous_to)}`);
    }
  }
}

/** Statistiques tab for one period = the oracle, on screen. */
async function expectStats(page: Page, e: Row): Promise<void> {
  await expect(page.getByText(/^Du .+ au .+ · les % comparent/)).toHaveText(
    `Du ${frDate(e.date_from)} au ${frDate(e.date_to)} · les % comparent avec la période du ${frDate(e.previous_from)} au ${frDate(e.previous_to)}.`,
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

  // 3 charts over the period's months (at least 12): a bar a month, or 2 solid curves of 2 colors; the
  // last month's tooltip; a line says which months.
  const monthly: Row[] = e.monthly;
  const last = monthly[monthly.length - 1];
  await expect(
    page.getByText(`Graphiques et « Détail mensuel » : ${monthName(monthly[0].month)} → ${monthName(last.month)}`),
  ).toHaveText(
    `Graphiques et « Détail mensuel » : ${monthName(monthly[0].month)} → ${monthName(last.month)} (${monthly.length} mois).`,
  );
  for (const [title, keys] of [
    ["Ventes par mois", ["sold"]],
    ["Achats par mois", ["bought"]],
    ["Ventes vs Achats", ["sold", "bought"]],
  ] as const) {
    const chart = page.getByRole("img", { name: title, exact: true });
    if (keys.length === 1) {
      await expect(chart.locator("rect"), `${title} : ${monthly.length} barres`).toHaveCount(monthly.length);
    } else {
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
    // The date toolbar stays at the top (sticky): a quick period no longer scrolls the page up, so
    // bring the chart to the middle of the screen before pointing at its last month.
    await chart.evaluate((el) => el.scrollIntoView({ block: "center" }));
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

  // « Historique (par année) »: « Tous » (each year: Ventes light green, Achats light blue), then
  // « Ventes », « Achats »; a kind without any unit that year has no line. Back to « Tous ».
  const card = section(page, "Historique (par année)");
  for (const [filter, empty] of [
    ["Tous", "Aucun achat ni vente pour ce produit."],
    ["Ventes", "Aucune vente pour ce produit."],
    ["Achats", "Aucun achat pour ce produit."],
  ] as const) {
    if (filter !== "Tous") await card.getByRole("button", { name: filter, exact: true }).click();
    const lines = historyLines(e.history, filter);
    const years = card.locator("table");
    if (lines.length === 0) {
      await expect(card, `${filter} : vide`).toContainText(empty);
      continue;
    }
    await expect(years.locator("tbody tr"), `${filter} : lignes`).toHaveCount(lines.length);
    expect((await columnTexts(page, "Année", years)).map(Number), `${filter} : années`).toEqual(
      lines.map((l) => l.year),
    );
    expect(await columnTexts(page, "Type", years), `${filter} : types`).toEqual(lines.map((l) => l.kind));
    for (const [m, label] of MONTHS_SHORT.entries()) {
      const shown = (await columnTexts(page, label, years)).map((x) => frNumber(x) ?? 0);
      expect(shown, `${filter} : ${label}`).toEqual(lines.map((l) => l.units[m]));
    }
    expect(
      (await columnTexts(page, "Total", years)).map((x) => frNumber(x) ?? 0),
      `${filter} : total`,
    ).toEqual(lines.map((l) => l.total));
    const amounts = (await columnTexts(page, "Montant (MAD)", years)).map(frNumber);
    amounts.forEach((v, i) =>
      expect(Math.abs((v ?? NaN) - lines[i].amount), `${filter} : montant ${lines[i].year}`).toBeLessThanOrEqual(0.011),
    );
    // Colors: sales light green, purchases light blue.
    for (const [i, l] of lines.entries()) {
      await expect(years.locator("tbody tr").nth(i), `${filter} : couleur ${l.kind} ${l.year}`).toHaveClass(
        l.kind === "Ventes" ? /bg-success-subtle/ : /bg-info-subtle/,
      );
    }
  }
  await card.getByRole("button", { name: "Tous", exact: true }).click();

  // No « Tendances » any more.
  await expect(page.getByRole("heading", { name: "Tendances", exact: true })).toHaveCount(0);

  // « Top fournisseurs »: the 3 biggest + « Autres »; « Voir tout » = every supplier of the period.
  const all: Row[] = e.suppliers;
  const bought = all.reduce((sum, r) => sum + r.quantity, 0);
  const rest = all.slice(3).reduce((sum, r) => sum + r.quantity, 0);
  const suppliers: Row[] = [
    ...all.slice(0, 3),
    ...(all.length > 3
      ? [{ supplier: "Autres", quantity: rest, pct: bought > 0 ? Math.round((rest / bought) * 10_000) / 100 : null }]
      : []),
  ];
  const expectSuppliers = async (t: Locator, rows: Row[], what: string) => {
    expect(await columnTexts(page, "Fournisseur", t), `${what} : fournisseurs`).toEqual(rows.map((r) => r.supplier));
    expect((await columnTexts(page, "Quantité", t)).map(frNumber), `${what} : quantités`).toEqual(
      rows.map((r) => r.quantity),
    );
    const pcts = (await columnTexts(page, "% du total", t)).map(frNumber);
    pcts.forEach((v, i) =>
      expect(Math.abs((v ?? NaN) - rows[i].pct), `${what} : % du total`).toBeLessThanOrEqual(0.006),
    );
  };
  const top = section(page, "Top fournisseurs");
  const seeAll = (card: Locator, n: number) => card.getByRole("button", { name: `Voir tout (${n})`, exact: true });
  if (all.length === 0) {
    await expect(top.getByText("Aucun achat sur la période.")).toBeVisible();
    await expect(seeAll(top, 0), "rien à voir : grisé").toBeDisabled();
  } else {
    await expectSuppliers(top.locator("table"), suppliers, "top fournisseurs");
    await seeAll(top, all.length).click();
    const win = page.getByRole("dialog").filter({ hasText: "Tous les fournisseurs de la période" });
    await expectSuppliers(win.locator("table"), all, "voir tout : fournisseurs");
    await win.getByRole("button", { name: "Fermer", exact: true }).last().click();
    await expect(win).toHaveCount(0);
  }

  // « Derniers prix d'achat »: the 5 latest; « Voir tout » = each supplier's latest price, with its date.
  const prices: Row[] = e.last_prices;
  const lastPrices = section(page, "Derniers prix d'achat par fournisseur");
  const expectPrices = async (t: Locator, rows: Row[], what: string) => {
    expect(await columnTexts(page, "Fournisseur", t), `${what} : fournisseurs`).toEqual(rows.map((r) => r.supplier));
    const pus = (await columnTexts(page, "Prix unitaire", t)).map(frNumber);
    pus.forEach((v, i) =>
      expect(Math.abs((v ?? NaN) - rows[i].unit_price), `${what} : prix unitaire`).toBeLessThanOrEqual(0.006),
    );
  };
  if (prices.length === 0) {
    await expect(lastPrices.getByText("Aucun achat avec un prix.")).toBeVisible();
    await expect(seeAll(lastPrices, 0), "rien à voir : grisé").toBeDisabled();
  } else {
    await expectPrices(lastPrices.locator("table"), prices.slice(0, 5), "derniers prix");
    await seeAll(lastPrices, prices.length).click();
    const win = page.getByRole("dialog").filter({ hasText: "Dernier prix d'achat de chaque fournisseur" });
    await expectPrices(win.locator("table"), prices, "voir tout : prix");
    expect(await columnTexts(page, "Date", win.locator("table")), "voir tout : dates").toEqual(
      prices.map((r) => frDate(r.date)),
    );
    await win.getByRole("button", { name: "Fermer", exact: true }).last().click();
    await expect(win).toHaveCount(0);
  }
}

test("fiche produit: onglet « Statistiques » (année en cours) = oracle, chaque produit", async ({ page }) => {
  test.setTimeout(3 * 60_000); // 8 products, the whole Statistiques tab each
  const all = expected().products.stats;
  for (const pid of Object.keys(all)) {
    await test.step(pid, async () => {
      const e = all[pid].year;
      const { stats } = await openSheet(page, pid);
      expectSame(stats, e, `statistiques ${pid} (année en cours, chargées avec la fiche)`);
      await page.getByRole("tab", { name: "Statistiques", exact: true }).click();
      await expect(page).toHaveURL(/\?tab=stats$/);
      // The Ventes date picker, on the current year (1 January → today).
      await expectDates(page, e.date_from, e.date_to);
      await expectStats(page, e);
    });
  }
});

test("fiche produit: Statistiques, le sélecteur de dates de Ventes (périodes rapides, dates tapées), « Copier »", async ({
  page,
}) => {
  const pid = Object.keys(expected().products.stats)[0];
  const all = expected().products.stats[pid];
  const { id } = await openSheet(page, pid);
  await page.getByRole("tab", { name: "Statistiques", exact: true }).click();
  await expect(page.getByRole("button", { name: "30 jours", exact: true }), "plus de boutons 7 j / 30 j…").toHaveCount(
    0,
  );
  // No separate « Mois affichés »: the charts + « Détail mensuel » follow the dates at the top.
  await expect(page.getByRole("group", { name: "Mois affichés" })).toHaveCount(0);
  for (const [preset, key] of [
    ["Mois antérieur", "previous-month"],
    ["Année antérieure", "previous-year"],
  ] as const) {
    await test.step(preset, async () => {
      const e = all[key];
      const stats = pageCall(page, `/products/${id}/stats`, { date_from: e.date_from, date_to: e.date_to });
      await page.getByRole("button", { name: "Ouvrir le calendrier", exact: true }).click();
      await page.getByRole("button", { name: preset, exact: true }).click();
      expectSame(await stats, e, `statistiques ${preset}`);
      await expectDates(page, e.date_from, e.date_to);
      if (key === "previous-year") {
        // A whole year at the top = its 12 months, January → December, in the charts + « Détail mensuel ».
        const year = e.date_from.slice(0, 4);
        expect(
          (e.monthly as Row[]).map((m) => m.month),
          "année antérieure : janvier → décembre",
        ).toEqual(Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`));
      }
      await expectStats(page, e);
    });
  }
  await test.step("dates tapées", async () => {
    const e = all.custom;
    const stats = pageCall(page, `/products/${id}/stats`, { date_from: e.date_from, date_to: e.date_to });
    await setPeriod(page, e.date_from, e.date_to);
    expectSame(await stats, e, "statistiques dates tapées");
    await expectStats(page, e);
    // The same dates on « Général »: « Performance » follows; they stay when going back.
    await page.getByRole("tab", { name: "Général", exact: true }).click();
    await expectDates(page, e.date_from, e.date_to);
    await expectPerformance(page, e);
    await page.getByRole("tab", { name: "Statistiques", exact: true }).click();
    await expectDates(page, e.date_from, e.date_to);
  });
  await test.step("dates changées sur Général", async () => {
    const e = all["previous-year"];
    await page.getByRole("tab", { name: "Général", exact: true }).click();
    const stats = pageCall(page, `/products/${id}/stats`, { date_from: e.date_from, date_to: e.date_to });
    await page.getByRole("button", { name: "Ouvrir le calendrier", exact: true }).click();
    await page.getByRole("button", { name: "Année antérieure", exact: true }).click();
    expectSame(await stats, e, "statistiques depuis Général");
    await expectPerformance(page, e);
    await page.getByRole("tab", { name: "Statistiques", exact: true }).click();
    await expectDates(page, e.date_from, e.date_to);
    await expectStats(page, e);
    await setPeriod(page, all.custom.date_from, all.custom.date_to); // back for « Copier »
    await expect(page.getByText(/^Du .+ au .+ · les % comparent/)).toContainText(
      `Du ${frDate(all.custom.date_from)} au ${frDate(all.custom.date_to)}`,
    );
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

    // « Historique (par année) » copied the same way: what is shown (« Tous », then « Achats »).
    const card = section(page, "Historique (par année)");
    for (const filter of ["Tous", "Achats"] as const) {
      if (filter !== "Tous") await card.getByRole("button", { name: filter, exact: true }).click();
      await card.getByRole("button", { name: "Copier l'historique", exact: true }).click();
      const yearLines = [["Année", "Type", ...MONTHS_SHORT, "Total", "Montant (MAD)"].join("\t")].concat(
        historyLines(e.history, filter).map((l) =>
          [String(l.year), l.kind, ...l.units.map((n) => excel(n, 0)), excel(l.total, 0), excel(l.amount, 2)].join(
            "\t",
          ),
        ),
      );
      await expect
        .poll(async () =>
          (await page.evaluate(() => navigator.clipboard.readText())).replace(/\u2212/g, "-").split("\n"),
        )
        .toEqual(yearLines);
    }
  });
});

/** « Traçabilité »: the value next to `label` in « Détails de la ligne ». */
const detail = (page: Page, label: string) =>
  section(page, "Détails de la ligne").locator(`xpath=.//dt[normalize-space()="${label}"]/following-sibling::dd[1]`);

/** « Détails de la ligne » = the oracle's line (+ its import: date, owner, file). */
async function expectDetail(page: Page, m: Row, tva: string, what: string) {
  const money = async (label: string, want: number | null) => {
    if (want == null) await expect(detail(page, label), `${what}: ${label}`).toHaveText("—");
    else
      expect(
        Math.abs((frNumber(await detail(page, label).innerText()) ?? NaN) - want),
        `${what}: ${label}`,
      ).toBeLessThanOrEqual(0.011);
  };
  await expect(detail(page, "Type"), `${what}: type`).toHaveText(m.kind === "achat" ? "Achat" : "Vente");
  expect(frNumber(await detail(page, "Quantité").innerText()), `${what}: quantité`).toBe(m.quantity);
  await money("Prix unitaire", m.unit_price);
  if (m.kind === "achat") {
    await expect(detail(page, "Fournisseur"), `${what}: fournisseur`).toHaveText(m.party ?? "—");
    await expect(detail(page, "N° de BL"), `${what}: BL`).toHaveText(m.document ?? "—");
    await expect(detail(page, "Date du BL"), `${what}: date du BL`).toHaveText(frDate(m.date));
    await expect(detail(page, "Créée le"), `${what}: créée le`).toHaveText(
      m.created_at ? `${frDate(m.created_at.slice(0, 10))} ${m.created_at.slice(11, 16)}` : "—",
    );
    await money("Total ligne", m.total);
    for (const label of ["Date de péremption (lot)", "Stock min (fichier)", "Stock max (fichier)"]) {
      await expect(detail(page, label), `${what}: ${label} (vide dans le fichier)`).toHaveText("—");
    }
  } else {
    await expect(detail(page, "N° de transaction"), `${what}: ticket`).toHaveText(m.document ?? "—");
    await expect(detail(page, "Date"), `${what}: date`).toHaveText(frDate(m.date));
    await expect(detail(page, "Client"), `${what}: client`).toHaveText(m.party ?? "—");
    expect(frNumber(await detail(page, "Remise").innerText()), `${what}: remise`).toBe(m.discount ?? 0);
    await expect(detail(page, "TVA"), `${what}: TVA`).toHaveText(tva);
    await money("Total", m.total);
  }
  // The import that brought the line: by the owner (02-import), today, a Sobrus file of that kind.
  await expect(detail(page, "Importé par"), `${what}: importé par`).toHaveText(OWNER.name);
  await expect(detail(page, "Importé le"), `${what}: importé le`).toHaveText(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  await expect(detail(page, "Fichier"), `${what}: fichier`).toHaveText(
    new RegExp(`^Sobrus - ${m.kind === "achat" ? "Achats" : "Ventes"} `),
  );
}

test("fiche produit: onglet « Traçabilité » = oracle (liste, détails de chaque ligne, type, période, tri, recherche)", async ({
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
  /** The list = the oracle's page (type, date with the hour when known, quantité); the first line's
   *  details shown. */
  const expectRows = async (want: Row[], what: string) => {
    await expect(page.locator("tbody tr"), `${what}: lignes dessinées`).toHaveCount(want.length);
    expect(await columnTexts(page, "Type"), `${what}: types`).toEqual(
      want.map((m) => (m.kind === "achat" ? "Achat" : "Vente")),
    );
    expect(await columnTexts(page, "Date"), `${what}: dates`).toEqual(
      want.map((m) => (m.time ? `${frDate(m.date)} ${m.time}` : frDate(m.date))),
    );
    expect((await columnTexts(page, "Quantité")).map(frNumber), `${what}: quantités`).toEqual(
      want.map((m) => m.quantity),
    );
    if (want.length) {
      await expect(page.locator("tbody tr").first(), `${what}: 1re ligne choisie`).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expectDetail(page, want[0], tva, `${what}, 1re ligne`);
    }
  };
  /** No line in the dates: the message says which ones and where to change them; no details. */
  const expectNoLine = async (from: string, to: string, what: string) => {
    await expect(
      page.getByText(`Aucune ligne du ${frDate(from)} au ${frDate(to)} : changez les dates en haut.`, { exact: true }),
      what,
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Détails de la ligne", exact: true }), what).toHaveCount(0);
  };

  // « Voir tout » under « Traçabilité récente » opens the tab on the page dates (the current year
  // first; none early in January), 20 lines a page.
  let call = pageCall(page, path, { page: "1", kind: "all", order: "date", limit: "20", ...period(e.year) });
  await section(page, "Traçabilité récente").getByRole("button", { name: "Voir tout" }).click();
  await expect(page).toHaveURL(/\?tab=movements$/);
  await expect(page.getByRole("tab", { name: "Traçabilité", exact: true })).toHaveAttribute("aria-selected", "true");
  check(await call, e.year, "année en cours");
  await expectDates(page, e.year.date_from, e.year.date_to);
  if (e.year.total) await expectRows(e.year.page, "année en cours");
  else await expectNoLine(e.year.date_from, e.year.date_to, "année en cours : aucune ligne");
  await expect(page.locator("thead").getByText("Heure", { exact: true }), "l'heure est dans « Date »").toHaveCount(0);

  // The test window: every line of page 1 → its details (purchases and sales), then page 2.
  call = pageCall(page, path, { page: "1", kind: "all", ...period(w) });
  await setPeriod(page, w.date_from, w.date_to);
  check(await call, e.window, "période");
  await expectRows(e.window.page, "période");
  await expect(page.getByText(/20 \/ page/).first()).toBeVisible();
  const lines: Row[] = e.window.page;
  for (const [i, m] of lines.entries()) {
    await page.locator("tbody tr").nth(i).click();
    await expect(page.locator("tbody tr").nth(i), `ligne ${i + 1} choisie`).toHaveAttribute("aria-selected", "true");
    await expectDetail(page, m, tva, `ligne ${i + 1}`);
  }

  call = pageCall(page, path, { page: "2", ...period(w) });
  await page.getByRole("button", { name: "Page suivante" }).click();
  check(await call, e.window_page2, "page 2");
  await expectRows(e.window_page2.page, "page 2");
  // Other dates go back to page 1 (the current year, then the test window again).
  call = pageCall(page, path, { page: "1", ...period(e.year) });
  await setPeriod(page, e.year.date_from, e.year.date_to);
  check(await call, e.year, "autres dates : page 1");
  call = pageCall(page, path, { page: "1", ...period(w) });
  await setPeriod(page, w.date_from, w.date_to);
  check(await call, e.window, "période : page 1");

  // « Trier : Par type » = purchases first, then sales (like « Rastro »); in the same toolbar.
  const sort = page.getByRole("region", { name: "Filtres" }).getByRole("group", { name: "Trier" });
  call = pageCall(page, path, { order: "kind", page: "1", ...period(w) });
  await sort.getByRole("button", { name: "Par type", exact: true }).click();
  check(await call, e.by_kind, "par type");
  await expectRows(e.by_kind.page, "par type");
  call = pageCall(page, path, { order: "date", page: "1", ...period(w) });
  await sort.getByRole("button", { name: "Par date", exact: true }).click();
  await call;

  call = pageCall(page, path, { kind: "achat", page: "1", ...period(w) });
  await pickCategoryType(page, "Achats");
  check(await call, e.achats, "achats");
  await expectRows(e.achats.page, "achats");

  call = pageCall(page, path, { kind: "vente", ...period(w) });
  await pickCategoryType(page, "Ventes");
  check(await call, e.ventes_window, "ventes sur la période");
  await expectRows(e.ventes_window.page, "ventes sur la période");

  await pickCategoryType(page, "Tous");
  call = pageCall(page, path, { kind: "all", search: e.client, ...period(w) });
  await page.getByPlaceholder("Rechercher une référence, un client…").fill(e.client);
  check(await call, e.search, `recherche « ${e.client} »`);
  await expectRows(e.search.page, "recherche");

  // « Tout réinitialiser »: the search goes, the page dates stay.
  call = pageCall(page, path, { kind: "all", search: null, ...period(w) });
  await page.getByRole("button", { name: "Tout réinitialiser" }).click();
  check(await call, e.window, "tout réinitialisé");
  await expectDates(page, w.date_from, w.date_to);

  // Dates without any line (years before the files).
  const y = Number(w.date_from.slice(0, 4)) - 5;
  const [from, to] = [`${y}-01-01`, `${y}-01-31`];
  call = pageCall(page, path, { date_from: from, date_to: to });
  await setPeriod(page, from, to);
  expect((await call).pagination.total, "aucune ligne").toBe(0);
  await expectNoLine(from, to, "dates sans ligne");
});

test("fiche produit: « Voir tout le ticket / BL » = tout le ticket dans Ventes, tout le BL dans Achats (période retirée)", async ({
  page,
}) => {
  const e = expected().products.movements;
  const w = testWindow();
  const { id } = await openSheet(page, e.pid);
  await page.getByRole("tab", { name: "Traçabilité", exact: true }).click();

  // Its latest sale, with a period chosen: « Voir tout le ticket » removes the period.
  await pickCategoryType(page, "Ventes");
  let moves = pageCall(page, `/products/${id}/movements`, { kind: "vente", ...period(w) });
  await setPeriod(page, w.date_from, w.date_to);
  expect((await moves).data[0].document, "dernière vente").toBe(e.ticket.ref);
  const ventes = pageCall(page, "/ventes", { ref: e.ticket.ref, date_from: null, date_to: null });
  await page.locator("tbody tr").first().click();
  await section(page, "Détails de la ligne").getByRole("button", { name: "Voir tout le ticket", exact: true }).click();
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
  // Back on the product the dates are the current year again: the test window, with its latest purchase.
  await setPeriod(page, w.date_from, w.date_to);
  moves = pageCall(page, `/products/${id}/movements`, { kind: "achat", ...period(w) });
  await pickCategoryType(page, "Achats");
  expect((await moves).data[0].document, "dernier achat").toBe(e.bl.ref);
  const achats = pageCall(page, "/achats", { ref: e.bl.ref, date_from: null, date_to: null });
  await page.locator("tbody tr").first().click();
  await section(page, "Détails de la ligne").getByRole("button", { name: "Voir tout le BL", exact: true }).click();
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

test("fiche produit: date de péremption → « Périmé », « Moins de 30 jours », « Moins de 90 jours », rien après", async ({
  page,
}) => {
  const pid = Object.keys(expected().products.sheets)[0];
  const { id } = await openSheet(page, pid);
  try {
    for (const [days, hint] of [
      [-3, "Périmé"],
      [10, "Moins de 30 jours"],
      [60, "Moins de 90 jours"],
      [200, null],
    ] as const) {
      const iso = daysFromToday(days);
      await apiPut(page, `/products/${id}`, { expiry_date: iso }); // setup: the owner's date
      await page.reload();
      await expect(field(page, "Date de péremption")).toContainText(frDate(iso));
      for (const label of ["Périmé", "Moins de 30 jours", "Moins de 90 jours"]) {
        await expect(
          field(page, "Date de péremption").getByText(label, { exact: true }),
          `${days} j : ${label}`,
        ).toHaveCount(label === hint ? 1 : 0);
      }
    }
  } finally {
    await apiPut(page, `/products/${id}`, { expiry_date: null });
  }
});

test("fiche produit: « Observations » (ajout, fenêtre à l'ouverture, au scan, liste, employé, suppression)", async ({
  page,
  browser,
}) => {
  const [pid, e] = Object.entries<Row>(expected().products.sheets).find(([, x]) => x.barcode1) as [string, Row];
  const { id } = await openSheet(page, pid);
  const win = page.getByRole("dialog").filter({ hasText: "Observations sur ce produit" });
  const strip = page.locator("main header").getByRole("button", { name: /^Observations/ });
  await expect(win, "aucune observation : pas de fenêtre").toHaveCount(0);
  await expect(strip, "aucune : pas de nombre").toHaveText("Observations");

  // The owner adds one from the strip under the title.
  await strip.click();
  await expect(win.getByText("Aucune observation pour ce produit.")).toBeVisible();
  // Nothing to read: « Fermer », not « J'ai lu » (the window's X is « Fermer » too).
  await expect(win.getByRole("button", { name: "J'ai lu", exact: true })).toHaveCount(0);
  await expect(win.getByRole("button", { name: "Fermer", exact: true })).toHaveCount(2);
  const ownerNote = "À vendre avec la crème E2E (même passage).";
  await win.getByLabel("Ajouter une observation", { exact: true }).fill(ownerNote);
  const added = pageSend(page, "POST", `/products/${id}/notes`, 201);
  await win.getByRole("button", { name: "Enregistrer l'observation", exact: true }).click();
  expectSame(await added, { text: ownerNote, author: OWNER.name, can_delete: true }, "observation ajoutée");
  await expect(win.getByRole("heading", { name: "Observations sur ce produit (1)", exact: true })).toBeVisible();
  await expect(win.getByText(ownerNote)).toBeVisible();
  await expect(win.getByText(new RegExp(`^par ${OWNER.name} · `))).toBeVisible();
  await win.getByRole("button", { name: "J'ai lu", exact: true }).click();
  await expect(win).toHaveCount(0);
  await expect(strip.getByText("1", { exact: true }), "1 observation").toBeVisible();

  // Opening the product again: the window comes by itself, once (switching tabs does not reopen it).
  const notes = pageCall(page, `/products/${id}/notes`);
  await page.reload();
  expectSame(await notes, [{ text: ownerNote, author: OWNER.name }], "GET observations");
  await expect(win.getByText(ownerNote)).toBeVisible();
  await win.getByRole("button", { name: "J'ai lu", exact: true }).click();
  await page.getByRole("tab", { name: "Codes", exact: true }).click();
  await page.getByRole("tab", { name: "Général", exact: true }).click();
  await expect(win, "pas rouverte").toHaveCount(0);

  // The list shows it; a scan from the list opens the product with its window.
  await page.getByRole("link", { name: "Retour à la liste des produits", exact: true }).click();
  const found = pageCall(page, "/products", { search: pid });
  await page.getByPlaceholder("Nom, code-barres, PID, laboratoire…").fill(pid);
  expect((await found).data.find((r: Row) => r.pid === pid).notes, "liste : 1 observation").toBe(1);
  await expect(page.locator("tbody").getByText("1 obs.", { exact: true })).toBeVisible();
  await page.getByRole("heading", { level: 1, name: "Produits", exact: true }).click();
  await page.keyboard.type(e.barcode1, { delay: 10 });
  await page.keyboard.press("Enter");
  await expect(win.getByText(ownerNote), "ouverte au scan").toBeVisible();
  await win.getByRole("button", { name: "J'ai lu", exact: true }).click();

  // An employee sees it, adds his own; deletes only his own (the owner's: no button, API 403).
  const employee = { email: "employe.observations@pharmagest.ma", password: "EmployeObs#2026" };
  const { member } = await apiPost(page, "/owner/employees", {
    full_name: "Employé Observations",
    ...employee,
    role: "employee",
    pharmacy_id: loadState().pharmacyId,
  });
  const ctx = await browser.newContext({ storageState: LOGGED_OUT });
  try {
    const other = await ctx.newPage();
    await other.goto("/login");
    await other.locator('input[type="email"]').fill(employee.email);
    await other.locator('input[autocomplete="current-password"]').fill(employee.password);
    await other.locator('button[type="submit"]').click();
    await expect(other).not.toHaveURL(/\/login/);
    await other.goto(`/produits/${id}`);
    const otherWin = other.getByRole("dialog").filter({ hasText: "Observations sur ce produit" });
    await expect(otherWin.getByText(ownerNote), "l'employé la voit à l'ouverture").toBeVisible();
    const ownerItem = otherWin.locator("li").filter({ hasText: ownerNote });
    await expect(ownerItem.getByRole("button", { name: "Supprimer" }), "pas la sienne").toHaveCount(0);
    const empNote = "Demander l'ordonnance (E2E employé).";
    await otherWin.getByLabel("Ajouter une observation", { exact: true }).fill(empNote);
    const empAdded = pageSend(other, "POST", `/products/${id}/notes`, 201);
    await otherWin.getByRole("button", { name: "Enregistrer l'observation", exact: true }).click();
    expectSame(
      await empAdded,
      { text: empNote, author: "Employé Observations", can_delete: true },
      "observation employé",
    );
    const ownerId = (await apiGet(other, `/products/${id}/notes`)).find((n: Row) => n.text === ownerNote).id;
    const refused = (await apiDelete(other, `/products/${id}/notes/${ownerId}`, 403)) as Row;
    expect(refused.code, "employé : pas celle du propriétaire").toBe("noteNotYours");
    const empItem = otherWin.locator("li").filter({ hasText: empNote });
    await empItem.getByRole("button", { name: "Supprimer", exact: true }).click();
    const gone = pageSend(other, "DELETE", new RegExp(`/v1/products/${id}/notes/\\d+$`), 204);
    await empItem.getByRole("button", { name: "Oui, supprimer", exact: true }).click();
    await gone;
    await expect(otherWin.getByText(empNote)).toHaveCount(0);
  } finally {
    await ctx.close();
    await apiDelete(page, `/owner/employees/${member.id}`, 204);
  }

  // The owner deletes his: nothing left, no window, no badge.
  await page.reload();
  const ownerItem = win.locator("li").filter({ hasText: ownerNote });
  await ownerItem.getByRole("button", { name: "Supprimer", exact: true }).click();
  const deleted = pageSend(page, "DELETE", new RegExp(`/v1/products/${id}/notes/\\d+$`), 204);
  await ownerItem.getByRole("button", { name: "Oui, supprimer", exact: true }).click();
  await deleted;
  await expect(win.getByText("Aucune observation pour ce produit.")).toBeVisible();
  await win.getByRole("button", { name: "Fermer", exact: true }).last().click();
  await expect(win).toHaveCount(0);
  await expect(strip, "aucune : pas de nombre").toHaveText("Observations");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: e.product, exact: true })).toBeVisible();
  await expect(win, "plus de fenêtre").toHaveCount(0);
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
      label: "Emplacement",
      tab: "Général",
      typed: "PLACARD E2E 7",
      field: "zone",
      sent: "PLACARD E2E 7",
      imported: e.stock.zone,
    },
    {
      label: "Date de péremption",
      tab: "Général",
      typed: "31/12/2030",
      field: "expiry_date",
      sent: "2030-12-31",
      imported: e.stock.expiry_date,
    },
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

/** « Général »: the card of each editable value (each card has its own « Modifier »). */
const CARD: Record<string, string> = {
  product: "Identité",
  laboratoire: "Identité",
  category: "Identité",
  zone: "Identité",
  barcode1: "Identité",
  ppv: "Prix et marge",
  tva: "Prix et marge",
  current_stock: "Stock et réappro",
  stock_min: "Stock et réappro",
  stock_max: "Stock et réappro",
  expiry_date: "Stock et réappro",
};

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

    // One block at a time: its « Modifier », its values, its « Enregistrer » → only its changed values sent.
    const saveBlock = async (tab: "Général" | "Codes", title: string) => {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      const block = section(page, title);
      await block.getByRole("button", { name: "Modifier", exact: true }).click();
      await expect(page.getByText("Ces valeurs comptent seulement pour votre pharmacie")).toBeVisible();
      // The type (Pharmacie / Parapharmacie) stays the catalogue's: no switch for it.
      await expect(page.getByRole("button", { name: "Parapharmacie", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Pharmacie", exact: true })).toHaveCount(0);
      const fields = plan.filter((x) => x.tab === tab && (tab === "Codes" || CARD[x.field] === title));
      for (const f of fields) await page.getByLabel(f.label, { exact: true }).fill(f.typed);
      const put = page.waitForResponse((r) => r.url().endsWith(`/v1/products/${id}`) && r.request().method() === "PUT");
      await block.getByRole("button", { name: "Enregistrer", exact: true }).click();
      const res = await put;
      expect(res.status(), `PUT /products/{id} (${title})`).toBe(200);
      expect(res.request().postDataJSON(), `${title} : seuls ses champs changés`).toEqual(
        Object.fromEntries(fields.map((f) => [f.field, f.sent])),
      );
      await expect(
        block.getByRole("button", { name: "Modifier", exact: true }),
        "fin de la modification",
      ).toBeVisible();
      return res;
    };
    await saveBlock("Général", "Identité");
    await saveBlock("Général", "Prix et marge");
    await saveBlock("Général", "Stock et réappro");
    const res = await saveBlock("Codes", "Identifiants du produit");
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
        stock: { current_stock: 12, stock_min: 3, stock_max: 9, zone: "PLACARD E2E 7", expiry_date: "2030-12-31" },
        imported: Object.fromEntries(plan.map((f) => [f.field, f.imported])),
      },
      "fiche après Enregistrer",
    );
    await expect(page.getByText("Fiche enregistrée").first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: `${e.product} (pharmacie)`, exact: true })).toBeVisible();
    await expect(page.getByText("modifié", { exact: true }), "« modifié » sur « Codes »").toHaveCount(2);
    await page.getByRole("tab", { name: "Général", exact: true }).click();
    // 10 values + « Code barre » (= code barre 1); the tiles and the header show his PPV / name too.
    await expect(page.getByText("modifié", { exact: true }), "« modifié » sur « Général »").toHaveCount(11);
    await expect(field(page, "Emplacement")).toContainText("PLACARD E2E 7");
    await expect(field(page, "Date de péremption")).toContainText(frDate("2030-12-31"));
    await expectNumber(page, "PPV", ppv);
    await expect(field(page, "PPV")).toContainText("Valeur importée :");
    await expectTile(page, "Prix de vente (PPV)", ppv);
    await expect(field(page, "Code barre")).toContainText("3760000000082");
    await expect(page.locator("main header").getByText("3760000000082", { exact: true })).toBeVisible();

    // The Stock page shows his minimum / maximum.
    await page.goto("/stock");
    await page.getByPlaceholder("Nom, code-barres, PID…").fill(pid);
    const stockCells = page.locator("tbody tr").filter({ hasText: e.product }).first().locator("td");
    await expect(stockCells.nth(3), "Stock : minimum modifié").toHaveText("3");
    await expect(stockCells.nth(4), "Stock : maximum modifié").toHaveText("9");

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

    // « Modifier » of a block opens its values only; the other blocks wait (one at a time).
    const infos = section(page, "Prix et marge");
    const stock = section(page, "Stock et réappro");
    await infos.getByRole("button", { name: "Modifier", exact: true }).click();
    await expect(page.getByLabel("PPV", { exact: true }), "Prix : saisie").toBeEditable();
    await expect(page.getByLabel("Stock actuel", { exact: true }), "Stock : pas en saisie").toHaveCount(0);
    await expect(stock.getByRole("button", { name: "Modifier", exact: true }), "un bloc à la fois").toBeDisabled();
    await page.getByRole("tab", { name: "Codes", exact: true }).click();
    const codes = section(page, "Identifiants du produit");
    await expect(codes.getByRole("button", { name: "Modifier", exact: true }), "un bloc à la fois").toBeDisabled();
    await expect(page.getByLabel("Code barre 1", { exact: true }), "Codes : pas en saisie").toHaveCount(0);
    await page.getByRole("tab", { name: "Général", exact: true }).click();
    await infos.getByRole("button", { name: "Annuler", exact: true }).click();
    await expect(infos.getByRole("button", { name: "Modifier", exact: true })).toBeEnabled();

    // « Annuler »: nothing sent, nothing changed.
    await infos.getByRole("button", { name: "Modifier", exact: true }).click();
    await page.getByLabel("PPV", { exact: true }).fill("1,00");
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    expect(puts, "Annuler : rien envoyé").toBe(0);
    await expectNumber(page, "PPV", ppv);

    // Wrong values: one message under each, nothing sent.
    await infos.getByRole("button", { name: "Modifier", exact: true }).click();
    await page.getByLabel("PPV", { exact: true }).fill("douze");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Prix invalide (exemple : 12,50).")).toBeVisible();
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    await stock.getByRole("button", { name: "Modifier", exact: true }).click();
    await page.getByLabel("Stock actuel", { exact: true }).fill("1,5");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Nombre entier attendu (exemple : 12).")).toBeVisible();
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    // Minimum above maximum (checked once the other values are right).
    await stock.getByRole("button", { name: "Modifier", exact: true }).click();
    await page.getByLabel("Stock minimum", { exact: true }).fill("50");
    await page.getByLabel("Stock maximum", { exact: true }).fill("10");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Le stock minimum ne peut pas dépasser le stock maximum.")).toBeVisible();
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    // A date that does not exist.
    await stock.getByRole("button", { name: "Modifier", exact: true }).click();
    await page.getByLabel("Date de péremption", { exact: true }).fill("31/02/2030");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Date invalide (exemple : 31/03/2027).")).toBeVisible();
    // ... or picked in the calendar: « Année suivante », then the 15th of the month shown.
    await page.getByRole("button", { name: "Date de péremption : choisir dans le calendrier", exact: true }).click();
    await page.getByRole("button", { name: "Année suivante", exact: true }).click();
    const now = new Date();
    const day = new Date(now.getFullYear() + 1, now.getMonth(), 15);
    const dayName = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(day);
    await page.getByRole("button", { name: new RegExp(dayName) }).click();
    await expect(page.getByLabel("Date de péremption", { exact: true }), "date choisie").toHaveValue(
      `15/${String(day.getMonth() + 1).padStart(2, "0")}/${day.getFullYear()}`,
    );
    expect(puts, "valeurs fausses : rien envoyé").toBe(0);
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
    const refused = await apiPut(page, `/products/${id}`, { stock_min: 50, stock_max: 10 }, 400);
    expect(refused.code, "min > max côté serveur").toBe("stockMinAboveMax");

    // « Revenir à la valeur importée » on every edited value → the oracle's sheet again.
    for (const [tab, block] of [
      ["Codes", "Identifiants du produit"],
      ["Général", "Identité"],
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
    const stockBack = (await apiGet(page, "/stats/stock-abcd")).products.find((p: Row) => p.pid === pid);
    expect([stockBack.stock_min, stockBack.stock_max], "Stock : la règle à nouveau").toEqual([
      e.stock.stock_min,
      e.stock.stock_max,
    ]);
    const back = await apiGet(page, `/products/${id}`);
    expectSame(back, e, "fiche revenue aux valeurs importées");
    expect(back.imported, "plus rien de modifié").toEqual({});
  });
});
