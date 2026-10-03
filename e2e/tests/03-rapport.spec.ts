/** Tableau de bord: open /rapport, type the period, then Mixte → Pharmacie →
 *  Parapharmacie. Every field of /stats, /stats/margin-alerts and the
 *  « Optimisation » tile's /stats/analyse-marge (mode produit) is checked for
 *  each, plus the gain shown in the tile and /stats/stock-summary (loaded once).
 *  On screen, per segment: every tile value, the CA split + achats lines,
 *  santé financière, the categories table, the 4 alert tiles, the stock tiles.
 *  Then the CA tile link and the « analyse » CTA. The trend chart is SVG only
 *  (no number on screen): not checked. */
import type { Locator, Page } from "@playwright/test";

import { sessionFile } from "../lib/auth";
import {
  CATEGORY_TYPES,
  checkAnalyse,
  checkMarginAlerts,
  checkStats,
  checkStockSummary,
  type Row,
} from "../lib/checks";
import { testWindow } from "../lib/expected";
import { expect, recordCall, test } from "../lib/fixtures";
import {
  columnTexts,
  frNumber,
  pageCall,
  period,
  pickCategoryType,
  setPeriod,
} from "../lib/ui";

const close = (got: number | null, want: number | null) =>
  want == null ? got == null : got != null && Math.abs(got - want) <= 0.011;

/** The n-th tile with this label (« Chiffre d'affaires » is shown twice). */
const tile = (page: Page, label: string, n = 0): Locator =>
  page
    .getByText(label, { exact: true })
    .nth(n)
    .locator("xpath=ancestor::*[contains(@class, 'rounded-2xl')][1]");

/** poll: after a segment switch the old numbers stay a moment after the API answer. */
async function expectNumber(
  read: () => Promise<string>,
  want: number | null,
  what: string,
): Promise<void> {
  await expect
    .poll(async () => close(frNumber(await read()), want), `${what} = ${want}`)
    .toBe(true);
}

async function checkScreen(
  page: Page,
  s: Row,
  alerts: Row,
  stock: Row,
): Promise<void> {
  const k = s.kpis,
    adv = s.advanced_kpis,
    tva = s.tva,
    m = s.marge;
  const tiles: [string, number, number | null][] = [
    ["Chiffre d'affaires", 0, k.ventes_total],
    ["Total achats", 0, k.achats_total],
    ["Marge brute moyenne", 0, m.marge_pct],
    ["Transactions", 0, k.ventes_count],
    ["Ticket moyen", 0, adv.ticket_moyen],
    ["Moyenne / jour", 0, adv.vente_moyenne_par_jour],
    ["Meilleure journée", 0, adv.best_day_dh?.total ?? 0],
    ["Moins bonne journée", 0, adv.worst_day_dh?.total ?? 0],
    ["TVA encaissée (ventes)", 0, tva.tva_encaissee],
    ["TVA payée (achats)", 0, tva.tva_payee],
    ["TVA à déclarer", 0, tva.tva_a_declarer],
    ["Chiffre d'affaires", 1, k.ventes_total],
    ["Marge moyenne (%)", 0, m.marge_pct],
    ["Marge moyenne (DH)", 0, m.marge_brute_dh],
    ["Marge négative", 0, Math.abs(alerts.negative.total_margin_dh)],
    ["Marge 0 % à 10 %", 0, alerts.low.total_ca],
    ["Marge 60 % à 89,9 %", 0, alerts.high.total_ca],
    ["Marge supérieure à 90 %", 0, alerts.very_high.total_ca],
    ["Total références", 0, stock.total_references],
    ["PPV potentiel", 0, stock.ppv_potentiel],
    ["Santé du stock", 0, stock.health_pct],
  ];
  for (const [label, n, want] of tiles) {
    const value = tile(page, label, n)
      .locator("span.font-mono.font-bold:not(.rounded-full)")
      .first();
    await expectNumber(
      () => value.innerText(),
      want,
      `tuile « ${label} »${n ? ` (${n + 1}e)` : ""}`,
    );
  }

  // CA split (whole %, rounded) and purchase lines, under their tiles.
  const ca = k.ventes_total;
  const share = (v: number) => (ca ? Math.round((v / ca) * 100) : 0);
  const caText = tile(page, "Chiffre d'affaires");
  await expect(caText).toContainText(
    new RegExp(
      `Pharmacie\\s*${share(s.type_breakdown.pharmacie.ventes_total)}\\s*%`,
    ),
  );
  await expect(caText).toContainText(
    new RegExp(
      `Parapharmacie\\s*${share(s.type_breakdown.parapharmacie.ventes_total)}\\s*%`,
    ),
  );
  await expect
    .poll(
      async () =>
        frNumber(
          (await tile(page, "Total achats").innerText()).match(
            /([\d\s\u202f\u00a0]+)\s*lignes/,
          )?.[1] ?? null,
        ),
      "achats : lignes",
    )
    .toBe(k.achats_count);

  // Santé financière: marge brute / nette (label, value = next span).
  for (const [label, want] of [
    ["Marge brute", m.marge_brute_dh],
    ["Marge nette", m.marge_nette_dh],
  ] as const) {
    const value = page
      .getByText(label, { exact: true })
      .locator("xpath=following-sibling::span[1]");
    await expectNumber(
      () => value.innerText(),
      want,
      `santé financière « ${label} »`,
    );
  }

  // Top categories table: same order as the API, CA and marge % per row.
  const table = page
    .locator("table")
    .filter({
      has: page.getByRole("columnheader", { name: "Part", exact: true }),
    });
  const cats = s.top_categories as Row[];
  await expect
    .poll(() => columnTexts(page, "Catégorie", table), "catégories")
    .toEqual(cats.map((c) => c.category));
  const caCol = (await columnTexts(page, "CA (MAD)", table)).map(frNumber);
  const margeCol = (await columnTexts(page, "Marge %", table)).map(frNumber);
  cats.forEach((c, i) => {
    expect(
      close(caCol[i], c.total),
      `catégorie « ${c.category} » CA ${caCol[i]} ≠ ${c.total}`,
    ).toBe(true);
    expect(
      close(margeCol[i], c.marge_pct),
      `catégorie « ${c.category} » marge ${margeCol[i]} ≠ ${c.marge_pct}`,
    ).toBe(true);
  });
}

test.use({ storageState: sessionFile("owner") });

test("rapport: every indicator × Mixte / Pharmacie / Parapharmacie", async ({
  page,
}) => {
  const w = testWindow();
  // First load (no period yet = whole history), timed for the speed gate: goto → every call
  // answered → the sections (incl. the Optimisation tile) are on screen.
  const t0 = Date.now();
  const noPeriod = { category_type: "all", date_from: null, date_to: null };
  const first = Promise.all([
    pageCall(page, "/stats", noPeriod),
    pageCall(page, "/stats/margin-alerts", noPeriod),
    pageCall(page, "/stats/analyse-marge", { ...noPeriod, mode: "produit" }),
  ]);
  const stockCall = pageCall(page, "/stats/stock-summary");
  await page.goto("/rapport");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Tableau de bord",
      exact: true,
    }),
  ).toBeVisible();
  const stock = await stockCall;
  checkStockSummary(stock);
  await first;
  await expect(
    page.getByText("Optimisation", { exact: true }).first(),
  ).toBeVisible();
  recordCall({
    method: "FLOW",
    path: "rapport/first-load",
    status: 200,
    ms: Date.now() - t0,
    source: "flow",
    test: "rapport first load",
  });

  for (const [i, { ct, label }] of CATEGORY_TYPES.entries()) {
    await test.step(label, async () => {
      const q = { ...period(w), category_type: ct };
      const stats = pageCall(page, "/stats", q);
      const alerts = pageCall(page, "/stats/margin-alerts", q);
      const optim = pageCall(page, "/stats/analyse-marge", {
        ...q,
        mode: "produit",
      });
      if (i === 0) await setPeriod(page, w.date_from, w.date_to);
      else await pickCategoryType(page, label);
      const s = await stats;
      const al = await alerts;
      checkStats(s, ct);
      checkMarginAlerts(al, ct);
      const a = await optim;
      checkAnalyse(a, ct, "produit"); // gain ∈ the oracle's tied values
      // The tile shows that gain: compare its digits (French format: « 12 345,60 MAD »).
      const gain: number = a.kpis.difference_gain_dh;
      const tile = page
        .getByText("Écart meilleur ↔ pire produit", { exact: true })
        .locator("xpath=ancestor::*[contains(@class, 'rounded-2xl')][1]");
      const digits = async () =>
        ((await tile.textContent()) ?? "").replace(/\D/g, "");
      await expect
        .poll(digits, `Optimisation affichée (${gain})`)
        .toBe(String(Math.round(Math.abs(gain) * 100)));
      await checkScreen(page, s, al, stock);
    });
  }

  await test.step("liens : tuile CA → Comptabilité, CTA → Analyses", async () => {
    await tile(page, "Chiffre d'affaires").click();
    await expect(page).toHaveURL(/\/comptabilite$/);
    await page.goBack();
    await page.getByRole("link", { name: "Créer une analyse" }).click();
    await expect(page).toHaveURL(/\/analyses$/);
  });
});
