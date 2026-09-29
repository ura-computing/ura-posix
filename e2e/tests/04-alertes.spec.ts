/** Alertes: on open (no period) → péremptions + ABCD default window; typed period
 *  → marge alerts, ventes sans achat, ABCD window; then Pharmacie / Parapharmacie
 *  (only marge alerts + ventes sans achat take the category). Every field. */
import { sessionFile } from "../lib/auth";
import {
  CATEGORY_TYPES, checkMarginAlerts, checkPeremptions, checkStockAbcd, checkVentesSansAchat,
} from "../lib/checks";
import { testWindow } from "../lib/expected";
import { expect, test } from "../lib/fixtures";
import { pageCall, period, pickCategoryType, setPeriod } from "../lib/ui";


test.use({ storageState: sessionFile("owner") });

test("alertes: marges, ventes sans achat, péremptions, stock", async ({ page }) => {
  const w = testWindow();
  const perem = pageCall(page, "/stats/peremptions");
  const abcdDefault = pageCall(page, "/stats/stock-abcd", { date_from: null, date_to: null });
  await page.goto("/alertes");
  await expect(page.getByRole("heading", { level: 1, name: "Alertes", exact: true })).toBeVisible();
  checkPeremptions(await perem);
  checkStockAbcd(await abcdDefault, "default");

  for (const [i, { ct, label }] of CATEGORY_TYPES.entries()) {
    await test.step(label, async () => {
      const q = { ...period(w), category_type: ct };
      const margin = pageCall(page, "/stats/margin-alerts", q);
      const vsa = pageCall(page, "/stats/ventes-sans-achat", q);
      const abcd = i === 0 ? pageCall(page, "/stats/stock-abcd", period(w)) : null;
      if (i === 0) await setPeriod(page, w.date_from, w.date_to);
      else await pickCategoryType(page, label);
      checkMarginAlerts(await margin, ct);
      checkVentesSansAchat(await vsa, ct);
      if (abcd) checkStockAbcd(await abcd, "window");
    });
  }
});
