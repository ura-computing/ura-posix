/** Produits spéciaux → Comptabilité. The owner excludes 1 product, 1 BL (found
 *  by a product it holds) and 1 supplier from the UI; every search / detail /
 *  list / POST answer is checked field by field (oracle: expected.exclusions).
 *  Then Comptabilité (include_non_declared absent = exclusions on) must drop every
 *  product they touch, while its « produits spéciaux » checkbox and the Rapport
 *  still show everything. Last test reintegrates all three from the UI.
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

const scenario = (): Row => expected().exclusions;

/** Open /produits-speciaux (its 3 lists load on mount) and pick a tab. */
async function openPs(page: Page, tab?: "Bons de livraison" | "Fournisseurs"): Promise<void> {
  await page.goto("/produits-speciaux");
  await expect(page.getByRole("heading", { level: 1, name: "Produits spéciaux", exact: true })).toBeVisible();
  if (tab) await page.getByRole("button", { name: tab, exact: true }).click();
}


test.afterAll(async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: sessionFile("owner") });
  const page = await ctx.newPage();
  const ids = (await apiGet<Row[]>(page, "/special-products/")).map((r) => r.medicament_id);
  const refs = (await apiGet<Row[]>(page, "/bl-exclusions/")).map((r) => r.delivery_ref);
  const sups = (await apiGet<Row[]>(page, "/supplier-exclusions/")).map((r) => r.supplier);
  if (ids.length) await apiPost(page, "/special-products/reintegrate", { medicament_ids: ids });
  if (refs.length) await apiPost(page, "/bl-exclusions/reintegrate", { delivery_refs: refs });
  if (sups.length) await apiPost(page, "/supplier-exclusions/reintegrate", { suppliers: sups });
  await ctx.close();
});


test("exclure un produit : recherche → choix → exclure", async ({ page }) => {
  const x = scenario().special;
  const list0 = pageCall(page, "/special-products/");
  await openPs(page);
  expect(await list0, "aucun produit exclu au départ").toEqual([]);

  await page.getByRole("button", { name: "Exclure des produits", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const suggest = pageCall(page, "/special-products/suggestions", { q: x.query });
  await dialog.getByRole("textbox").fill(x.query);
  const found = await suggest;
  expectSame(found, x.suggestions, `suggestions « ${x.query} »`);
  await dialog.getByRole("button", { name: new RegExp(`^${x.product}`) }).click();

  const posted = pageSend(page, "POST", "/special-products/", 201);
  const list1 = pageCall(page, "/special-products/");
  await dialog.getByRole("button", { name: "Exclure des produits (1)", exact: true }).click();
  const item = { medicament_id: found[0].id, pid: x.pid, product: x.product, category: x.category };
  const res = await posted;
  expectSame(res, { inserted: 1, already_special: 0, products: [item] }, "POST special-products");
  const list = await list1;
  expectSame(list, [item], "produits exclus");
  expect(list[0].created_at, "created_at").toMatch(/^\d{4}-\d{2}-\d{2}T/);
  await expect(page.getByRole("cell", { name: x.product })).toBeVisible();

  // An excluded product is no longer suggested.
  expect(await apiGet(page, "/special-products/suggestions", { q: x.query }), "suggestions après exclusion").toEqual([]);
});


test("exclure un BL trouvé par un de ses produits", async ({ page }) => {
  const x = scenario().bl;
  const list0 = pageCall(page, "/bl-exclusions/");
  await openPs(page, "Bons de livraison");
  expect(await list0, "aucun BL exclu au départ").toEqual([]);

  await page.getByRole("button", { name: "Exclure un BL", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const search = pageCall(page, "/bl-exclusions/search", { q: x.query });
  await dialog.getByRole("textbox").fill(x.query);
  const found = await search;
  expectSameSet(found, x.search, (r) => r.delivery_ref, `BL contenant « ${x.query} »`);
  const dates = found.map((r: Row) => r.delivery_date);
  expect(dates, "BL du plus récent au plus ancien").toEqual([...dates].sort().reverse());

  const detail = pageCall(page, "/bl-exclusions/detail", { delivery_ref: x.ref });
  await dialog.getByRole("button", { name: new RegExp(`^${x.ref}`) }).click();
  const { lines, ...head } = x.detail;
  const d = await detail;
  expectSame(d, head, `détail du BL ${x.ref}`);
  expectSameSet(d.lines, lines, (r) => r.pid, `lignes du BL ${x.ref}`);

  await dialog.getByLabel("Note (optionnelle)").fill(NOTE_BL);
  const posted = pageSend(page, "POST", "/bl-exclusions/", 201);
  const list1 = pageCall(page, "/bl-exclusions/");
  await dialog.getByRole("button", { name: "Exclure ce BL", exact: true }).click();
  const item = { ...head, notes: NOTE_BL };
  expectSame(await posted, { excluded: 1, already_excluded: 0, item }, "POST bl-exclusions");
  expectSame(await list1, [item], "BL exclus");
  await expect(page.getByRole("cell", { name: x.ref, exact: true })).toBeVisible();

  // Search by reference: the same BL, now flagged.
  expectSame(await apiGet(page, "/bl-exclusions/search", { q: x.ref }),
    x.search_by_ref.map((r: Row) => ({ ...r, already_excluded: true })), `BL « ${x.ref} » après exclusion`);
});


test("exclure un fournisseur", async ({ page }) => {
  const x = scenario().supplier;
  const list0 = pageCall(page, "/supplier-exclusions/");
  await openPs(page, "Fournisseurs");
  expect(await list0, "aucun fournisseur exclu au départ").toEqual([]);

  await page.getByRole("button", { name: "Exclure un fournisseur", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const search = pageCall(page, "/supplier-exclusions/search", { q: x.query });
  await dialog.getByRole("textbox").fill(x.query);
  expectSame(await search, x.search, `fournisseurs « ${x.query} »`);
  await dialog.getByRole("button", { name: new RegExp(`^${x.name}`) }).click();

  await dialog.getByLabel("Note (optionnelle)").fill(NOTE_SUP);
  const posted = pageSend(page, "POST", "/supplier-exclusions/", 201);
  const list1 = pageCall(page, "/supplier-exclusions/");
  await dialog.getByRole("button", { name: "Exclure ce fournisseur", exact: true }).click();
  const { already_excluded: _a, ...totals } = x.search[0];
  const item = { ...totals, notes: NOTE_SUP };
  expectSame(await posted, { excluded: 1, already_excluded: 0, item }, "POST supplier-exclusions");
  expectSame(await list1, [item], "fournisseurs exclus");
  await expect(page.getByRole("cell", { name: x.name, exact: true })).toBeVisible();

  // Several results come ordered by purchase total; the excluded one is flagged.
  expectSame(await apiGet(page, "/supplier-exclusions/search", { q: "grossiste" }), x.search_grossiste, "fournisseurs « grossiste »");
  expectSame(await apiGet(page, "/supplier-exclusions/search", { q: x.query }),
    [{ ...x.search[0], already_excluded: true }], `fournisseurs « ${x.query} » après exclusion`);
});


test("comptabilité : les 3 exclusions retirent leurs produits (KPI + journal)", async ({ page }) => {
  const x = scenario();
  const w = testWindow();
  const gone = new Set<string>(x.excluded_pids);
  await page.goto("/comptabilite");
  await expect(page.getByRole("heading", { level: 1, name: "Comptabilité", exact: true })).toBeVisible();

  const ledger = pageCall(page, "/ventes", { ...period(w), page: "1", limit: "25", include_non_declared: "false" });
  for (const [i, { ct, label }] of CATEGORY_TYPES.entries()) {
    await test.step(label, async () => {
      const stats = pageCall(page, "/stats", { ...period(w), category_type: ct, include_non_declared: null });
      if (i === 0) await setPeriod(page, w.date_from, w.date_to);
      else await pickCategoryType(page, label);
      checkStats(await stats, ct, x.stats[ct]);
    });
  }
  checkLedgerPage("ventes", await ledger, subsetSummary("ventes", (r) => !gone.has(r.pid)), 1, 25);

  await test.step("case « produits spéciaux » : tout revient", async () => {
    const stats = pageCall(page, "/stats", { ...period(w), category_type: "parapharmacie", include_non_declared: "true" });
    const full = pageCall(page, "/ventes", { ...period(w), page: "1", limit: "25", include_non_declared: null });
    await page.getByRole("checkbox", { name: "Inclure les produits spéciaux dans les KPI" }).check();
    checkStats(await stats, "parapharmacie");
    checkLedgerPage("ventes", await full, expected().ventes_list, 1, 25);
  });

  await test.step("rapport : exclusions ignorées", async () => {
    checkStats(await apiGet(page, "/stats", { ...period(w), category_type: "all", include_non_declared: true }), "all");
  });
});


test("réintégrer produit, BL et fournisseur → comptabilité complète", async ({ page }) => {
  const x = scenario();
  const list0 = pageCall<Row[]>(page, "/special-products/");
  await openPs(page);
  const id = (await list0)[0].medicament_id;

  await test.step("produit (dialogue « Réintégrer des produits »)", async () => {
    await page.getByRole("button", { name: "Réintégrer des produits", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: new RegExp(`^${x.special.product}`) }).click();
    const posted = pageSend(page, "POST", "/special-products/reintegrate");
    const list = pageCall(page, "/special-products/");
    await dialog.getByRole("button", { name: "Réintégrer (1)", exact: true }).click();
    expectSame(await posted, { reintegrated: 1, not_special: 0, medicament_ids: [id] }, "POST special-products/reintegrate");
    expect(await list, "produits exclus").toEqual([]);
  });

  await test.step("BL (bouton de la ligne)", async () => {
    await page.getByRole("button", { name: "Bons de livraison", exact: true }).click();
    const posted = pageSend(page, "POST", "/bl-exclusions/reintegrate");
    const list = pageCall(page, "/bl-exclusions/");
    await page.getByRole("button", { name: "Réintégrer", exact: true }).click();
    expectSame(await posted, { reintegrated: 1, not_excluded: 0, delivery_refs: [x.bl.ref] }, "POST bl-exclusions/reintegrate");
    expect(await list, "BL exclus").toEqual([]);
  });

  await test.step("fournisseur (bouton de la ligne)", async () => {
    await page.getByRole("button", { name: "Fournisseurs", exact: true }).click();
    const posted = pageSend(page, "POST", "/supplier-exclusions/reintegrate");
    const list = pageCall(page, "/supplier-exclusions/");
    await page.getByRole("button", { name: "Réintégrer", exact: true }).click();
    expectSame(await posted, { reintegrated: 1, not_excluded: 0, suppliers: [x.supplier.name] }, "POST supplier-exclusions/reintegrate");
    expect(await list, "fournisseurs exclus").toEqual([]);
  });

  checkStats(await apiGet(page, "/stats", { ...period(testWindow()), category_type: "all" }), "all");
});
