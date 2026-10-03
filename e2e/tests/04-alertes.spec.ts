/** Alertes: on open (no period) → péremptions + ABCD default window; typed period
 *  → marge alerts, ventes sans achat, ABCD window; then Pharmacie / Parapharmacie
 *  (only marge alerts + ventes sans achat take the category). Every field.
 *  On screen (Mixte, typed period): the 6 summary chips, every card value, every
 *  card → its product list, the list's sort and its Excel file. */
import type { Page } from "@playwright/test";

import { sessionFile } from "../lib/auth";
import {
  CATEGORY_TYPES,
  checkMarginAlerts,
  checkPeremptions,
  checkStockAbcd,
  checkVentesSansAchat,
  type Row,
} from "../lib/checks";
import { testWindow } from "../lib/expected";
import { expect, test } from "../lib/fixtures";
import {
  columnTexts,
  downloadXlsx,
  frNumber,
  kpiValue,
  pageCall,
  period,
  pickCategoryType,
  setPeriod,
} from "../lib/ui";

const close = (got: number | null, want: number) =>
  got != null && Math.abs(got - want) <= 0.011;

/** Number under a label inside a card / chip (label span, value = next span). */
async function valueAfter(
  page: Page,
  label: string,
  within = page.locator("body"),
): Promise<number | null> {
  return frNumber(
    await within
      .getByText(label, { exact: true })
      .first()
      .locator("xpath=following-sibling::span[1]")
      .innerText(),
  );
}

/** Click a card → its dialog lists exactly these products; Escape closes it. */
async function checkList(
  page: Page,
  card: string,
  products: Row[],
): Promise<void> {
  if (products.length === 0) return; // empty card is disabled
  await page.getByText(card, { exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const names = await columnTexts(page, "Produit", dialog.locator("table"));
  expect([...names].sort(), `« ${card} » : produits`).toEqual(
    products.map((r) => r.product).sort(),
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
}

test.use({ storageState: sessionFile("owner") });

test("alertes: marges, ventes sans achat, péremptions, stock", async ({
  page,
}) => {
  const w = testWindow();
  const perem = pageCall(page, "/stats/peremptions");
  const abcdDefault = pageCall(page, "/stats/stock-abcd", {
    date_from: null,
    date_to: null,
  });
  await page.goto("/alertes");
  await expect(
    page.getByRole("heading", { level: 1, name: "Alertes", exact: true }),
  ).toBeVisible();
  checkPeremptions(await perem);
  checkStockAbcd(await abcdDefault, "default");

  for (const [i, { ct, label }] of CATEGORY_TYPES.entries()) {
    await test.step(label, async () => {
      const q = { ...period(w), category_type: ct };
      const margin = pageCall(page, "/stats/margin-alerts", q);
      const vsa = pageCall(page, "/stats/ventes-sans-achat", q);
      const abcd =
        i === 0 ? pageCall(page, "/stats/stock-abcd", period(w)) : null;
      if (i === 0) await setPeriod(page, w.date_from, w.date_to);
      else await pickCategoryType(page, label);
      const m = await margin;
      const v = await vsa;
      checkMarginAlerts(m, ct);
      checkVentesSansAchat(v, ct);
      if (abcd) {
        const s = await abcd;
        checkStockAbcd(s, "window");
        await checkScreen(page, m, v, await perem, s.products as Row[], w);
      }
    });
  }
});

/** Everything shown on /alertes for one state, vs the API answers (already = oracle). */
async function checkScreen(
  page: Page,
  m: Row,
  v: Row,
  p: Row,
  stock: Row[],
  w: { date_from: string; date_to: string },
): Promise<void> {
  const neg = stock.filter((r) => r.status === "negatif");
  const sous = stock.filter((r) => r.status === "sous-stock");
  const sur = stock.filter((r) => r.status === "sur-stock");

  await test.step("6 compteurs du haut", async () => {
    const total =
      m.negative.count +
      m.low.count +
      v.count +
      p.expired.count +
      p.very_close.count +
      p.close.count +
      neg.length +
      sous.length +
      sur.length;
    const chips: [string, number][] = [
      ["Alertes totales", total],
      ["Marges négatives", m.negative.count],
      ["Marges faibles", m.low.count],
      ["Péremptions critiques", p.expired.count + p.very_close.count],
      ["Stock à réapprovisionner", sous.length],
      ["Stock excessif", sur.length],
    ];
    // poll: the numbers of the previous period stay a moment after the API answer.
    for (const [label, want] of chips)
      await expect
        .poll(() => valueAfter(page, label), `« ${label} »`)
        .toBe(want);
  });

  await test.step("cartes : valeurs", async () => {
    const tiles: [string, number][] = [
      ["Ventes sans achat correspondant", v.total_ca],
      ["Marge négative", m.negative.total_ca],
      ["Marge faible (<10%)", m.low.total_ca],
    ];
    for (const [label, want] of tiles) {
      await expect
        .poll(
          async () =>
            close(frNumber(await kpiValue(page, label).innerText()), want),
          `« ${label} » = ${want}`,
        )
        .toBe(true);
    }
    const perem: [string, string][] = [
      ["Expirés", "expired"],
      ["Très proche (<30j)", "very_close"],
      ["Proche (<90j)", "close"],
      ["Sans date", "no_date"],
    ];
    for (const [label, key] of perem) {
      const card = page
        .getByText(label, { exact: true })
        .first()
        .locator("xpath=ancestor::*[contains(@class, 'rounded-2xl')][1]");
      await expect
        .poll(() => valueAfter(page, "Unités", card), `« ${label} » unités`)
        .toBe(p[key].total_units);
      await expect
        .poll(
          async () =>
            close(
              await valueAfter(page, "Valeur achat", card),
              p[key].purchase_value,
            ),
          `« ${label} » valeur achat = ${p[key].purchase_value}`,
        )
        .toBe(true);
    }
    const ppv = (rows: Row[], gap: (r: Row) => number) =>
      rows.reduce(
        (s, r) => (r.ppv != null ? s + r.ppv * Math.max(0, gap(r)) : s),
        0,
      );
    const stockTiles: [string, number][] = [
      [
        "Unités en négatif",
        neg.reduce(
          (s, r) =>
            s +
            (r.current_stock != null && r.current_stock < 0
              ? -r.current_stock
              : 0),
          0,
        ),
      ],
      ["PPV potentiel", ppv(sous, (r) => r.stock_min - (r.current_stock ?? 0))],
      ["PPV immobilisé", ppv(sur, (r) => (r.current_stock ?? 0) - r.stock_max)],
    ];
    for (const [label, want] of stockTiles) {
      await expect
        .poll(
          async () => close(await valueAfter(page, label), want),
          `« ${label} » = ${want}`,
        )
        .toBe(true);
    }
  });

  await test.step("chaque carte → sa liste", async () => {
    await checkList(page, "Ventes sans achat correspondant", v.products);
    await checkList(page, "Marge négative", m.negative.products);
    await checkList(page, "Marge faible (<10%)", m.low.products);
    await checkList(page, "Expirés", p.expired.products);
    await checkList(page, "Très proche (<30j)", p.very_close.products);
    await checkList(page, "Proche (<90j)", p.close.products);
    await checkList(page, "Sans date", p.no_date.products);
    await checkList(page, "Stock négatif", neg);
    await checkList(page, "Sous-stock", sous);
    await checkList(page, "Sur-stock", sur);
  });

  await test.step("liste : tri par Produit + Excel", async () => {
    const [card, rows] =
      sous.length > 1 ? ["Sous-stock", sous] : ["Sur-stock", sur];
    if (rows.length < 2) return;
    await page.getByText(card, { exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("columnheader", { name: "Produit", exact: true })
      .getByRole("button")
      .click();
    const names = await columnTexts(page, "Produit", dialog.locator("table"));
    expect(names, "tri Produit croissant").toEqual(
      [...names].sort((a, b) => a.localeCompare(b, "fr")),
    );
    const x = await downloadXlsx(page, () =>
      dialog.getByRole("button", { name: "Exporter Excel" }).click(),
    );
    expect(x.filename, "nom du fichier").toBe(
      `APCM - ALERTES ${card} ${w.date_from} - ${w.date_to}.xlsx`,
    );
    expect(x.rows[0][0], "1re colonne en français").toBe("Produit");
    expect(
      (x.rows[0] as string[]).filter((h) => /^[a-z]+\.[a-zA-Z]+$/.test(h)),
      "aucune clé brute",
    ).toEqual([]);
    expect(
      (x.rows.slice(1) as unknown[][]).map((r) => r[0]),
      "lignes = liste triée",
    ).toEqual(names);
    await page.keyboard.press("Escape");
  });
}
