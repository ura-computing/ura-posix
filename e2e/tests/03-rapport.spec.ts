/** Tableau de bord: open /rapport, type the period, then Mixte → Pharmacie →
 *  Parapharmacie. Every field of /stats, /stats/margin-alerts and the
 *  « Optimisation » tile's /stats/analyse-marge (mode produit) is checked for
 *  each, plus the gain shown in the tile and /stats/stock-summary (loaded once). */
import { sessionFile } from "../lib/auth";
import { CATEGORY_TYPES, checkAnalyse, checkMarginAlerts, checkStats, checkStockSummary } from "../lib/checks";
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
      const optim = pageCall(page, "/stats/analyse-marge", { ...q, mode: "produit" });
      if (i === 0) await setPeriod(page, w.date_from, w.date_to);
      else await pickCategoryType(page, label);
      checkStats(await stats, ct);
      checkMarginAlerts(await alerts, ct);
      const a = await optim;
      checkAnalyse(a, ct, "produit");                  // gain ∈ the oracle's tied values
      // The tile shows that gain: compare its digits (French format: « 12 345,60 MAD »).
      const gain: number = a.kpis.difference_gain_dh;
      const tile = page.getByText("Écart meilleur ↔ pire produit", { exact: true })
        .locator("xpath=ancestor::*[contains(@class, 'rounded-2xl')][1]");
      const digits = async () => ((await tile.textContent()) ?? "").replace(/\D/g, "");
      await expect.poll(digits, `Optimisation affichée (${gain})`).toBe(String(Math.round(Math.abs(gain) * 100)));
    });
  }
});
