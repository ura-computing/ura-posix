/** Every control a page shows is used at least once (the gate « every button, link, tab, menu, checkbox and field
 *  shown is used » in 99-gates). The other specs check the numbers; this one clicks what they don't, page by page,
 *  through the UI, and checks what each click does on screen (dates, chips, rows, pages, menus). */
import { resolve } from "node:path";
import type { Locator, Page } from "@playwright/test";

import { apiDelete, apiGet, apiPost } from "../lib/api";
import { LOGGED_OUT, PREMIUM_FEATURES, loadState, sessionFile } from "../lib/auth";
import { expected } from "../lib/expected";
import { expect, test } from "../lib/fixtures";
import { REPO_DIR } from "../lib/paths";
import { dates, quickPeriods, setPeriod, shown } from "../lib/ui";

test.use({ storageState: sessionFile("owner") });

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
  await expect
    .poll(() => dates(page), { message: "le 1er du mois d'avant" })
    .toMatch(new RegExp(`^${shown(firstOfMonthBefore)} → `));

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
  for (const path of [
    "/ventes",
    "/achats",
    "/alertes",
    "/analyses",
    "/comptabilite",
    "/rapport",
    "/historique",
    "/stock",
  ]) {
    await test.step(path, async () => {
      await page.goto(path);
      await expect(page.getByRole("button", { name: "Ouvrir le calendrier", exact: true })).toBeVisible();
      await dateControls(page);
    });
  }
});

/** « Page 2 / 9 » → [2, 9]. */
async function pageOf(page: Page): Promise<[number, number]> {
  const text = await page
    .locator("main")
    .getByText(/^Page \d+ \/ \d+$/)
    .first()
    .innerText();
  const [, now, total] = /^Page (\d+) \/ (\d+)$/.exec(text.trim()) ?? [];
  return [Number(now), Number(total)];
}

/** « 203 583 résultats » → 203583. */
async function results(page: Page): Promise<number> {
  const text = await page
    .locator("main")
    .getByText(/^[\d\s\u202f\u00a0]+ résultats?$/)
    .first()
    .innerText();
  return Number(text.replace(/\D/g, ""));
}

/** A list's pages: on page 1 « Précédent » is greyed, « Suivant » too when one page holds everything, else « Suivant »
 *  → page 2, « Précédent » → page 1. Then another page size: that many rows (or all), the pages follow. */
async function pagesAndSize(page: Page) {
  await expect.poll(() => pageOf(page).then(([n]) => n), { message: "page 1" }).toBe(1);
  const total = await results(page);
  const [, pages] = await pageOf(page);
  const next = page.getByRole("button", { name: "Page suivante", exact: true }).first();
  const previous = page.getByRole("button", { name: "Page précédente", exact: true }).first();
  await expect(previous, "page 1 : « Précédent » grisé").toBeDisabled();
  if (pages === 1) await expect(next, "une seule page : « Suivant » grisé").toBeDisabled();
  else {
    await next.click();
    await expect.poll(() => pageOf(page).then(([n]) => n), { message: "page suivante" }).toBe(2);
    await previous.click();
    await expect.poll(() => pageOf(page).then(([n]) => n), { message: "page précédente" }).toBe(1);
  }
  // Another page size (its menu: the page-size list), 50 or more when there is one.
  const sizeButton = page
    .locator("main")
    .getByRole("button", { name: /^\d+ \/ page$/ })
    .first();
  const current = Number((await sizeButton.innerText()).trim().split(" ")[0]);
  await sizeButton.click();
  const menu = page.locator('[data-list=""]');
  const sizes = (await menu.getByRole("button").allInnerTexts()).map((s) => Number(s.trim().split(" ")[0]));
  const size = sizes.find((s) => s !== current && s >= 50) ?? sizes.find((s) => s !== current) ?? current;
  await menu.getByRole("button", { name: `${size} / page`, exact: true }).click();
  await expect(menu, "le menu fermé").toHaveCount(0);
  await expect(page.locator("tbody tr"), `${size} lignes (ou toutes)`).toHaveCount(Math.min(size, total));
  await expect
    .poll(() => pageOf(page).then(([, t]) => t), { message: "nombre de pages" })
    .toBe(Math.max(1, Math.ceil(total / size)));
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
    const th = root
      .locator("thead th[aria-sort]")
      .filter({ hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) });
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
      await expect(page.getByRole("button", { name: "Pharmacie", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
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
  for (const option of [
    "Idéal (46-60 j)",
    "À surveiller (61-99 j)",
    "Sur-stock (≥100 j)",
    "Inconnu",
    "Stock négatif",
    "Tous statuts",
  ]) {
    await test.step(option, async () => {
      // The list asked again with that status (none: « Tous statuts »).
      const sent = page.waitForRequest((r) => {
        const u = new URL(r.url());
        return (
          u.pathname === "/v1/stats/stock-abcd" &&
          u.searchParams.has("class_filter") &&
          u.searchParams.has("status") === (option !== "Tous statuts")
        );
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

test("Alertes : chaque carte ouvre sa liste (tri de chaque colonne, « Fermer »), sur toutes les dates puis chaque période rapide", async ({
  page,
}) => {
  test.setTimeout(5 * 60_000);
  await page.goto("/alertes");
  // Enabled cards only (an empty one is shown greyed, aria-disabled). A card empty on some dates may not be on others
  // (a margin over a year is not the one of a quarter): every card opens once, on the first dates where it has lines.
  const cards = page
    .locator('main button:not([aria-disabled="true"]):not([disabled])')
    .filter({ hasText: /produits|Unités/ });
  const opened = new Set<string>();
  const openNew = async (dates: string) => {
    const names = (await cards.allInnerTexts()).map((n) => n.split("\n")[0].trim());
    for (const [i, name] of names.entries()) {
      if (opened.has(name)) continue;
      await test.step(`${name} (${dates})`, async () => {
        await cards.nth(i).click();
        const dialog = page.getByRole("dialog");
        await sortEveryColumn(page, dialog);
        await dialog
          .getByRole("button", { name: "Fermer", exact: true })
          .nth(opened.size % 2 ? -1 : 0)
          .click(); // ✕, or the one below
        await expect(dialog).toHaveCount(0);
      });
      opened.add(name);
    }
  };
  const loaded = () => page.waitForResponse((r) => r.url().includes("/v1/stats/margin-alerts") && r.ok());
  let answer = loaded();
  await setPeriod(page, "2000-01-01", shown(new Date()).split("/").reverse().join("-"));
  await answer;
  await expect(cards.first()).toBeVisible();
  await openNew("toutes les dates");
  for (const [period] of quickPeriods(new Date())) {
    answer = loaded();
    await page.getByRole("button", { name: "Ouvrir le calendrier", exact: true }).click();
    await page.getByRole("button", { name: period, exact: true }).click();
    await answer;
    await openNew(period);
  }
});

test("Produits : scanner (« Fermer », « Annuler »), ✕ de la recherche", async ({ page }) => {
  await page.goto("/produits");
  for (const close of ["Fermer", "Annuler"]) {
    await page
      .getByRole("button", { name: /Scanner/ })
      .first()
      .click();
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
    await page
      .getByRole("button", { name: /choisir dans le calendrier$/ })
      .first()
      .click();
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

test("Équipe : « Inviter un employé » (œil, pharmacie, « Annuler », « Fermer »), permissions « Tout activer (où possible) »", async ({
  page,
}) => {
  // Its own employee (made here, removed at the end): the permissions dialog needs one.
  const employee = { full_name: "E2E Équipe", email: "e2e.equipe.ui@pharmagest.ma", password: "EquipeUi#2026" };
  const { member } = await apiPost(page, "/owner/employees", {
    ...employee,
    role: "employee",
    pharmacy_id: loadState().pharmacyId,
  });
  const dialog = page.getByRole("dialog");
  try {
    await page.goto("/owner/employees");
    for (const close of ["Annuler", "Fermer"]) {
      await page.getByRole("button", { name: "Inviter un employé", exact: true }).click();
      const password = dialog.getByLabel("Mot de passe", { exact: true });
      await password.fill("Visible#2026");
      await dialog.getByRole("button", { name: "Afficher le mot de passe", exact: true }).click();
      await expect(password, "mot de passe affiché").toHaveAttribute("type", "text");
      await dialog.getByRole("button", { name: "Masquer le mot de passe", exact: true }).click();
      await expect(password, "mot de passe caché").toHaveAttribute("type", "password");
      await dialog.getByRole("button", { name: /^Pharmacie assignée/ }).click();
      await page
        .locator('[data-list=""]')
        .getByRole("button", { name: /^Pharmacie E2E/ })
        .click();
      await dialog.getByRole("button", { name: close, exact: true }).first().click();
      await expect(dialog, close).toHaveCount(0);
    }
    await page
      .getByRole("row", { name: new RegExp(employee.email.replace(/[.]/g, "\\.")) })
      .getByRole("button", { name: "Gérer les permissions" })
      .click();
    await dialog.getByRole("button", { name: "Tout activer (où possible)", exact: true }).click();
    await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  } finally {
    await apiDelete(page, `/owner/employees/${member.id}`, 204);
  }
});

test("Comptabilité : mois (année précédente / suivante, un mois), carte « Virement et autres » (« Fermer »)", async ({
  page,
}) => {
  await page.goto("/comptabilite");
  const monthButton = page
    .locator("main")
    .getByRole("button", { name: /^\S+ \d{4}$/ })
    .first(); // « Novembre 2026 »
  const [month, year] = (await monthButton.innerText()).trim().split(" ");
  const months = page.locator('[data-list="months"]');
  await monthButton.click();
  const shownYear = months.locator("xpath=..").getByText(/^\d{4}$/);
  await page.getByRole("button", { name: "Année précédente", exact: true }).click();
  await expect(shownYear).toHaveText(String(Number(year) - 1));
  await page.getByRole("button", { name: "Année suivante", exact: true }).click();
  await expect(shownYear).toHaveText(year);
  await months.getByRole("button").first().click(); // January
  await expect(monthButton).toHaveText(`Janvier ${year}`);
  await monthButton.click();
  await months.getByRole("button").nth(new Date().getMonth()).click(); // back to this month
  await expect(monthButton).toHaveText(`${month} ${year}`);
  await page.getByRole("button", { name: /^Virement et autres/i }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Fermer", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Produits spéciaux : « Effacer la recherche »", async ({ page }) => {
  await page.goto("/produits-speciaux");
  const search = page.getByRole("searchbox").first();
  await search.fill("E2E");
  await page.getByRole("button", { name: "Effacer la recherche", exact: true }).click();
  await expect(search).toHaveValue("");
});

test("Importer un fichier : chaque type, « Changer le type de document », fichier refusé, « Choisir un autre fichier », plusieurs fichiers (« Choisir d'autres fichiers »)", async ({
  page,
}) => {
  const file = (kind: string) => resolve(REPO_DIR, expected().files[kind].path);
  const changeType = page.getByRole("button", { name: "Changer le type de document", exact: true });
  const input = page.locator('input[type="file"]');
  await page.goto("/upload-file");
  for (const type of ["Ventes", "Stock", "Achats"]) {
    await page
      .getByRole("radio")
      .filter({ hasText: new RegExp(`^${type}`) })
      .first()
      .click();
    await expect(changeType, type).toBeVisible();
    if (type !== "Achats") await changeType.click();
  }
  // Achats: a stock file → refused, the name expected shown.
  await input.setInputFiles(file("stock"));
  await expect(page.getByText(/^Nom de fichier invalide\. Format attendu : « Sobrus - Achats /)).toBeVisible();
  // The right file → « Choisir un autre fichier » brings back the choice.
  await input.setInputFiles(file("extra_achats"));
  const start = page.getByRole("button", { name: "Importer dans la base", exact: true });
  await expect(start).toBeVisible();
  await page.getByRole("button", { name: "Choisir un autre fichier", exact: true }).click();
  await expect(start).toHaveCount(0);
  // Several files → their list → « Choisir d'autres fichiers ».
  await input.setInputFiles([file("achats"), file("extra_achats")]);
  await page.getByRole("button", { name: "Choisir d'autres fichiers", exact: true }).click();
  await expect(page.getByRole("button", { name: "Choisir d'autres fichiers", exact: true })).toHaveCount(0);
  // Back to the types: the one chosen stays, « Continuer » goes on with it.
  await changeType.click();
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await expect(changeType).toBeVisible();
  // From a list page: « Importer » opens this page for its kind.
  await page.goto("/ventes");
  await page.locator("main").getByRole("link", { name: "Importer", exact: true }).click();
  await expect(page).toHaveURL(/\/upload-file\?type=vente$/);
});

test("Mon compte : indicatif pays, onglet « Mot de passe » (œil), retour à « Profil » ; le logo du menu → accueil", async ({
  page,
}) => {
  await page.goto("/auth/me");
  const country = page.getByRole("combobox", { name: "Indicatif pays", exact: true });
  const before = await country.inputValue();
  const other = await country
    .locator("option")
    .evaluateAll((o, v) => o.map((x) => (x as HTMLOptionElement).value).find((x) => x && x !== v), before);
  await country.selectOption(other ?? "");
  await expect(country).toHaveValue(other ?? "");
  await country.selectOption(before); // nothing saved
  await page.getByRole("tab", { name: "Mot de passe", exact: true }).click();
  const current = page.getByLabel("Mot de passe actuel", { exact: true });
  await current.fill("Visible#2026");
  await page.getByRole("button", { name: "Afficher le mot de passe", exact: true }).first().click();
  await expect(current, "mot de passe affiché").toHaveAttribute("type", "text");
  await page.getByRole("tab", { name: "Profil", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Profil", exact: true })).toHaveAttribute("aria-selected", "true");
  await page
    .locator("aside")
    .getByRole("link", { name: /PharmaGest/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/$/);
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

test.describe("visiteur", () => {
  test.use({ storageState: LOGGED_OUT });

  test("pages de connexion : thème Sombre / Clair sur chacune, œil, liens, inscription « Retour »", async ({
    page,
  }) => {
    const html = page.locator("html");
    for (const path of ["/login", "/auth/forgot-password", "/auth/signup", "/auth/set-password"]) {
      await test.step(path, async () => {
        await page.goto(path);
        await page.getByRole("button", { name: "Sombre", exact: true }).click();
        await expect(html).toHaveClass(/\bdark\b/);
        await page.getByRole("button", { name: "Clair", exact: true }).click();
        await expect(html).not.toHaveClass(/\bdark\b/);
        await page.getByRole("button", { name: "Système", exact: true }).click(); // back to the computer's choice
        await expect(page.getByRole("button", { name: "Système", exact: true })).toHaveAttribute(
          "aria-pressed",
          "true",
        );
      });
    }
    await test.step("lien expiré : « Demander un nouveau lien »", async () => {
      await page.goto("/auth/set-password");
      await page.getByRole("link", { name: "Demander un nouveau lien", exact: true }).click();
      await expect(page).toHaveURL(/\/auth\/forgot-password$/);
    });
    await test.step("connexion : œil", async () => {
      await page.goto("/login");
      const password = page.getByLabel("Mot de passe", { exact: true });
      await password.fill("Visible#2026");
      await page.getByRole("button", { name: "Afficher le mot de passe", exact: true }).click();
      await expect(password).toHaveAttribute("type", "text");
    });
    await test.step("mot de passe oublié : « Retour à la connexion »", async () => {
      await page.goto("/auth/forgot-password");
      await page.getByRole("link", { name: "Retour à la connexion", exact: true }).click();
      await expect(page).toHaveURL(/\/login$/);
    });
    await test.step("inscription : « Suivant », « Retour », « Se connecter »", async () => {
      await page.goto("/auth/signup");
      await page.getByRole("radio", { name: /^Employé d'une pharmacie/ }).click();
      await page.getByRole("button", { name: "Suivant", exact: true }).click();
      await page.getByRole("button", { name: "Retour", exact: true }).click();
      await expect(page.getByRole("radiogroup", { name: "Vous êtes…" })).toBeVisible();
      await page.getByRole("link", { name: "Se connecter", exact: true }).click();
      await expect(page).toHaveURL(/\/login$/);
    });
  });
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
        await expect(filters.getByRole("button", { name: /^Type/ })).toHaveText(
          type === "Tous types" ? "Type" : `Type: ${type}`,
        );
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
    await test.step("« Ajouter » : type forcé (chaque type, puis aucun), « Annuler », « Fermer »", async () => {
      const dialog = page.getByRole("dialog");
      for (const close of ["Annuler", "Fermer"]) {
        await filters.getByRole("button", { name: "Ajouter", exact: true }).click();
        if (close === "Annuler") {
          for (const type of ["Pharmacie", "Parapharmacie"]) {
            const chip = dialog.getByRole("button", { name: type, exact: true });
            await chip.click();
            await expect(chip, `${type} forcé`).toHaveAttribute("aria-pressed", "true");
            await chip.click();
            await expect(chip, `${type} retiré`).toHaveAttribute("aria-pressed", "false");
          }
        }
        await dialog.getByRole("button", { name: close, exact: true }).first().click();
        await expect(dialog, close).toHaveCount(0);
      }
    });
  });

  test("Tableau de bord : une pharmacie, chaque onglet de l'analyse de marge, ses pages", async ({ page }) => {
    await page.goto("/rapport");
    await page
      .getByRole("button", { name: /^Pharmacie/ })
      .first()
      .click();
    await page
      .locator('[data-list="Pharmacie"]')
      .getByRole("button", { name: /· Pharmacie E2E$/ })
      .click();
    for (const tab of ["Par catégorie", "Par grossiste", "Par produit"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await expect(page.getByRole("tab", { name: tab, exact: true })).toHaveAttribute("aria-selected", "true");
    }
    await pagesAndSize(page);
  });

  test("Catégories : « Nouveau mapping », chaque couleur, « Annuler », « Fermer »", async ({ page }) => {
    await page.goto("/admin/categories");
    await page.getByRole("button", { name: "Nouveau mapping", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const names = (
      await dialog
        .locator("button[aria-pressed]")
        .evaluateAll((b) => b.map((x) => x.getAttribute("aria-label") ?? x.textContent ?? ""))
    ).map((n) => n.trim());
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

  test("Pharmacies : recherche, « Nouvelle pharmacie », « Nouvel utilisateur », un compte (mot de passe, désactiver, réactiver, sa pharmacie), la fiche (fonctionnalités, permissions, « Modifier », retour)", async ({
    page,
  }) => {
    test.setTimeout(3 * 60_000);
    // Its own pharmacy and owner (made here, removed at the end): these actions change them.
    const pharmacy = await apiPost(page, "/admin/pharmacies", { name: "E2E Contrôles", city: "Rabat" });
    const account = { full_name: "E2E Contrôles", email: "e2e.controles@pharmagest.ma", password: "Controles#2026" };
    const { member } = await apiPost(page, `/admin/pharmacies/${pharmacy.id}/users`, {
      ...account,
      role: "owner",
      pharmacy_id: pharmacy.id,
    });
    const dialog = page.getByRole("dialog");
    /** « Nouvel utilisateur » (list or pharmacy page): the eye shows the password, each role, a pharmacy picked. */
    const created = { name: "E2E Contrôles Créé", email: "e2e.controles.cree@pharmagest.ma" };
    /** « Nouvel utilisateur » (list or pharmacy page): name, email, the eye (shown, hidden), each role, the pharmacy;
     *  then « Créer le compte » (« Compte créé », « Fermer ») or closed without creating. */
    const newUser = async (close: "Créer le compte" | "Annuler" | "Fermer") => {
      await page.getByRole("button", { name: "Nouvel utilisateur", exact: true }).click();
      await dialog.getByLabel("Nom complet").fill(created.name);
      await dialog.getByLabel("Email").fill(created.email);
      const password = dialog.getByLabel("Mot de passe", { exact: true });
      await password.fill("Visible#2026");
      await dialog.getByRole("button", { name: "Afficher le mot de passe", exact: true }).click();
      await expect(password, "mot de passe affiché").toHaveAttribute("type", "text");
      await dialog.getByRole("button", { name: "Masquer le mot de passe", exact: true }).click();
      await expect(password, "mot de passe caché").toHaveAttribute("type", "password");
      for (const role of [/^Propriétaire/, /^Employé/]) {
        await dialog.getByRole("radio", { name: role }).click();
        await expect(dialog.getByRole("radio", { name: role })).toHaveAttribute("aria-checked", "true");
      }
      await dialog.getByRole("button", { name: /^Pharmacie assignée/ }).click();
      await page
        .locator('[data-list=""]')
        .getByRole("button", { name: /E2E Contrôles/ })
        .click();
      await dialog.getByRole("button", { name: close, exact: true }).first().click();
      if (close === "Créer le compte") {
        await expect(dialog.getByText("Compte créé", { exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: "Fermer", exact: true }).last().click();
      }
      await expect(dialog, close).toHaveCount(0);
    };
    try {
      await page.goto("/admin/pharmacies");
      await test.step("recherche", async () => {
        const search = page.getByRole("textbox", { name: /^Rechercher par nom/ });
        await search.fill("E2E Contrôles");
        await expect(page.locator("tbody tr")).toHaveCount(1);
        await expect(page.locator("tbody")).toContainText("E2E Contrôles");
        await page.locator("tbody tr").getByRole("button", { name: "Ouvrir", exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/admin/pharmacies/${pharmacy.id}$`));
        await page.goto("/admin/pharmacies");
      });
      await test.step("« Nouvelle pharmacie » : adresse, téléphone, email, « Annuler »", async () => {
        await page.getByRole("button", { name: "Nouvelle pharmacie", exact: true }).click();
        for (const [label, value] of [
          ["Adresse", "12 rue E2E"],
          ["Téléphone", "+212600000011"],
          ["Email", "contact@e2e.ma"],
        ]) {
          await dialog.getByRole("textbox", { name: label, exact: true }).fill(value);
          await expect(dialog.getByRole("textbox", { name: label, exact: true })).toHaveValue(value);
        }
        await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
        await expect(dialog).toHaveCount(0);
      });
      await test.step("« Nouvel utilisateur » : « Fermer », puis un compte créé", async () => {
        await newUser("Fermer");
        await newUser("Créer le compte");
      });
      await test.step("le compte : « Réinitialiser le mot de passe » (« Annuler »), désactiver, réactiver, sa pharmacie", async () => {
        await page.getByRole("tab", { name: "Utilisateurs", exact: true }).click();
        const row = page.getByRole("row", { name: new RegExp(account.email.replace(/[.]/g, "\\.")) });
        const menu = async (action: string) => {
          await row.getByRole("button", { name: "Plus d'actions", exact: true }).click();
          await page.getByRole("menuitem", { name: action, exact: true }).click();
        };
        await menu("Réinitialiser le mot de passe");
        await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await menu("Désactiver");
        await expect(row).toContainText("Inactif");
        await menu("Réactiver");
        await expect(row).toContainText("Actif");
        await row.getByRole("link", { name: /E2E Contrôles/ }).click();
        await expect(page).toHaveURL(new RegExp(`/admin/pharmacies/${pharmacy.id}$`));
      });
      await test.step("la fiche : fonctionnalités (« Tout désactiver », « Annuler », « Tout activer »)", async () => {
        const switches = page.locator("main").getByRole("switch");
        const cancel = page.locator("main").getByRole("button", { name: "Annuler", exact: true });
        await page.getByRole("button", { name: "Tout désactiver", exact: true }).click();
        await expect(switches.and(page.locator("[aria-checked=true]"))).toHaveCount(0);
        const off = switches.and(page.locator("[aria-checked=false]"));
        await cancel.click(); // nothing saved: back as saved (every feature on, premium off)
        await expect(off).toHaveCount(PREMIUM_FEATURES.length);
        await page.getByRole("button", { name: "Tout désactiver", exact: true }).click();
        await page.getByRole("button", { name: "Tout activer", exact: true }).click();
        await expect(off).toHaveCount(0);
        await cancel.click(); // premium switched on only on screen: back as saved
        await expect(off).toHaveCount(PREMIUM_FEATURES.length);
        await expect(cancel, "comme enregistré : rien à annuler").toHaveCount(0);
      });
      await test.step("permissions du propriétaire : « Tout activer (où possible) », « Annuler »", async () => {
        await page.getByRole("button", { name: "Gérer les permissions", exact: true }).first().click();
        await dialog.getByRole("button", { name: "Tout activer (où possible)", exact: true }).click();
        await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
        await expect(dialog).toHaveCount(0);
      });
      await test.step("« Modifier » : nom, ville, email, « Annuler »", async () => {
        await page.locator("main").getByRole("button", { name: "Modifier", exact: true }).first().click();
        for (const [label, value] of [
          ["Nom*", "E2E Contrôles"],
          ["Ville*", "Rabat"],
          ["Email", "fiche@e2e.ma"],
        ]) {
          await dialog.getByRole("textbox", { name: label, exact: true }).fill(value);
          await expect(dialog.getByRole("textbox", { name: label, exact: true })).toHaveValue(value);
        }
        await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
        await expect(dialog).toHaveCount(0);
      });
      await test.step("« Nouvel utilisateur » de la fiche, « Annuler »", () => newUser("Annuler"));
      await test.step("« Retour aux pharmacies »", async () => {
        await page.getByRole("link", { name: "Retour aux pharmacies", exact: true }).click();
        await expect(page).toHaveURL(/\/admin\/pharmacies$/);
      });
    } finally {
      const users: { id: number; email: string }[] = await apiGet(page, "/admin/users");
      for (const u of users.filter((u) => u.email === created.email))
        await apiDelete(page, `/admin/users/${u.id}`, 204);
      await apiDelete(page, `/admin/users/${member.id}`, 204);
      await apiDelete(page, `/admin/pharmacies/${pharmacy.id}`, 204);
    }
  });
});
