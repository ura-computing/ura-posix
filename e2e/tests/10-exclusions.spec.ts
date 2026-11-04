/** Produits spéciaux → Comptabilité, one tab per kind, each = its search + ONE click « Exclure » +
 *  its list: 1 product (« Annuler » in the message, then again), 1 BL (found by a product it holds,
 *  « Fournisseur » filter, « Voir le contenu »), 1 supplier, and 1 product on one of its BLs
 *  (« Voir ses BL », « Fournisseur », tick one); a note on each excluded line. Every search / detail / list / POST
 *  answer is checked field by field (oracle: expected.exclusions). Then Comptabilité
 *  (include_non_declared=false = exclusions on) must drop every product the first three touch and
 *  that BL line's purchase, while its « produits spéciaux » checkbox and the Rapport still show
 *  everything. Last test: « Réintégrer » on each tab's line.
 *  Serial: each test needs the one before. afterAll cleans up if one fails. */
import type { Page } from "@playwright/test";

import { apiGet, apiPost } from "../lib/api";
import { sessionFile } from "../lib/auth";
import { CATEGORY_TYPES, checkLedgerPage, checkStats, subsetSummary, type Row } from "../lib/checks";
import { expectSame, expectSameSet } from "../lib/diff";
import { expected, testWindow } from "../lib/expected";
import { expect, test } from "../lib/fixtures";
import { pageCall, pageSend, period, pickCategoryType, setPeriod } from "../lib/ui";

test.use({ storageState: sessionFile("owner") });
test.describe.configure({ mode: "serial" });

const NOTE_BL = "E2E : BL de transfert";
const NOTE_SUP = "E2E : fournisseur exceptionnel";
const NOTE_LINE = "E2E : ce produit, ce BL seulement";
const NOTE_PRODUCT = "E2E : produit offert";

const scenario = (): Row => expected().exclusions;

type Tab = "Produits" | "Bons de livraison" | "Produit sur un BL" | "Fournisseurs";
const PRODUCTS = "/special-products/suggestions";
const BLS = "/bl-exclusions/search";
const SUPPLIERS = "/supplier-exclusions/search";

/** The open tab's search: type `q`; resolves with its answer (`path`). */
async function search(page: Page, path: string, q: string): Promise<Row[]> {
  const answer = pageCall<Row[]>(page, path, { q });
  await page.getByRole("searchbox").fill(q);
  return answer;
}

/** A found product / BL / supplier: its row in the list found (« Produits », « Bons de livraison », « Fournisseurs »). */
const found = (page: Page, group: string, text: string) =>
  page.getByRole("list", { name: group, exact: true }).getByRole("listitem").filter({ hasText: text }).first();

/** Its line in the tab's « 2. … exclus ». */
const excludedRow = (page: Page, text: string) => page.getByRole("row").filter({ hasText: text }).first();

/** « Ajouter une note » on an excluded line: type, Entrée → its PUT. */
async function addNote(page: Page, text: string, note: string, path: string): Promise<void> {
  const saved = pageSend(page, "PUT", path, 204);
  await excludedRow(page, text).getByRole("button", { name: "Ajouter une note", exact: true }).click();
  await excludedRow(page, text).getByRole("textbox", { name: "Note", exact: true }).fill(note);
  await page.keyboard.press("Enter");
  await saved;
  await expect(excludedRow(page, text)).toContainText(note);
}

/** Open /produits-speciaux (its 4 lists load on mount) on a tab. */
async function openPs(page: Page, tab: Tab = "Produits"): Promise<void> {
  await page.goto("/produits-speciaux");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Produits spéciaux",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("tab", { name: tab, exact: true }).click();
}

test.afterAll(async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: sessionFile("owner") });
  const page = await ctx.newPage();
  const ids = (await apiGet<Row[]>(page, "/special-products/")).map((r) => r.medicament_id);
  const refs = (await apiGet<Row[]>(page, "/bl-exclusions/")).map((r) => r.delivery_ref);
  const sups = (await apiGet<Row[]>(page, "/supplier-exclusions/")).map((r) => r.supplier);
  const lineIds = (await apiGet<Row[]>(page, "/bl-line-exclusions/")).map((r) => r.id);
  if (ids.length)
    await apiPost(page, "/special-products/reintegrate", {
      medicament_ids: ids,
    });
  if (refs.length) await apiPost(page, "/bl-exclusions/reintegrate", { delivery_refs: refs });
  if (sups.length)
    await apiPost(page, "/supplier-exclusions/reintegrate", {
      suppliers: sups,
    });
  if (lineIds.length) await apiPost(page, "/bl-line-exclusions/reintegrate", { ids: lineIds });
  await ctx.close();
});

test("exclure un produit : une recherche, un clic ; « Annuler » ; une note", async ({ page }) => {
  const x = scenario().special;
  const list0 = pageCall(page, "/special-products/");
  await openPs(page);
  expect(await list0, "aucun produit exclu au départ").toEqual([]);
  await expect(page.getByText("Rien n'est exclu ici", { exact: true })).toBeVisible();

  const products = await search(page, PRODUCTS, x.query);
  expectSame(products, x.suggestions, `produits « ${x.query} »`);
  const item = { medicament_id: products[0].id, pid: x.pid, product: x.product, category: x.category };

  // One click: excluded at once.
  let posted = pageSend(page, "POST", "/special-products/", 201);
  let list = pageCall(page, "/special-products/");
  await found(page, "Produits", x.product).getByRole("button", { name: "Exclure", exact: true }).click();
  expectSame(await posted, { inserted: 1, already_special: 0, products: [item] }, "POST special-products");
  expectSame(await list, [item], "produits exclus");
  const toast = page.locator("[data-sonner-toast]").filter({ hasText: `« ${x.product} » retiré de la Comptabilité` });
  await expect(toast).toBeVisible();
  await expect(found(page, "Produits", x.product), "plus proposé une fois exclu").toHaveCount(0);

  // « Annuler » in the message: back at once…
  const undone = pageSend(page, "POST", "/special-products/reintegrate");
  list = pageCall(page, "/special-products/");
  await toast.getByRole("button", { name: "Annuler", exact: true }).click();
  expectSame(await undone, { reintegrated: 1, not_special: 0, medicament_ids: [item.medicament_id] }, "Annuler");
  expect(await list, "plus rien d'exclu").toEqual([]);

  // … then excluded again for the next tests.
  await expect(found(page, "Produits", x.product)).toBeVisible();
  posted = pageSend(page, "POST", "/special-products/", 201);
  await found(page, "Produits", x.product).getByRole("button", { name: "Exclure", exact: true }).click();
  await posted;
  await expect(excludedRow(page, x.product)).toContainText(x.pid);
  await addNote(page, x.product, NOTE_PRODUCT, "/special-products/note");
  const [withNote] = await apiGet<Row[]>(page, "/special-products/");
  expectSame(withNote, { ...item, notes: NOTE_PRODUCT }, "produit exclu + sa note");
});

test("exclure un BL trouvé par un de ses produits (filtre fournisseur, contenu) + une note", async ({ page }) => {
  const x = scenario().bl;
  const list0 = pageCall(page, "/bl-exclusions/");
  await openPs(page, "Bons de livraison");
  expect(await list0, "aucun BL exclu au départ").toEqual([]);

  const bls = await search(page, BLS, x.query);
  expectSameSet(bls, x.search, (r) => r.delivery_ref, `BL contenant « ${x.query} »`);
  const dates = bls.map((r: Row) => r.delivery_date);
  expect(dates, "BL du plus récent au plus ancien").toEqual([...dates].sort().reverse());
  const group = page.getByRole("list", { name: "Bons de livraison", exact: true });
  // « Fournisseur » (when the BLs found come from several): only that supplier's BLs stay.
  if (new Set(bls.map((r: Row) => r.supplier)).size > 1) {
    await page.getByRole("button", { name: /^Fournisseur/ }).click();
    await page.getByRole("button", { name: x.detail.supplier, exact: true }).click();
    const kept = bls.filter((r: Row) => r.supplier === x.detail.supplier).length;
    await expect(group.getByRole("listitem"), `BL de ${x.detail.supplier}`).toHaveCount(kept);
  }

  // « Contenu »: its lines.
  const detail = pageCall(page, "/bl-exclusions/detail", { delivery_ref: x.ref });
  await found(page, "Bons de livraison", x.ref).getByRole("button", { name: "Voir le contenu", exact: true }).click();
  const { lines, ...head } = x.detail;
  const d = await detail;
  expectSame(d, head, `détail du BL ${x.ref}`);
  expectSameSet(d.lines, lines, (r) => r.pid, `lignes du BL ${x.ref}`, {
    repeats: true,
  }); // a BL may list a product twice (G1)

  const posted = pageSend(page, "POST", "/bl-exclusions/", 201);
  const list1 = pageCall(page, "/bl-exclusions/");
  await found(page, "Bons de livraison", x.ref).getByRole("button", { name: "Exclure", exact: true }).click();
  const item = { ...head, notes: null };
  expectSame(await posted, { excluded: 1, already_excluded: 0, item }, "POST bl-exclusions");
  expectSame(await list1, [item], "BL exclus");
  await addNote(page, x.ref, NOTE_BL, "/bl-exclusions/note");
  expectSame(await apiGet(page, "/bl-exclusions/"), [{ ...head, notes: NOTE_BL }], "BL exclu + sa note");

  // Search by its reference: the same BL, now « déjà exclu », no button.
  const again = await search(page, BLS, x.ref);
  expectSame(
    again,
    x.search_by_ref.map((r: Row) => ({ ...r, already_excluded: true })),
    `BL « ${x.ref} » après exclusion`,
  );
  await expect(found(page, "Bons de livraison", x.ref)).toContainText("déjà exclu");
  await expect(found(page, "Bons de livraison", x.ref).getByRole("button", { name: "Exclure" })).toHaveCount(0);
});

test("exclure un fournisseur + une note", async ({ page }) => {
  const x = scenario().supplier;
  const list0 = pageCall(page, "/supplier-exclusions/");
  await openPs(page, "Fournisseurs");
  expect(await list0, "aucun fournisseur exclu au départ").toEqual([]);

  const suppliers = await search(page, SUPPLIERS, x.query);
  expectSame(suppliers, x.search, `fournisseurs « ${x.query} »`);
  const posted = pageSend(page, "POST", "/supplier-exclusions/", 201);
  const list1 = pageCall(page, "/supplier-exclusions/");
  await found(page, "Fournisseurs", x.name).getByRole("button", { name: "Exclure", exact: true }).click();
  const { already_excluded: _a, ...totals } = x.search[0];
  const item = { ...totals, notes: null };
  expectSame(await posted, { excluded: 1, already_excluded: 0, item }, "POST supplier-exclusions");
  expectSame(await list1, [item], "fournisseurs exclus");
  await addNote(page, x.name, NOTE_SUP, "/supplier-exclusions/note");
  expectSame(
    await apiGet(page, "/supplier-exclusions/"),
    [{ ...item, notes: NOTE_SUP }],
    "fournisseur exclu + sa note",
  );

  // « grossiste »: several suppliers (ordered by purchase total), each shown; the excluded one
  // comes back « déjà exclu », without button.
  const gros = await search(page, SUPPLIERS, "grossiste");
  expectSame(gros, x.search_grossiste, "fournisseurs « grossiste »");
  for (const s of gros) await expect(found(page, "Fournisseurs", s.supplier)).toBeVisible();
  // Same words again: the page answers from its cache (fresh), so the check reads the API.
  await page.getByRole("searchbox").fill(x.query);
  const after = await apiGet<Row[]>(page, SUPPLIERS, { q: x.query });
  expectSame(after, [{ ...x.search[0], already_excluded: true }], `fournisseurs « ${x.query} » après`);
  await expect(found(page, "Fournisseurs", x.name)).toContainText("déjà exclu");
});

test("exclure un produit sur certains BL : « Ses BL », filtre fournisseur, cocher = exclu", async ({ page }) => {
  const x = scenario().bl_line;
  const list0 = pageCall(page, "/bl-line-exclusions/");
  await openPs(page, "Produit sur un BL");
  expect(await list0, "aucun au départ").toEqual([]);

  const products = await search(page, PRODUCTS, x.query);
  const med = products.find((r) => r.pid === x.pid) as Row;
  expect(med, `« ${x.query} » trouve le produit`).toBeTruthy();
  const lines = pageCall(page, "/bl-line-exclusions/lines", { medicament_id: String(med.id) });
  const row = found(page, "Produits", x.product);
  await row.getByRole("button", { name: "Voir ses BL", exact: true }).click();

  // Every BL it was bought on, newest first, one checkbox each.
  const got = await lines;
  expectSame(got, { medicament_id: med.id, pid: x.pid, product: x.product }, "produit");
  expectSameSet(got.lines, x.lines, (r) => r.delivery_ref, `BL de ${x.product}`);
  const dates = got.lines.map((r: Row) => r.delivery_date);
  expect(dates, "BL du plus récent au plus ancien").toEqual([...dates].sort().reverse());
  await expect(row.getByRole("checkbox"), "une case par BL").toHaveCount(x.lines.length);

  // « Fournisseur »: only that supplier's BLs; tick the one to leave out = excluded at once.
  await row.getByRole("button", { name: /^Fournisseur/ }).click();
  // Its options open on top of the page (never cut by the row).
  await page.locator('[data-list="Fournisseur"]').getByRole("button", { name: x.supplier, exact: true }).click();
  const ofSupplier = x.lines.filter((l: Row) => l.supplier === x.supplier).length;
  await expect(row.getByRole("checkbox"), `BL de ${x.supplier}`).toHaveCount(ofSupplier);
  const posted = pageSend(page, "POST", "/bl-line-exclusions/", 201);
  const list1 = pageCall(page, "/bl-line-exclusions/");
  await row.getByRole("checkbox", { name: x.ref, exact: true }).click();
  const res = await posted;
  expectSame(res, { excluded: 1, already_excluded: 0 }, "POST bl-line-exclusions");
  expect(res.ids, "son id (« Annuler »)").toHaveLength(1);
  const item = { ...x.excluded, id: res.ids[0], medicament_id: med.id, notes: null };
  const list = await list1;
  expectSame(list, [item], "produits exclus d'un BL");
  expect(list[0].created_at, "created_at").toMatch(/^\d{4}-\d{2}-\d{2}T/);
  await expect(row.getByRole("checkbox", { name: x.ref, exact: true }), "cochée = exclue").toBeChecked();
  await addNote(page, `BL ${x.ref}`, NOTE_LINE, "/bl-line-exclusions/note");
  expectSame(await apiGet(page, "/bl-line-exclusions/"), [{ ...item, notes: NOTE_LINE }], "+ sa note");
});

test("comptabilité : les 4 exclusions retirent leurs produits / leur ligne (KPI + journal)", async ({ page }) => {
  const x = scenario();
  const w = testWindow();
  const gone = new Set<string>(x.excluded_pids);
  await page.goto("/comptabilite");
  await expect(page.getByRole("heading", { level: 1, name: "Comptabilité", exact: true })).toBeVisible();

  const ledger = pageCall(page, "/ventes", {
    ...period(w),
    page: "1",
    limit: "25",
    include_non_declared: "false",
  });
  for (const [i, { ct, label }] of CATEGORY_TYPES.entries()) {
    await test.step(label, async () => {
      const stats = pageCall(page, "/stats", {
        ...period(w),
        category_type: ct,
        include_non_declared: "false",
      });
      if (i === 0) await setPeriod(page, w.date_from, w.date_to);
      else await pickCategoryType(page, label);
      checkStats(await stats, ct, x.stats[ct]);
    });
  }
  checkLedgerPage(
    "ventes",
    await ledger,
    subsetSummary("ventes", (r) => !gone.has(r.pid)),
    1,
    25,
  );

  await test.step("case « produits spéciaux » : tout revient", async () => {
    const stats = pageCall(page, "/stats", {
      ...period(w),
      category_type: "parapharmacie",
      include_non_declared: "true",
    });
    const full = pageCall(page, "/ventes", {
      ...period(w),
      page: "1",
      limit: "25",
      include_non_declared: "true",
    });
    await page
      .getByRole("checkbox", {
        name: "Inclure les produits spéciaux dans les KPI",
      })
      .check();
    checkStats(await stats, "parapharmacie");
    checkLedgerPage("ventes", await full, expected().ventes_list, 1, 25);
  });

  await test.step("rapport : exclusions ignorées", async () => {
    const stats = pageCall(page, "/stats", {
      ...period(w),
      category_type: "all",
    });
    await page.getByRole("link", { name: "Tableau de bord", exact: true }).click(); // sidebar: the period stays
    checkStats(await stats, "all");
  });
});

test("réintégrer : « Réintégrer » sur la ligne de chaque onglet → comptabilité complète", async ({ page }) => {
  const x = scenario();
  const list0 = pageCall<Row[]>(page, "/special-products/");
  await openPs(page);
  const id = (await list0)[0].medicament_id;

  const reintegrate = async (tab: Tab, text: string, path: string, want: Row, what: string, list: string) => {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    const posted = pageSend(page, "POST", path);
    await excludedRow(page, text).getByRole("button", { name: "Réintégrer", exact: true }).click();
    expectSame(await posted, want, what);
    // The tab's own reading of the list may land after the click: ask the API.
    await expect.poll(() => apiGet<Row[]>(page, list), { message: `${what} : liste` }).toEqual([]);
    await expect(page.getByText("Rien n'est exclu ici", { exact: true }), `${what} : plus rien`).toBeVisible();
  };
  await reintegrate(
    "Produits",
    x.special.product,
    "/special-products/reintegrate",
    { reintegrated: 1, not_special: 0, medicament_ids: [id] },
    "produit",
    "/special-products/",
  );
  await reintegrate(
    "Bons de livraison",
    x.bl.ref,
    "/bl-exclusions/reintegrate",
    { reintegrated: 1, not_excluded: 0, delivery_refs: [x.bl.ref] },
    "BL",
    "/bl-exclusions/",
  );
  await reintegrate(
    "Fournisseurs",
    x.supplier.name,
    "/supplier-exclusions/reintegrate",
    { reintegrated: 1, not_excluded: 0, suppliers: [x.supplier.name] },
    "fournisseur",
    "/supplier-exclusions/",
  );
  await reintegrate(
    "Produit sur un BL",
    `BL ${x.bl_line.ref}`,
    "/bl-line-exclusions/reintegrate",
    { reintegrated: 1, not_excluded: 0 },
    "produit sur un BL",
    "/bl-line-exclusions/",
  );

  // Numbers back: Comptabilité (no exclusion left) = the full oracle.
  const stats = pageCall(page, "/stats", {
    ...period(testWindow()),
    category_type: "all",
    include_non_declared: "false",
  });
  await page.goto("/comptabilite");
  await setPeriod(page, testWindow().date_from, testWindow().date_to);
  checkStats(await stats, "all");
});
