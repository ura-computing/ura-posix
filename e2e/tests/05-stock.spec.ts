/** Stock: péremptions (every product) on open, then the ABCD classification
 *  (every product, every field) for the typed period. */
import { sessionFile } from "../lib/auth";
import { checkPeremptions, checkStockAbcd } from "../lib/checks";
import { testWindow } from "../lib/expected";
import { expect, test } from "../lib/fixtures";
import { pageCall, period, setPeriod } from "../lib/ui";


test.use({ storageState: sessionFile("owner") });

test("stock: ABCD + péremptions", async ({ page }) => {
  const w = testWindow();
  const perem = pageCall(page, "/stats/peremptions");
  await page.goto("/stock");
  await expect(page.getByRole("heading", { level: 1, name: "Stock", exact: true })).toBeVisible();
  checkPeremptions(await perem);

  // The "full" fetch (no class filter) drives the ABCD circles + gauge.
  const abcd = pageCall(page, "/stats/stock-abcd", { ...period(w), class_filter: null });
  await setPeriod(page, w.date_from, w.date_to);
  checkStockAbcd(await abcd, "window");
});
