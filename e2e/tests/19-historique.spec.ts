/** « Historique des modifications » (owner), through the pages:
 *  - menu « Historique » (owner only): every change, newest first = GET /history; the imports of
 *    02-import are there (who, file);
 *  - setup: one product edited then put back, one observation added then deleted (API), so the
 *    spec works alone too; filters: type (Imports · Fiche produit · Observations), person, text,
 *    dates (today, a past month = nothing); a product's link opens its page; Excel = every line;
 *  - the product's « Historique » tab: its own lines;
 *  - an employee: no menu entry, /historique = 404 inside the layout, GET /history 403; his
 *    product tab works. Nothing can be deleted (no route for it). Serial. */
import type { Page } from "@playwright/test";

import { apiDelete, apiGet, apiPost, apiPut } from "../lib/api";
import { LOGGED_OUT, OWNER, loadState, saveState, sessionFile } from "../lib/auth";
import { type Row } from "../lib/checks";
import { expect, test } from "../lib/fixtures";
import { columnTexts, downloadXlsx, pageCall, setPeriod } from "../lib/ui";

test.describe.configure({ mode: "serial" });

// No « — » / « « »: Postgres unaccent changes them, the words still match the search.
const NOTE = "Note E2E historique 19 : à vendre avec le sirop.";
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const KIND = { import: "Import", product: "Fiche produit", note: "Observation" };
const kindOf = (r: Row) =>
  r.action.startsWith("import_") ? KIND.import : r.action.startsWith("note_") ? KIND.note : KIND.product;

/** Menu → « Historique », with the first page the page loads. */
async function openHistory(page: Page): Promise<Row> {
  const list = pageCall(page, "/history", { page: "1", kind: "all" });
  await page.goto("/rapport");
  await page.locator("aside").getByRole("link", { name: "Historique", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Historique des modifications", exact: true }),
  ).toBeVisible();
  return await list;
}

/** The lines drawn = the API page: person, type. */
async function expectRows(page: Page, data: Row[], what: string) {
  await expect(page.locator("tbody tr"), `${what}: lignes`).toHaveCount(data.length || 1);
  if (data.length === 0) {
    await expect(page.getByText("Aucune modification.")).toBeVisible();
    return;
  }
  expect(await columnTexts(page, "Personne"), `${what}: personnes`).toEqual(data.map((r) => r.user_name || "—"));
  expect(await columnTexts(page, "Type"), `${what}: types`).toEqual(data.map(kindOf));
}

test.describe("propriétaire", () => {
  test.use({ storageState: sessionFile("owner") });

  test("setup : une fiche modifiée puis remise, une observation ajoutée puis supprimée", async ({ page }) => {
    const product = (await apiGet(page, "/products", { sort_by: "units_sold_12m", sort_order: "desc", limit: "1" }))
      .data[0];
    const sheet = await apiGet(page, `/products/${product.id}`);
    const ppv = Number(((sheet.prices.ppv ?? 10) + 5).toFixed(2));
    await apiPut(page, `/products/${product.id}`, { ppv });
    await apiPut(page, `/products/${product.id}`, { ppv: null });
    const note = await apiPost(page, `/products/${product.id}/notes`, { text: NOTE }, {}, 201);
    await apiDelete(page, `/products/${product.id}/notes/${note.id}`, 204);
    saveState({ historyProduct: { id: product.id, name: product.product, ppv, before: sheet.prices.ppv } });
  });

  test("menu « Historique » : tout, le plus récent d'abord ; les imports de 02 ; rien à supprimer", async ({
    page,
  }) => {
    const got = await openHistory(page);
    expect(got.pagination.total, "des lignes").toBeGreaterThan(0);
    const dates = got.data.map((r: Row) => r.created_at);
    expect([...dates].sort().reverse(), "plus récent d'abord").toEqual(dates);
    await expectRows(page, got.data, "tout");

    const imports = await apiGet(page, "/history", { kind: "imports", export: "true" });
    for (const type of ["achat", "vente", "stock"]) {
      expect(
        imports.data.some(
          (r: Row) => r.action === "import_done" && r.details.type === type && r.user_name === OWNER.name,
        ),
        `import ${type} de 02 par le propriétaire`,
      ).toBe(true);
    }
    await expect(page.getByRole("button", { name: /Supprimer/ }), "rien ne s'efface").toHaveCount(0);
  });

  test("filtres : type, personne, texte, dates ; lien vers le produit ; Excel", async ({ page }) => {
    const p = loadState().historyProduct;
    await openHistory(page);

    // Type « Imports » / « Fiche produit » / « Observations ».
    for (const [label, kind, actions] of [
      ["Imports", "imports", ["import_done", "import_cancelled", "import_failed", "import_deleted"]],
      ["Fiche produit", "product", ["product_edited", "product_reverted"]],
      ["Observations", "notes", ["note_added", "note_deleted"]],
    ] as const) {
      const call = pageCall(page, "/history", { kind, page: "1" });
      await page.getByRole("region", { name: "Filtres" }).getByRole("button", { name: label, exact: true }).click();
      const got = await call;
      expect(got.pagination.total, `${label}: des lignes`).toBeGreaterThan(0);
      for (const r of got.data) expect(actions as readonly string[], `${label}: ${r.action}`).toContain(r.action);
      await expectRows(page, got.data, label);
      if (kind === "imports") {
        await expect(
          page.getByText(/^Import (Achats|Ventes|Stock) « Sobrus - /).first(),
          "phrase d'un import",
        ).toBeVisible();
      }
    }
    // « Fiche produit » of the setup: PPV before → after, then « (valeur importée) ».
    const edits = await apiGet(page, "/history", { kind: "product", search: p.name, export: "true" });
    expect(edits.data.map((r: Row) => r.action).slice(0, 2), "remise puis modification").toEqual([
      "product_reverted",
      "product_edited",
    ]);
    expect(edits.data[1].details, "PPV avant → après").toMatchObject({ field: "ppv", before: p.before, after: p.ppv });

    // Text: the observation (added, deleted).
    await page.getByRole("region", { name: "Filtres" }).getByRole("button", { name: "Tous", exact: true }).click();
    const found = pageCall(page, "/history", { search: NOTE });
    await page.getByPlaceholder("Produit, fichier, observation…").fill(NOTE);
    const notes = await found;
    expect(
      notes.data.map((r: Row) => r.action),
      "observation ajoutée puis supprimée",
    ).toEqual(["note_deleted", "note_added"]);
    await expect(page.getByText(`Observation ajoutée : « ${NOTE} »`)).toBeVisible();
    await expect(page.getByText(`Observation de ${OWNER.name} supprimée : « ${NOTE} »`)).toBeVisible();
    // Its product link → the product page.
    await page.locator("tbody tr").first().getByRole("link", { name: p.name, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: p.name, exact: true })).toBeVisible();

    // Person: the owner only.
    await openHistory(page);
    await page.getByRole("button", { name: /^Personne/ }).click();
    const mine = pageCall(page, "/history", { person: OWNER.name });
    await page.getByRole("button", { name: OWNER.name, exact: true }).click();
    const byOwner = await mine;
    for (const r of byOwner.data) expect(r.user_name, "personne").toBe(OWNER.name);
    await expectRows(page, byOwner.data, "propriétaire");

    // Dates: today (everything was done today), then a past month (nothing).
    const today = todayIso();
    const todayCall = pageCall(page, "/history", { date_from: today, date_to: today });
    await setPeriod(page, today, today);
    expect((await todayCall).pagination.total, "aujourd'hui").toBeGreaterThan(0);
    const pastCall = pageCall(page, "/history", { date_from: "2020-01-01", date_to: "2020-01-31" });
    await setPeriod(page, "2020-01-01", "2020-01-31");
    expect((await pastCall).pagination.total, "janvier 2020").toBe(0);
    await expect(page.getByText("Aucune modification.")).toBeVisible();

    // Excel: every line of the filters, French headers.
    await page.getByRole("button", { name: "Tout réinitialiser" }).click();
    const all = await apiGet(page, "/history", { export: "true" });
    const { filename, rows } = await downloadXlsx(page, () =>
      page.getByRole("button", { name: "Exporter Excel" }).click(),
    );
    expect(filename, "nom du fichier").toMatch(/^APCM - HISTORIQUE .+\.xlsx$/);
    expect(rows[0], "en-têtes").toEqual(["Date", "Personne", "Type", "Produit", "Détail"]);
    expect(rows.length - 1, "toutes les lignes").toBe(all.pagination.total);
    expect(
      rows.slice(1).map((r) => r[1]),
      "personnes",
    ).toEqual(all.data.map((r: Row) => r.user_name));
  });

  test("onglet « Historique » du produit : ses lignes (modification, remise, observation)", async ({ page }) => {
    const p = loadState().historyProduct;
    const got = pageCall(page, `/products/${p.id}/history`, { page: "1" });
    await page.goto(`/produits/${p.id}?tab=history`);
    const tab = await got;
    const mine = tab.data.filter((r: Row) => !r.action.startsWith("import_"));
    expect(mine.map((r: Row) => r.action).slice(0, 4), "ses lignes, plus récentes d'abord").toEqual([
      "note_deleted",
      "note_added",
      "product_reverted",
      "product_edited",
    ]);
    for (const r of mine) expect(r.medicament_id, "ce produit").toBe(p.id);
    // The imports that brought its lines (page 1 may be full of edits when 18-produits edited it too).
    const every = await apiGet(page, `/products/${p.id}/history`, { limit: "200" });
    expect(
      every.data.some((r: Row) => r.action === "import_done"),
      "les imports qui ont apporté ses lignes",
    ).toBe(true);
    await expect(page.getByRole("tab", { name: "Historique", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText(/^PPV : .+ → .+ \(valeur importée\)$/).first()).toBeVisible();
    await expect(page.getByText(`Observation ajoutée : « ${NOTE} »`)).toBeVisible();
  });
});

test.describe("employé", () => {
  test.use({ storageState: sessionFile("owner") });

  test("employé : pas de menu, /historique = 404 dans le cadre, GET /history refusé ; onglet produit visible", async ({
    page,
    browser,
  }) => {
    const p = loadState().historyProduct;
    const employee = { email: "employe.historique@pharmagest.ma", password: "EmployeHisto#2026" };
    const { member } = await apiPost(page, "/owner/employees", {
      full_name: "Employé Historique",
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
      await other.goto("/rapport");
      await expect(other.locator("aside").getByRole("link", { name: "Historique", exact: true })).toHaveCount(0);
      await other.goto("/historique");
      await expect(other.getByRole("heading", { level: 1, name: "Page introuvable" })).toBeVisible();
      const refused = await apiGet(other, "/history", {}, 403);
      expect(refused.code, "GET /history : propriétaire seulement").toBe("ownerOnly");
      const tab = pageCall(other, `/products/${p.id}/history`, { page: "1" });
      await other.goto(`/produits/${p.id}?tab=history`);
      expect((await tab).pagination.total, "onglet produit : ses lignes").toBeGreaterThan(0);
      await expect(other.getByText(`Observation ajoutée : « ${NOTE} »`)).toBeVisible();
    } finally {
      await ctx.close();
      await apiDelete(page, `/owner/employees/${member.id}`, 204);
    }
  });
});
