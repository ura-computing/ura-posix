/** Comptabilité, no exclusion in place: KPI cards (/stats, include_non_declared
 *  =false) × Mixte / Pharmacie / Parapharmacie + their values on screen, the
 *  Excel file, the sales journal (25 rows, include_non_declared=false, pages
 *  1 + 2, sort by date desc), the « produits spéciaux » checkbox, and the payment
 *  cards: create, edit, a second method, delete, a payment for another month
 *  (dialog month field + page month picker). With exclusions: 10-exclusions. */
import type { Page } from "@playwright/test";

import { sessionFile } from "../lib/auth";
import { CATEGORY_TYPES, checkLedgerPage, checkStats, type Row } from "../lib/checks";
import { expectSame } from "../lib/diff";
import { expected, testWindow } from "../lib/expected";
import { expect, test } from "../lib/fixtures";
import {
  columnTexts,
  downloadXlsx,
  frNumber,
  pageCall,
  pageSend,
  period,
  pickCategoryType,
  setPeriod,
} from "../lib/ui";

test.use({ storageState: sessionFile("owner") });

async function open(page: Page): Promise<void> {
  await page.goto("/comptabilite");
  await expect(page.getByRole("heading", { level: 1, name: "Comptabilité", exact: true })).toBeVisible();
}

/** The 8 KPI rows on screen = the /stats answer (label span, value = next span). */
async function checkKpiCards(page: Page, s: Row): Promise<void> {
  const rows: [string, number][] = [
    ["Ventes total", s.kpis.ventes_total],
    ["Marge", s.marge.marge_pct],
    ["TVA encaissée", s.tva.tva_encaissee],
    ["Total achats", s.kpis.achats_total],
    ["Opérations", s.kpis.achats_count],
    ["TVA payée", s.tva.tva_payee],
    ["Résultat (marge brute)", s.marge.marge_brute_dh],
    ["TVA à déclarer", s.tva.tva_a_declarer],
  ];
  for (const [label, want] of rows) {
    const value = page.getByText(label, { exact: true }).first().locator("xpath=following-sibling::span[1]");
    await expect
      .poll(async () => Math.abs((frNumber(await value.innerText()) ?? NaN) - want), `« ${label} » = ${want}`)
      .toBeLessThanOrEqual(0.011);
  }
}

const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];
const MONTHS_SHORT = [
  "Janv.",
  "Févr.",
  "Mars",
  "Avr.",
  "Mai",
  "Juin",
  "Juil.",
  "Août",
  "Sept.",
  "Oct.",
  "Nov.",
  "Déc.",
];
/** « Octobre 2026 » for "2026-10" (the month picker's button). */
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}`;
/** Another month of the same year (the picker shows one year at a time). */
const otherMonth = (ym: string) =>
  `${ym.slice(0, 4)}-${String(ym.endsWith("-01") ? 2 : Number(ym.slice(5)) - 1).padStart(2, "0")}`;

/** The month the page shows by default (browser clock, config timezone). */
function thisMonth(): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}`;
}

interface Amounts {
  pharmacie_amount: number;
  parapharmacie_amount: number;
  count: number;
}

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
  const ledger = pageCall(page, "/ventes", {
    ...period(w),
    page: "1",
    limit: "25",
    include_non_declared: "false",
  });
  let last: Row = {};
  for (const [i, { ct, label }] of CATEGORY_TYPES.entries()) {
    await test.step(label, async () => {
      const stats = pageCall(page, "/stats", {
        ...period(w),
        category_type: ct,
        include_non_declared: "false",
      });
      if (i === 0) await setPeriod(page, w.date_from, w.date_to);
      else await pickCategoryType(page, label);
      const s = await stats;
      checkStats(s, ct);
      await checkKpiCards(page, s);
      last = s;
    });
  }

  await test.step("Excel (Parapharmacie)", async () => {
    const x = await downloadXlsx(page, () => page.getByRole("button", { name: "Exporter Excel" }).click());
    expect(x.filename, "nom du fichier").toBe(`APCM - COMPTABILITE ${w.date_from} - ${w.date_to}.xlsx`);
    const cell = (label: string) => (x.rows as unknown[][]).find((r) => r[0] === label)?.[1];
    expect(cell("Type"), "type en français").toBe("Parapharmacie");
    expect(cell("Avec produits spéciaux")).toBe("Non");
    const want: [string, number][] = [
      ["Chiffre d'Affaires", last.kpis.ventes_total],
      ["Achats", last.kpis.achats_total],
      ["Marge %", last.marge.marge_pct],
      ["Marge brute (DH)", last.marge.marge_brute_dh],
      ["Marge nette (DH)", last.marge.marge_nette_dh],
      ["TVA encaissée", last.tva.tva_encaissee],
      ["TVA payée", last.tva.tva_payee],
      ["TVA à déclarer", last.tva.tva_a_declarer],
      ["Pharmacie", last.type_breakdown.pharmacie.ventes_total],
      ["Parapharmacie", last.type_breakdown.parapharmacie.ventes_total],
    ];
    for (const [label, value] of want) expect(cell(label), `Excel « ${label} »`).toBe(value);
  });
  checkLedgerPage("ventes", await ledger, expected().ventes_list, 1, 25);

  const page2 = pageCall(page, "/ventes", {
    ...period(w),
    page: "2",
    limit: "25",
    include_non_declared: "false",
  });
  await page.getByRole("button", { name: "Page suivante" }).click();
  checkLedgerPage("ventes", await page2, expected().ventes_list, 2, 25);

  await test.step("journal : tri par date (1er clic = décroissant, comme /ventes)", async () => {
    const sorted = pageCall(page, "/ventes", {
      ...period(w),
      sort_by: "date",
      sort_order: "desc",
      include_non_declared: "false",
    });
    await page.getByRole("columnheader", { name: "Date", exact: true }).getByRole("button").click();
    const s = await sorted;
    const dates = (s.data as Row[]).map((r) => r.date);
    expect(dates, "dates décroissantes").toEqual([...dates].sort().reverse());
    await expect(page.locator("table tbody tr").first()).toContainText(s.data[0].product);
    // The « Produit » cell = name + PID on a 2nd line: compare the name.
    const names = (await columnTexts(page, "Produit")).map((c) => c.split("\n")[0]);
    expect(names, "lignes affichées = ordre de l'API").toEqual((s.data as Row[]).map((r) => r.product));
  });

  const withSpecial = pageCall(page, "/stats", {
    ...period(w),
    category_type: "parapharmacie",
    include_non_declared: "true",
  });
  await page
    .getByRole("checkbox", {
      name: "Inclure les produits spéciaux dans les KPI",
    })
    .check();
  checkStats(await withSpecial, "parapharmacie");
});

test("comptabilité : modes de paiement — créer, modifier, 2ᵉ mode, supprimer", async ({ page }) => {
  const month = thisMonth();
  const list0 = pageCall(page, "/accounting/payments", { month });
  await open(page);
  expect(await list0, `aucun paiement en ${month}`).toEqual([]);

  const tpe1 = {
    pharmacie_amount: 12500.5,
    parapharmacie_amount: 3400.25,
    count: 87,
  };
  const created = await savePayment(page, /^TPE/, tpe1);
  const tpe = { month, method: "tpe", ...tpe1 };
  expectSame(created.saved, tpe, "POST tpe (création)");
  expectSame(created.list, [tpe], "paiements après création");
  await expect(page.getByRole("button", { name: /^TPE/ })).toContainText("87 transactions");

  const tpe2 = {
    pharmacie_amount: 13000,
    parapharmacie_amount: 3000.75,
    count: 90,
  };
  const edited = await savePayment(page, /^TPE/, tpe2);
  expectSame(
    edited.saved,
    { id: created.saved.id, month, method: "tpe", ...tpe2 },
    "POST tpe (modification = même ligne)",
  );
  expectSame(edited.list, [{ ...tpe, ...tpe2 }], "paiements après modification");

  const esp1 = {
    pharmacie_amount: 8000,
    parapharmacie_amount: 1200.4,
    count: 42,
  };
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

  await test.step("autre mois : champ Mois du dialogue + sélecteur du mois de la page", async () => {
    const other = otherMonth(month);
    const short = MONTHS_SHORT[Number(other.slice(5)) - 1];
    // Dialog: change its month, save → stored under that month; this month's cards don't change.
    await page.getByRole("button", { name: /^Chèques/ }).click();
    const dialog = page.getByRole("dialog");
    // Inside the « Mois » field the button is named by its label; its text is the month.
    const monthButton = dialog.getByRole("button", {
      name: "Mois",
      exact: true,
    });
    await expect(monthButton).toHaveText(monthLabel(month));
    await monthButton.click();
    // The months open on top of the page (over the dialog, never cut by it).
    await page.locator('[data-list="months"]').getByRole("button", { name: short, exact: true }).click();
    await dialog.getByLabel("Pharmacie (MAD)", { exact: true }).fill("500");
    await dialog.getByLabel("Parapharmacie (MAD)", { exact: true }).fill("250.5");
    await dialog.getByLabel("Nombre de transactions", { exact: true }).fill("3");
    const saved = pageSend(page, "POST", "/accounting/payments");
    await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();
    const chq = {
      month: other,
      method: "cheques",
      pharmacie_amount: 500,
      parapharmacie_amount: 250.5,
      count: 3,
    };
    const c = await saved;
    expectSame(c, chq, "POST chèques (autre mois)");
    await expect(page.getByRole("button", { name: /^Chèques/ })).toContainText("Ajouter");

    // Page picker → that month: only the cheque; delete it to leave the data as found.
    const otherList = pageCall(page, "/accounting/payments", { month: other });
    await page.getByRole("button", { name: monthLabel(month), exact: true }).click();
    await page.getByRole("button", { name: short, exact: true }).click();
    expectSame(await otherList, [chq], `paiements de ${other}`);
    await expect(page.getByRole("button", { name: /^Chèques/ })).toContainText("3 transactions");
    await page.getByRole("button", { name: /^Chèques/ }).click();
    const gone = pageSend(page, "DELETE", `/accounting/payments/${c.id}`, 204);
    await page.getByRole("dialog").getByRole("button", { name: "Supprimer", exact: true }).click();
    expect(await gone, "DELETE chèques").toBeNull();
    // The page picker back to this month.
    await page.getByRole("button", { name: monthLabel(other), exact: true }).click();
    await page.getByRole("button", { name: MONTHS_SHORT[Number(month.slice(5)) - 1], exact: true }).click();
    await expect(page.getByRole("button", { name: monthLabel(month), exact: true })).toBeVisible();
  });
});
