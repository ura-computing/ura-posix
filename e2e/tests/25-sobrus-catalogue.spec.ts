/** Sobrus « Clôture de caisse » (Comptabilité) and the admin's « Importer les produits depuis Sobrus » (Catalogue),
 *  against the fake Sobrus (e2e/fake-sobrus/server.py: its closing comes from the date alone, its product list = the
 *  stock file's products + SOB-E2E-1…3). The owner of the E2E pharmacy connects Sobrus (API: setup), then:
 *  - Comptabilité, before: « Sobrus n'est pas connecté » + « Connexion Sobrus »; after a run: one line per day = the
 *    fake's report, the day's details (payment ways, credit customer), « Exporter la clôture »; an account without
 *    access → the warning;
 *  - Catalogue (admin): the tiles filter the list; the import shows its popup on every admin page (« Voir le détail »,
 *    « Arrêter »); done → new products added, empty fields filled (DCI, galenic form on the product page), the owner
 *    does not see it; refused account → `sobrusNoAccess`; « Gestion des imports » → tab « Produits Sobrus ».
 *  Serial: each step needs the one before. */
import type { Page } from "@playwright/test";

import { apiDelete, apiGet, apiPost, apiPut } from "../lib/api";
import { loadState, sessionFile } from "../lib/auth";
import { expect, test } from "../lib/fixtures";
import { downloadXlsx, frNumber } from "../lib/ui";

test.describe.configure({ mode: "serial" });

const FAKE = "http://127.0.0.1:19100";
const SOBRUS = { email: "pharmacie@sobrus.e2e", password: "SobrusE2e#2026" };
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = new Date();
const FROM = iso(new Date(today.getFullYear(), today.getMonth(), 1));
const TO = iso(today);
const MONTH = TO.slice(0, 7);

/** The fake's closing of one day (fake-sobrus/server.py `closing_day`): null on Sunday. */
function closingDay(day: string): { invoices: number; total: number; paid: number; credit: number; returns: number; net: number } | null {
  const d = new Date(`${day}T00:00:00`);
  if (d.getDay() === 0) return null;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const invoices = d.getDate() + 10;
  const total = r2(invoices * 100.5);
  const credit = r2(total * 0.2);
  const returns = d.getDate() % 5 === 0 ? 12 : 0;
  return { invoices, total, paid: r2(total - credit), credit, returns, net: r2(total - returns) };
}
const DAYS: string[] = [];
for (let d = new Date(`${FROM}T00:00:00`); iso(d) <= TO; d.setDate(d.getDate() + 1)) {
  if (closingDay(iso(d))) DAYS.push(iso(d));
}

async function control(page: Page, body: Record<string, unknown>): Promise<void> {
  const res = await page.request.post(`${FAKE}/__control`, { data: body });
  expect(res.status(), "fake Sobrus control").toBe(200);
}

/** The pharmacy's Sobrus run is over. */
async function ownerRunEnded(page: Page): Promise<void> {
  await expect
    .poll(async () => (await apiGet(page, "/sobrus/connection")).active_run, { timeout: 5 * 60_000, intervals: [1000] })
    .toBeNull();
}

/** The admin's product import is over: its last try. */
async function importEnded(page: Page): Promise<{ status: string; error_code: string | null; lines_added: number }> {
  let last: { status: string; error_code: string | null; lines_added: number } | null = null;
  await expect
    .poll(
      async () => {
        const { runs } = await apiGet(page, "/admin/catalog/sobrus-products");
        last = runs.at(-1)?.run ?? null;
        return last && !["queued", "running"].includes(last.status);
      },
      { timeout: 5 * 60_000, intervals: [1000] },
    )
    .toBe(true);
  return last!;
}

const closingSection = (page: Page) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name: "Clôture de caisse (Sobrus)" }) });

test.describe("propriétaire", () => {
  test.use({ storageState: sessionFile("owner") });

  test("clôture de caisse : pas connecté → « Connexion Sobrus »", async ({ page }) => {
    await page.goto("/comptabilite");
    const block = closingSection(page);
    await expect(block.getByText("Sobrus n'est pas connecté", { exact: true })).toBeVisible();
    await block.getByRole("link", { name: "Connexion Sobrus", exact: true }).click();
    await expect(page).toHaveURL(/\/sobrus$/);
  });

  test("clôture de caisse : chaque jour = Sobrus, le détail d'un jour, Excel", async ({ page }) => {
    test.setTimeout(6 * 60_000);
    await apiPut(page, "/sobrus/connection", { ...SOBRUS, consent: true });
    await ownerRunEnded(page);
    await apiPost(page, "/sobrus/runs", { mode: "range", date_from: FROM, date_to: TO }, {}, 201);
    await ownerRunEnded(page);

    const month = await apiGet(page, "/accounting/cash-closings", { month: MONTH });
    expect(month.connected && !month.no_access, "connecté, accès").toBe(true);
    expect(
      month.days.map((d: { day: string; net: number }) => [d.day, d.net]),
      "un jour par jour de ventes (Sobrus)",
    ).toEqual(DAYS.map((day) => [day, closingDay(day)!.net]));

    await page.goto("/comptabilite");
    const block = closingSection(page);
    const rows = block.locator("tbody tr");
    if (DAYS.length === 0) {
      await expect(block.getByText("Aucune clôture pour ce mois", { exact: true })).toBeVisible();
      return;
    }
    await expect(rows).toHaveCount(DAYS.length);
    for (const [i, day] of DAYS.entries()) {
      const want = closingDay(day)!;
      const cells = rows.nth(i).locator("td");
      expect(frNumber(await cells.nth(1).innerText()), `${day} factures`).toBe(want.invoices);
      expect(frNumber(await cells.nth(2).innerText()), `${day} total`).toBe(want.total);
      expect(frNumber(await cells.nth(6).innerText()), `${day} net`).toBe(want.net);
    }
    await rows.first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Espèces");
    await expect(dialog).toContainText("Carte bancaire");
    await expect(dialog).toContainText(`CLIENT CREDIT ${DAYS[0].slice(8)}`);
    await dialog.getByRole("button", { name: "Fermer" }).last().click();

    const file = await downloadXlsx(page, () => block.getByRole("button", { name: "Exporter la clôture" }).click());
    expect(file.rows[0], "en-têtes en français").toEqual([
      "Date",
      "Factures",
      "Total (MAD)",
      "Payé (MAD)",
      "Crédit (MAD)",
      "Retours (MAD)",
      "Net (MAD)",
    ]);
    expect(file.rows.length, "un jour par ligne + le total").toBe(DAYS.length + 2);
  });

  test("clôture de caisse : compte Sobrus sans accès → l'avertissement", async ({ page }) => {
    test.setTimeout(6 * 60_000);
    await control(page, { forbid: "closing" });
    try {
      await apiPost(page, "/sobrus/runs", { mode: "range", date_from: TO, date_to: TO }, {}, 201);
      await ownerRunEnded(page);
    } finally {
      await control(page, { forbid: null });
    }
    expect((await apiGet(page, "/accounting/cash-closings", { month: MONTH })).no_access).toBe(true);
    await page.goto("/comptabilite");
    await expect(closingSection(page)).toContainText("Ce compte Sobrus n'a pas accès à la clôture de caisse");
  });
});

test.describe("administrateur", () => {
  test.use({ storageState: sessionFile("admin") });

  test("catalogue : les tuiles filtrent la liste", async ({ page }) => {
    await page.goto("/admin/catalogue");
    const stats = await apiGet(page, "/admin/catalog/stats");
    for (const [label, type, n] of [
      ["Pharmacie", "pharmacie", stats.pharmacie],
      ["Parapharmacie", "parapharmacie", stats.parapharmacie],
      ["Non classés", "unclassified", stats.unclassified],
    ] as const) {
      const list = page.waitForResponse(
        (r) => r.url().includes("/v1/admin/catalog?") && new URL(r.url()).searchParams.get("type") === type,
      );
      await page.getByRole("button", { name: new RegExp(`^${label}`, "i") }).first().click();
      expect((await (await list).json()).pagination.total, label).toBe(n);
    }
    await page.getByRole("button", { name: /^Produits au catalogue/i }).click();
    await expect(page.getByText(`${new Intl.NumberFormat("fr-FR").format(stats.total)} résultats`)).toBeVisible();
  });

  test("import des produits Sobrus : popup partout, « Voir le détail », « Arrêter », puis jusqu'au bout", async ({
    page,
  }) => {
    test.setTimeout(8 * 60_000);
    const pid = loadState().pharmacyId;
    await control(page, { products_delay: 2 });
    await page.goto("/admin/catalogue");
    await page.getByRole("button", { name: "Importer les produits depuis Sobrus" }).click();
    await page.goto("/admin/pharmacies");
    const popup = page.getByRole("region", { name: "Produits Sobrus" });
    await expect(popup, "la progression, sur une autre page").toBeVisible();
    await popup.getByRole("button", { name: "Voir le détail" }).click();
    await expect(popup).toContainText("Compte Sobrus");
    await popup.getByRole("button", { name: "Arrêter" }).click();
    expect((await importEnded(page)).status, "arrêté").toBe("cancelled");
    await control(page, { products_delay: 0 });

    const before = (await apiGet(page, "/admin/catalog/stats")).total;
    await page.goto("/admin/catalogue");
    await page.getByRole("button", { name: "Importer les produits depuis Sobrus" }).click();
    const done = await importEnded(page);
    expect([done.status, done.lines_added], "SOB-E2E-1…3 ajoutés").toEqual(["success", 3]);
    expect((await apiGet(page, "/admin/catalog/stats")).total, "le catalogue grandit").toBe(before + 3);
    const found = await apiGet(page, "/admin/catalog", { search: "PRODUIT SOBRUS E2E" });
    expect(found.pagination.total, "les 3 nouveaux").toBe(3);
    expect(found.data[0].laboratoire).toBe("LABORATOIRE SOBRUS E2E");

    // Its history (exact check with the limit) and the « Produits Sobrus » tab.
    expect((await apiGet(page, "/admin/catalog/sobrus-products/history", { limit: "5" })).length).toBeGreaterThan(1);
    await page.goto("/imports");
    await page.getByRole("tab", { name: "Produits Sobrus", exact: true }).click();
    await expect(page.locator("tbody tr").first()).toContainText("Réussi");
    expect(pid, "la pharmacie E2E").toBeTruthy();
  });

  test("import des produits : compte refusé par Sobrus → `sobrusNoAccess`, le suivant (aucun) ", async ({ page }) => {
    test.setTimeout(6 * 60_000);
    await control(page, { forbid: "products" });
    try {
      await page.goto("/admin/catalogue");
      await page.getByRole("button", { name: "Importer les produits depuis Sobrus" }).click();
      expect((await importEnded(page)).error_code).toBe("sobrusNoAccess");
    } finally {
      await control(page, { forbid: null });
    }
    await page.goto("/admin/catalogue");
    await expect(page.getByText("Sobrus a refusé ce compte : le compte suivant est essayé.")).toBeVisible();
  });
});

test.describe("propriétaire, après", () => {
  test.use({ storageState: sessionFile("owner") });

  test("fiche produit : DCI et forme venues de Sobrus ; l'import de l'administrateur reste invisible", async ({
    page,
  }) => {
    const { data } = await apiGet(page, "/products", { page: "1" });
    const sheet = await apiGet(page, `/products/${data[0].id}`);
    expect([sheet.dci, sheet.galenic_form]).toEqual([`DCI ${sheet.pid}`, "Comprimé"]);
    await page.goto(`/produits/${data[0].id}`);
    await expect(page.getByText(`DCI ${sheet.pid}`, { exact: true })).toBeVisible();
    const runs = await apiGet(page, "/sobrus/runs");
    expect(runs.some((r: { mode: string }) => r.mode === "products"), "pas dans ses imports").toBe(false);
    await apiDelete(page, "/sobrus/connection", 204);
  });
});
