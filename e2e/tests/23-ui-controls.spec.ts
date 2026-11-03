/** Every control a page shows is used at least once (the gate « every button, link, tab, menu, checkbox and field
 *  shown is used » in 99-gates). The other specs check the numbers; this one clicks what they don't, page by page,
 *  through the UI, and checks what each click does on screen (dates, chips, rows, pages, menus). */
import type { Page } from "@playwright/test";

import { sessionFile } from "../lib/auth";
import { expect, test } from "../lib/fixtures";

test.use({ storageState: sessionFile("owner") });

const pad = (n: number) => String(n).padStart(2, "0");
/** « jj/mm/aaaa » of a Date (local day, like the page). */
const shown = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

/** The 2 date fields of the page's filter bar, as « jj/mm/aaaa → jj/mm/aaaa » (« → » alone when empty). */
async function dates(page: Page): Promise<string> {
  const side = async (s: "début" | "fin") => {
    const v: string[] = [];
    for (const part of ["jour", "mois", "année"]) v.push(await page.getByLabel(`Date ${s} ${part}`, { exact: true }).inputValue());
    return v.every((x) => !x) ? "" : v.join("/");
  };
  return `${await side("début")} → ${await side("fin")}`.trim();
}

/** The date controls of a filter bar: a day picked in the calendar (it opens on the start date's month, else today's;
 *  the previous month's 1st = that start), a quick period (« Année en cours »), the chip's ✕, « Tout réinitialiser ».
 *  ✕ and « Tout réinitialiser » bring back what the page showed when opened (Stock: its 12 months; else nothing). */
async function dateControls(page: Page) {
  const today = new Date();
  const opened = await dates(page);
  const start = opened.includes("/") ? opened.split(" → ")[0] : shown(today);
  const [, m, y] = start.split("/").map(Number);
  const firstOfMonthBefore = new Date(y, m - 2, 1);
  const calendar = page.getByRole("button", { name: "Ouvrir le calendrier", exact: true });

  await calendar.click();
  await page.getByRole("button", { name: "Go to the Previous Month" }).click();
  await page
    .getByRole("grid")
    .first()
    .getByRole("button", { name: /^\S+ 1 \S+ \d{4}$/ })
    .first()
    .click();
  await expect.poll(() => dates(page), { message: "le 1er du mois d'avant" }).toMatch(
    new RegExp(`^${shown(firstOfMonthBefore)} → `),
  );

  await calendar.click();
  await page.getByRole("button", { name: "Année en cours", exact: true }).click();
  await expect.poll(() => dates(page), { message: "année en cours" }).toBe(`01/01/${today.getFullYear()} → ${shown(today)}`);
  await page.getByRole("button", { name: "Supprimer le filtre", exact: true }).first().click();
  await expect.poll(() => dates(page), { message: "✕ du filtre" }).toBe(opened);

  await calendar.click();
  await page.getByRole("button", { name: "Année en cours", exact: true }).click();
  await expect(page.getByRole("button", { name: "Tout réinitialiser", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tout réinitialiser", exact: true }).click();
  await expect.poll(() => dates(page), { message: "tout réinitialisé" }).toBe(opened);
}

test("dates : calendrier (jour, période rapide), ✕ du filtre, « Tout réinitialiser », sur chaque page", async ({
  page,
}) => {
  test.setTimeout(5 * 60_000);
  for (const path of ["/ventes", "/achats", "/alertes", "/analyses", "/comptabilite", "/rapport", "/historique", "/stock"]) {
    await test.step(path, async () => {
      await page.goto(path);
      await expect(page.getByRole("button", { name: "Ouvrir le calendrier", exact: true })).toBeVisible();
      await dateControls(page);
    });
  }
});

/** « Page 2 / 9 » → [2, 9]. */
async function pageOf(page: Page): Promise<[number, number]> {
  const text = await page.locator("main").getByText(/^Page \d+ \/ \d+$/).first().innerText();
  const [, now, total] = /^Page (\d+) \/ (\d+)$/.exec(text.trim()) ?? [];
  return [Number(now), Number(total)];
}

/** « 203 583 résultats » → 203583. */
async function results(page: Page): Promise<number> {
  const text = await page.locator("main").getByText(/^[\d\s\u202f\u00a0]+ résultats?$/).first().innerText();
  return Number(text.replace(/\D/g, ""));
}

/** A list's pages: « Suivant », « Précédent », then « 50 / page » (50 rows, fewer pages). */
async function pagesAndSize(page: Page) {
  await expect.poll(() => pageOf(page).then(([n]) => n), { message: "page 1" }).toBe(1);
  const total = await results(page);
  const before = await page.locator("tbody tr").count();
  await page.getByRole("button", { name: "Page suivante", exact: true }).first().click();
  await expect.poll(() => pageOf(page).then(([n]) => n), { message: "page suivante" }).toBe(2);
  await page.getByRole("button", { name: "Page précédente", exact: true }).first().click();
  await expect.poll(() => pageOf(page).then(([n]) => n), { message: "page précédente" }).toBe(1);
  await page.getByRole("button", { name: `${before} / page`, exact: true }).first().click();
  await page.getByRole("button", { name: "50 / page", exact: true }).last().click();
  await expect(page.getByRole("button", { name: "50 / page", exact: true })).toHaveCount(1); // the menu closed
  await expect(page.locator("tbody tr"), "50 lignes (ou toutes)").toHaveCount(Math.min(50, total));
  await expect.poll(() => pageOf(page).then(([, t]) => t), { message: "moins de pages" }).toBe(Math.ceil(total / 50));
}

test("listes : page suivante / précédente, lignes par page", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  for (const path of ["/ventes", "/achats", "/comptabilite", "/historique"]) {
    await test.step(path, async () => {
      await page.goto(path);
      await pagesAndSize(page);
    });
  }
});

/** Every sortable column of the page's table: a click sorts by it (`aria-sort` ascending or descending). */
async function sortEveryColumn(page: Page) {
  const headers = page.locator("main thead th[aria-sort]");
  await expect(headers.first()).toBeVisible();
  const names = await headers.allInnerTexts();
  for (const name of names.map((n) => n.trim())) {
    const th = page.locator("main thead th[aria-sort]").filter({ hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) });
    await th.first().getByRole("button").click();
    await expect(th.first(), `tri « ${name} »`).toHaveAttribute("aria-sort", /ascending|descending/);
  }
}

test("tri : chaque colonne triable (Analyses : chaque onglet ; Comptabilité)", async ({ page }) => {
  test.setTimeout(5 * 60_000);
  await page.goto("/analyses");
  for (const tab of ["Produit", "Catégorie", "Laboratoire", "Grossistes", "Client", "Mois", "Année"]) {
    await test.step(`Analyses · ${tab}`, async () => {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await sortEveryColumn(page);
    });
  }
  await test.step("Comptabilité", async () => {
    await page.goto("/comptabilite");
    await sortEveryColumn(page);
  });
});

test("« Mixte » : revenir à tout après Pharmacie (Alertes, Analyses, Comptabilité, Produits, Tableau de bord)", async ({
  page,
}) => {
  for (const path of ["/alertes", "/analyses", "/comptabilite", "/produits", "/rapport"]) {
    await test.step(path, async () => {
      await page.goto(path);
      const all = page.getByRole("button", { name: "Mixte", exact: true });
      await expect(all).toHaveAttribute("aria-pressed", "true");
      await page.getByRole("button", { name: "Pharmacie", exact: true }).click();
      await expect(page.getByRole("button", { name: "Pharmacie", exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect(all).toHaveAttribute("aria-pressed", "false");
      await all.click();
      await expect(all).toHaveAttribute("aria-pressed", "true");
    });
  }
});

test("Ventes, Achats : listes Catégorie / TVA (cocher puis « Tout désélectionner »), une suggestion de recherche", async ({
  page,
}) => {
  for (const path of ["/ventes", "/achats"]) {
    await test.step(path, async () => {
      await page.goto(path);
      const filters = page.getByRole("region", { name: "Filtres" });
      for (const list of ["Catégorie", "TVA"]) {
        await filters.getByRole("button", { name: list, exact: true }).click();
        const options = page.locator(`[data-list="${list}"] input[type="checkbox"]`);
        await options.first().check();
        await expect(options.first()).toBeChecked();
        await page.getByRole("button", { name: "Tout désélectionner", exact: true }).click();
        await expect(page.locator(`[data-list="${list}"] input[type="checkbox"]:checked`)).toHaveCount(0);
        await page.keyboard.press("Escape");
        await page.locator("main h1").click(); // close the list
      }
      // A suggestion under the search field: clicked = searched.
      const search = filters.getByRole("textbox").first();
      await search.fill("E2");
      const suggestion = page.locator('[data-list="suggestions"] button').first();
      await expect(suggestion).toBeVisible();
      const picked = (await suggestion.innerText()).trim();
      await suggestion.click();
      await expect(search).toHaveValue(picked);
    });
  }
});

test("Stock : chaque classe ABCD (filtre), liens « Importer stock », « voir les alertes »", async ({ page }) => {
  await page.goto("/stock");
  const classes = page.getByRole("button", { name: /^Classe \S+ : \d+ références$/ });
  await expect(classes.first()).toBeVisible();
  for (const name of await classes.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? ""))) {
    const chip = page.getByRole("button", { name, exact: true });
    if ((await chip.getAttribute("aria-pressed")) !== "true") await chip.click();
    await expect(chip, name).toHaveAttribute("aria-pressed", "true");
  }
  await page.getByRole("link", { name: "voir les alertes", exact: true }).first().click();
  await expect(page).toHaveURL(/\/alertes$/);
  await page.goto("/stock");
  await page.getByRole("link", { name: "Importer stock", exact: true }).click();
  await expect(page).toHaveURL(/\/upload-file/);
});

test("Tableau de bord : les tuiles mènent à leur page (Achats, Alertes, Stock, Importer stock)", async ({ page }) => {
  for (const [name, url] of [
    [/^Total achats/, /\/achats$/],
    [/^Marge négative/, /\/alertes/],
    [/^Santé du stock/, /\/stock$/],
    [/^Importer stock$/, /\/upload-file/],
  ] as const) {
    await page.goto("/rapport");
    await page.getByRole("link", { name }).first().click();
    await expect(page, String(name)).toHaveURL(url);
  }
});
