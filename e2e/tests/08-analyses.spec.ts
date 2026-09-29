/** Analyses: type the period, then every tab × Mixte / Pharmacie / Parapharmacie,
 *  every row and every KPI; then Liste mode with the generated CSV.
 *  Known bug isolated in a `test.fail` (passes while the bug exists). */
import { resolve } from "node:path";
import type { Page } from "@playwright/test";

import { sessionFile } from "../lib/auth";
import { ANALYSE_MODES, CATEGORY_TYPES, checkAnalyse, checkListe, type AnalyseMode, type Row } from "../lib/checks";
import { expected, testWindow } from "../lib/expected";
import { expect, test } from "../lib/fixtures";
import { REPO_DIR } from "../lib/paths";
import { pageCall, pagePost, period, pickCategoryType, setPeriod } from "../lib/ui";


test.use({ storageState: sessionFile("owner") });

const OTHER_MODES = ["categorie", "laboratoire", "grossiste", "operateur", "mois", "annee"] as const;

async function open(page: Page): Promise<void> {
  await page.goto("/analyses");
  await expect(page.getByRole("heading", { level: 1, name: "Analyse de marge", exact: true })).toBeVisible();
}

const call = (page: Page, mode: string, ct: string) =>
  pageCall(page, "/stats/analyse-marge", { mode, ...period(testWindow()), category_type: ct });

async function openTab(page: Page, mode: AnalyseMode, ct: string): Promise<Row> {
  const res = call(page, mode, ct);
  await page.getByRole("tab", { name: ANALYSE_MODES[mode].tab, exact: true }).click();
  return res;
}


test("analyses: chaque onglet × Mixte / Pharmacie / Parapharmacie", async ({ page }) => {
  const w = testWindow();
  await open(page);
  for (const [i, { ct, label }] of CATEGORY_TYPES.entries()) {
    await test.step(label, async () => {
      // Back on Produit first (already cached for the previous category → no request).
      if (i > 0) await page.getByRole("tab", { name: "Produit", exact: true }).click();
      const produit = call(page, "produit", ct);
      if (i === 0) await setPeriod(page, w.date_from, w.date_to);
      else await pickCategoryType(page, label);
      checkAnalyse(await produit, ct, "produit");
      for (const mode of OTHER_MODES) {
        await test.step(ANALYSE_MODES[mode].tab, async () => checkAnalyse(await openTab(page, mode, ct), ct, mode));
      }
    });
  }
});

test("analyses: mode Liste (CSV importé)", async ({ page }) => {
  await open(page);
  const w = testWindow();
  await setPeriod(page, w.date_from, w.date_to);
  await page.getByRole("tab", { name: "Liste", exact: true }).click();
  const liste = pagePost(page, "/stats/analyse-liste");
  await page.locator('input[type="file"][accept=".csv,text/csv"]').setInputFiles(resolve(REPO_DIR, expected().files.liste.path));
  checkListe(await liste);
});

test.fail("analyses: catégorie — une seule ligne par catégorie (bug: « Médicament (33.930%) » et « (30.000%) » restent 2 lignes)", async ({ page }) => {
  await open(page);
  const produit = call(page, "produit", "all");
  await setPeriod(page, testWindow().date_from, testWindow().date_to);
  await produit;
  const rows = (await openTab(page, "categorie", "all")).rows as Row[];
  const labels = rows.map((r) => r.category);
  expect(labels.length).toBe(new Set(labels).size);
});
