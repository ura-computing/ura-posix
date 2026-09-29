/** Tableau de bord: open /rapport, type the period, then Mixte → Pharmacie →
 *  Parapharmacie. Every field of /stats and /stats/margin-alerts is checked for
 *  each, plus /stats/stock-summary (loaded once, no filter). */
import { sessionFile } from "../lib/auth";
import { CATEGORY_TYPES, checkMarginAlerts, checkStats, checkStockSummary } from "../lib/checks";
import { testWindow } from "../lib/expected";
import { expect, test } from "../lib/fixtures";
import { pageCall, period, pickCategoryType, setPeriod } from "../lib/ui";


test.use({ storageState: sessionFile("owner") });

test("rapport: every indicator × Mixte / Pharmacie / Parapharmacie", async ({ page }) => {
  const w = testWindow();
  const stock = pageCall(page, "/stats/stock-summary");
  await page.goto("/rapport");
  await expect(page.getByRole("heading", { level: 1, name: "Tableau de bord", exact: true })).toBeVisible();
  checkStockSummary(await stock);

  for (const [i, { ct, label }] of CATEGORY_TYPES.entries()) {
    await test.step(label, async () => {
      const q = { ...period(w), category_type: ct };
      const stats = pageCall(page, "/stats", q);
      const alerts = pageCall(page, "/stats/margin-alerts", q);
      if (i === 0) await setPeriod(page, w.date_from, w.date_to);
      else await pickCategoryType(page, label);
      checkStats(await stats, ct);
      checkMarginAlerts(await alerts, ct);
    });
  }
});
