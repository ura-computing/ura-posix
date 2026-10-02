/** Comptabilité, no exclusion in place: KPI cards (/stats, include_non_declared
 *  =false) × Mixte / Pharmacie / Parapharmacie, the sales journal (25 rows,
 *  include_non_declared=false, pages 1 + 2), the « produits spéciaux » checkbox,
 *  and the payment cards of the current month: create, edit, a second method,
 *  delete. With exclusions: see 10-exclusions.spec.ts. */
import type { Page } from "@playwright/test";

import { sessionFile } from "../lib/auth";
import { CATEGORY_TYPES, checkLedgerPage, checkStats, type Row } from "../lib/checks";
import { expectSame } from "../lib/diff";
import { expected, testWindow } from "../lib/expected";
import { expect, test } from "../lib/fixtures";
import { pageCall, pageSend, period, pickCategoryType, setPeriod } from "../lib/ui";


test.use({ storageState: sessionFile("owner") });

async function open(page: Page): Promise<void> {
  await page.goto("/comptabilite");
  await expect(page.getByRole("heading", { level: 1, name: "Comptabilité", exact: true })).toBeVisible();
}

/** The month the page shows by default (browser clock, config timezone). */
function thisMonth(): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit" })
    .formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}`;
}

interface Amounts { pharmacie_amount: number; parapharmacie_amount: number; count: number }

/** Click a method card, type the 3 values, save. Resolves with the POST answer
 *  and the month's list the page reloads after it. */
async function savePayment(page: Page, card: RegExp, v: Amounts): Promise<{ saved: Row; list: Row[] }> {
  await page.getByRole("button", { name: card }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Pharmacie (MAD)", { exact: true }).fill(String(v.pharmacie_amount));
  await dialog.getByLabel("Parapharmacie (MAD)", { exact: true }).fill(String(v.parapharmacie_amount));
  await dialog.getByLabel("Nombre de transactions", { exact: true }).fill(String(v.count));
  const saved = pageSend(page, "POST", "/accounting/payments");
  const list = pageCall(page, "/accounting/payments", { month: thisMonth() });
  await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();
  return { saved: await saved, list: await list };
}


test("comptabilité : KPI × Mixte / Pharmacie / Parapharmacie + journal des ventes", async ({ page }) => {
  const w = testWindow();
  await open(page);
  const ledger = pageCall(page, "/ventes", { ...period(w), page: "1", limit: "25", include_non_declared: "false" });
  for (const [i, { ct, label }] of CATEGORY_TYPES.entries()) {
    await test.step(label, async () => {
      const stats = pageCall(page, "/stats", { ...period(w), category_type: ct, include_non_declared: "false" });
      if (i === 0) await setPeriod(page, w.date_from, w.date_to);
      else await pickCategoryType(page, label);
      checkStats(await stats, ct);
    });
  }
  checkLedgerPage("ventes", await ledger, expected().ventes_list, 1, 25);

  const page2 = pageCall(page, "/ventes", { ...period(w), page: "2", limit: "25", include_non_declared: "false" });
  await page.getByRole("button", { name: "Page suivante" }).click();
  checkLedgerPage("ventes", await page2, expected().ventes_list, 2, 25);

  const withSpecial = pageCall(page, "/stats", { ...period(w), category_type: "parapharmacie", include_non_declared: "true" });
  await page.getByRole("checkbox", { name: "Inclure les produits spéciaux dans les KPI" }).check();
  checkStats(await withSpecial, "parapharmacie");
});


test("comptabilité : modes de paiement — créer, modifier, 2ᵉ mode, supprimer", async ({ page }) => {
  const month = thisMonth();
  const list0 = pageCall(page, "/accounting/payments", { month });
  await open(page);
  expect(await list0, `aucun paiement en ${month}`).toEqual([]);

  const tpe1 = { pharmacie_amount: 12500.5, parapharmacie_amount: 3400.25, count: 87 };
  const created = await savePayment(page, /^TPE/, tpe1);
  const tpe = { month, method: "tpe", ...tpe1 };
  expectSame(created.saved, tpe, "POST tpe (création)");
  expectSame(created.list, [tpe], "paiements après création");
  await expect(page.getByRole("button", { name: /^TPE/ })).toContainText("87 transactions");

  const tpe2 = { pharmacie_amount: 13000, parapharmacie_amount: 3000.75, count: 90 };
  const edited = await savePayment(page, /^TPE/, tpe2);
  expectSame(edited.saved, { id: created.saved.id, month, method: "tpe", ...tpe2 }, "POST tpe (modification = même ligne)");
  expectSame(edited.list, [{ ...tpe, ...tpe2 }], "paiements après modification");

  const esp1 = { pharmacie_amount: 8000, parapharmacie_amount: 1200.4, count: 42 };
  const second = await savePayment(page, /^Espèces/, esp1);
  const esp = { month, method: "especes", ...esp1 };
  expectSame(second.saved, esp, "POST especes");
  expectSame(second.list, [esp, { ...tpe, ...tpe2 }], "paiements triés par mode");

  await page.getByRole("button", { name: /^TPE/ }).click();
  const deleted = pageSend(page, "DELETE", `/accounting/payments/${created.saved.id}`, 204);
  const list = pageCall(page, "/accounting/payments", { month });
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer", exact: true }).click();
  expect(await deleted, "DELETE tpe → 204, corps vide").toBeNull();
  expectSame(await list, [esp], "paiements après suppression");
  await expect(page.getByRole("button", { name: /^TPE/ })).toContainText("Ajouter");
});
