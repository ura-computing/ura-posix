/** Every control a page shows is used at least once (the gate « every button, link, tab, menu, checkbox and field
 *  shown is used » in 99-gates). The other specs check the numbers; this one clicks what they don't, page by page,
 *  through the UI, and checks what each click does on screen (dates, chips, rows, pages, menus). */
import { resolve } from "node:path";
import type { Locator, Page } from "@playwright/test";

import { apiGet } from "../lib/api";
import { sessionFile } from "../lib/auth";
import { expected } from "../lib/expected";
import { expect, test } from "../lib/fixtures";
import { REPO_DIR } from "../lib/paths";

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

/** Each quick period of the calendar → its dates (« jj/mm/aaaa → jj/mm/aaaa »): a whole month, quarter or year. */
function quickPeriods(today: Date): [string, string][] {
  const [y, m] = [today.getFullYear(), today.getMonth()];
  const q = Math.floor(m / 3) - 1; // the quarter before (-1 = last year's 4th)
  const [qy, qm] = q < 0 ? [y - 1, 9] : [y, q * 3];
  const range = (from: Date, to: Date) => `${shown(from)} → ${shown(to)}`;
  return [
    ["Année en cours", range(new Date(y, 0, 1), today)],
    ["Mois actuel", range(new Date(y, m, 1), today)],
    ["Mois antérieur", range(new Date(y, m - 1, 1), new Date(y, m, 0))],
    ["Trimestre antérieur", range(new Date(qy, qm, 1), new Date(qy, qm + 3, 0))],
    ["Année antérieure", range(new Date(y - 1, 0, 1), new Date(y - 1, 11, 31))],
  ];
}

/** The date controls of a filter bar: a day picked in the calendar (it opens on the start date's month, else today's;
 *  the previous month's 1st = that start), every quick period (its dates), the chip's ✕, « Tout réinitialiser ».
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

  for (const [period, want] of quickPeriods(today)) {
    await calendar.click();
    await page.getByRole("button", { name: period, exact: true }).click();
    await expect.poll(() => dates(page), { message: period }).toBe(want);
  }
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
  for (const path of ["/ventes", "/achats", "/comptabilite", "/historique", "/analyses", "/produits"]) {
    await test.step(path, async () => {
      await page.goto(path);
      await pagesAndSize(page);
    });
  }
});

/** Every sortable column of a table (the page's, or the one in `root`: a dialog): a click sorts by it (`aria-sort`
 *  ascending or descending). */
async function sortEveryColumn(page: Page, root: Locator = page.locator("main")) {
  const headers = root.locator("thead th[aria-sort]");
  await expect(headers.first()).toBeVisible();
  const names = await headers.allInnerTexts();
  for (const name of names.map((n) => n.trim())) {
    const th = root.locator("thead th[aria-sort]").filter({ hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) });
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
  await test.step("Analyses · Liste (une liste importée)", async () => {
    await page.getByRole("tab", { name: "Liste", exact: true }).click();
    const chooser = page.waitForEvent("filechooser");
    const posted = page.waitForResponse((r) => r.url().includes("/v1/stats/analyse-liste") && r.ok());
    await page.getByRole("button", { name: "Importer une liste" }).click();
    await (await chooser).setFiles(resolve(REPO_DIR, expected().files.liste.path));
    await posted;
    await sortEveryColumn(page);
  });
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

test("Stock : chaque statut, pages, tri de chaque colonne, « Fermer » puis classe A, péremptions (tri, « Fermer »)", async ({
  page,
}) => {
  test.setTimeout(3 * 60_000);
  await page.goto("/stock");
  const status = page.getByRole("button", { name: /^Statut/ }).first(); // the selector above the table
  for (const option of ["Idéal (46-60 j)", "À surveiller (61-99 j)", "Sur-stock (≥100 j)", "Inconnu", "Stock négatif", "Tous statuts"]) {
    await test.step(option, async () => {
      // The list asked again with that status (none: « Tous statuts »).
      const sent = page.waitForRequest((r) => {
        const u = new URL(r.url());
        return u.pathname === "/v1/stats/stock-abcd" && u.searchParams.has("class_filter") && u.searchParams.has("status") === (option !== "Tous statuts");
      });
      await status.click();
      await page.getByRole("button", { name: option, exact: true }).click();
      await sent;
      await expect(status).toHaveText(option === "Tous statuts" ? "Statut" : `Statut: ${option}`);
    });
  }
  await test.step("pages", () => pagesAndSize(page));
  await test.step("tri", () => sortEveryColumn(page));
  await test.step("« Fermer » la liste, puis classe A", async () => {
    await page.getByRole("button", { name: "Fermer", exact: true }).click();
    await expect(page.locator("main table"), "liste fermée").toHaveCount(0);
    const classA = page.getByRole("button", { name: /^Classe A : \d+ références$/ });
    await classA.click();
    await expect(classA).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("main table").first()).toBeVisible();
  });
  await test.step("péremptions : tri, « Fermer »", async () => {
    await page.getByRole("button", { name: /^Expirés en stock/ }).click();
    const dialog = page.getByRole("dialog");
    await sortEveryColumn(page, dialog);
    await dialog.getByRole("button", { name: "Fermer", exact: true }).last().click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: /^Expirés en stock/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Fermer", exact: true }).first().click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test("Alertes : chaque carte ouvre sa liste (tri de chaque colonne, « Fermer »)", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  await page.goto("/alertes");
  // Enabled cards only (an empty one is shown greyed, aria-disabled).
  const cards = page.locator('main button:not([aria-disabled="true"]):not([disabled])').filter({ hasText: /produits|Unités/ });
  await expect(cards.first()).toBeVisible();
  const names = (await cards.allInnerTexts()).map((n) => n.split("\n")[0].trim());
  for (const [i, name] of names.entries()) {
    await test.step(name, async () => {
      await cards.nth(i).click();
      const dialog = page.getByRole("dialog");
      await sortEveryColumn(page, dialog);
      await dialog.getByRole("button", { name: "Fermer", exact: true }).nth(i % 2 ? -1 : 0).click(); // ✕, or the one below
      await expect(dialog).toHaveCount(0);
    });
  }
});

test("Produits : scanner (« Fermer », « Annuler »), ✕ de la recherche", async ({ page }) => {
  await page.goto("/produits");
  for (const close of ["Fermer", "Annuler"]) {
    await page.getByRole("button", { name: /Scanner/ }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: close, exact: true }).click();
    await expect(page.getByRole("dialog"), close).toHaveCount(0);
  }
  const search = page.getByRole("region", { name: "Filtres" }).getByRole("textbox").first();
  await search.fill("E2E");
  await page.getByRole("button", { name: "Supprimer le filtre", exact: true }).click();
  await expect(search).toHaveValue("");
});

test("fiche produit : chaque période rapide, calendrier de la date (mois, année), pages de « Traçabilité », onglet « Historique »", async ({
  page,
}) => {
  test.setTimeout(3 * 60_000);
  const { data } = await apiGet(page, "/products", { limit: 1 }); // the most sold product: many lines
  await page.goto(`/produits/${data[0].id}`);
  const calendar = page.getByRole("button", { name: "Ouvrir le calendrier", exact: true });
  for (const [period, want] of quickPeriods(new Date())) {
    await test.step(period, async () => {
      await calendar.click();
      await page.getByRole("button", { name: period, exact: true }).click();
      await expect.poll(() => dates(page), { message: period }).toBe(want);
    });
  }
  await test.step("date de péremption : calendrier, mois et année", async () => {
    await page.getByRole("button", { name: "Modifier", exact: true }).first().click();
    await page.getByRole("button", { name: /choisir dans le calendrier$/ }).first().click();
    const month = page.getByRole("grid").first();
    const start = (await month.getAttribute("aria-label")) ?? ""; // « mai 2027 »
    const [name, year] = start.split(" ");
    await page.getByRole("button", { name: "Mois précédent", exact: true }).click();
    await expect(month).not.toHaveAttribute("aria-label", start);
    await page.getByRole("button", { name: "Mois suivant", exact: true }).click();
    await expect(month).toHaveAttribute("aria-label", start);
    await page.getByRole("button", { name: "Année précédente", exact: true }).click();
    await expect(month).toHaveAttribute("aria-label", `${name} ${Number(year) - 1}`);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Annuler", exact: true }).click();
  });
  await test.step("Traçabilité : pages", async () => {
    await page.getByRole("tab", { name: "Traçabilité", exact: true }).click();
    await pagesAndSize(page);
  });
  await test.step("Historique", async () => {
    await page.getByRole("tab", { name: "Historique", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Historique", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/historique|tab=/);
  });
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

test.describe("administrateur", () => {
  test.use({ storageState: sessionFile("admin") });

  test("Catalogue : pages, tri, Type et Catégorie (✕, « Tout réinitialiser »), « Ajouter » fermé (« Annuler », « Fermer »)", async ({
    page,
  }) => {
    test.setTimeout(3 * 60_000);
    await page.goto("/admin/catalogue");
    await test.step("pages", () => pagesAndSize(page));
    await test.step("tri", () => sortEveryColumn(page));
    const filters = page.getByRole("region", { name: "Filtres" });
    await test.step("Type : Parapharmacie, ✕, puis « Tous types »", async () => {
      for (const type of ["Parapharmacie", "Tous types"]) {
        await filters.getByRole("button", { name: /^Type/ }).click();
        await page.locator('[data-list="Type"]').getByRole("button", { name: type, exact: true }).click();
        await expect(filters.getByRole("button", { name: /^Type/ })).toHaveText(type === "Tous types" ? "Type" : `Type: ${type}`);
      }
      await filters.getByRole("button", { name: /^Type/ }).click();
      await page.locator('[data-list="Type"]').getByRole("button", { name: "Parapharmacie", exact: true }).click();
      await filters.getByRole("button", { name: "Supprimer le filtre", exact: true }).click();
      await expect(filters.getByRole("button", { name: /^Type/ })).toHaveText("Type");
    });
    await test.step("Catégorie : cocher, « Tout désélectionner »", async () => {
      await filters.getByRole("button", { name: "Catégorie", exact: true }).click();
      const options = page.locator('[data-list="Catégorie"] input[type="checkbox"]');
      await options.first().check();
      await page.getByRole("button", { name: "Tout désélectionner", exact: true }).click();
      await expect(page.locator('[data-list="Catégorie"] input[type="checkbox"]:checked')).toHaveCount(0);
      await page.keyboard.press("Escape");
    });
    await test.step("recherche puis « Tout réinitialiser »", async () => {
      const search = filters.getByRole("textbox").first();
      await search.fill("E2E");
      await filters.getByRole("button", { name: "Tout réinitialiser", exact: true }).click();
      await expect(search).toHaveValue("");
    });
    await test.step("« Ajouter » : « Annuler », « Fermer »", async () => {
      for (const close of ["Annuler", "Fermer"]) {
        await filters.getByRole("button", { name: "Ajouter", exact: true }).click();
        await page.getByRole("dialog").getByRole("button", { name: close, exact: true }).first().click();
        await expect(page.getByRole("dialog"), close).toHaveCount(0);
      }
    });
  });

  test("Catégories : « Nouveau mapping », chaque couleur, « Annuler », « Fermer »", async ({ page }) => {
    await page.goto("/admin/categories");
    await page.getByRole("button", { name: "Nouveau mapping", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const names = (await dialog.locator("button[aria-pressed]").evaluateAll((b) => b.map((x) => x.getAttribute("aria-label") ?? x.textContent ?? ""))).map((n) => n.trim());
    expect(names.length, "les couleurs").toBeGreaterThan(1);
    for (const name of names) {
      const color = dialog.getByRole("button", { name, exact: true });
      await color.click();
      await expect(color, name).toHaveAttribute("aria-pressed", "true");
    }
    await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: "Nouveau mapping", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Fermer", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
