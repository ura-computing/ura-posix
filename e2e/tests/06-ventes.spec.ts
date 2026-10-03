/** Ventes: every call the page makes, every field.
 *  List (page 1 + 2), categories, TVA rates, surveillance counts + each tab,
 *  remise gauge, every sortable column (desc + asc), search + suggestions,
 *  category / TVA filters, and the Excel export (all rows of the period). */
import type { Page } from "@playwright/test";

import { sessionFile } from "../lib/auth";
import * as XLSX from "xlsx";

import {
  checkLedgerPage,
  checkLedgerRows,
  checkLedgerScreen,
  checkSortPage,
  checkTileValues,
  subsetSummary,
  type Row,
} from "../lib/checks";
import { expectSame } from "../lib/diff";
import { expected, testWindow } from "../lib/expected";
import { expect, recordCall, test } from "../lib/fixtures";
import { frNumber, pageCall, period, setPeriod } from "../lib/ui";

test.use({ storageState: sessionFile("owner") });

const SORTABLE = [
  ["date", "Date"],
  ["transaction_ref", "N° Transaction"],
  ["client", "Client"],
  ["product", "Produit"],
  ["category", "Catégorie"],
  ["quantity", "Qté"],
  ["discount", "Remise"],
  ["ppv", "PPV"],
  ["total", "Total"],
  ["marge_pct", "Marge %"],
  ["marge_dh", "Marge DH"],
] as const;

const TABS = [
  ["all_flagged", /^Ventes à surveiller/],
  ["marge_negative", /^Marge négative/],
  ["marge_low", /^Marge < 10 %/],
  ["remises_high", /^Remise > 20 %/],
] as const;

/** Footer « … (filtres actifs) : X · … : Y » = the list summary (all filtered rows). */
async function checkFooter(page: Page, first: string, values: number[]): Promise<void> {
  const nums = page
    .locator("div")
    .filter({ hasText: new RegExp(`^${first}`) })
    .last()
    .locator("span.font-mono");
  await expect
    .poll(
      async () => (await nums.allInnerTexts()).map(frNumber).map((v, i) => Math.abs((v ?? NaN) - values[i]) <= 0.011),
      `pied de tableau ${values}`,
    )
    .toEqual(values.map(() => true));
}

/** The downloaded .xlsx = the export answer, row by row (same mapping as the page). */
async function checkXlsx(
  path: string,
  header: string[],
  rows: unknown[][],
  filename: string,
  shown: string,
): Promise<void> {
  expect(shown, "nom du fichier").toBe(filename);
  const wb = XLSX.readFile(path);
  const sheet = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
    defval: "",
  }) as unknown[][];
  expect(sheet[0], "en-têtes en français").toEqual(header);
  expect(sheet.length - 1, "nombre de lignes").toBe(rows.length);
  const bad = rows.flatMap((r, i) =>
    JSON.stringify(r) === JSON.stringify(sheet[i + 1])
      ? []
      : [`ligne ${i + 1}: ${JSON.stringify(sheet[i + 1])} ≠ ${JSON.stringify(r)}`],
  );
  expect(bad.slice(0, 10), "cellules").toEqual([]);
}

async function open(page: Page): Promise<void> {
  await page.goto("/ventes");
  await expect(page.getByRole("heading", { level: 1, name: "Ventes", exact: true })).toBeVisible();
}

/** Open /ventes and type the period; resolves with the page-1 list for it. */
async function openWithPeriod(page: Page): Promise<Row> {
  await open(page);
  const list = pageCall(page, "/ventes", {
    ...period(testWindow()),
    page: "1",
  });
  await setPeriod(page, testWindow().date_from, testWindow().date_to);
  return list;
}

test("ventes: liste, pagination, catégories, TVA, surveillance, remises", async ({ page }) => {
  const e = expected();
  const w = testWindow();
  const cats = pageCall(page, "/ventes/categories");
  const tvas = pageCall(page, "/ventes/tva-rates");
  await open(page);
  expect(await cats, "catégories").toEqual(e.ventes_categories);
  expect(await tvas, "taux de TVA").toEqual(e.ventes_tva_rates);

  const list = pageCall(page, "/ventes", { ...period(w), page: "1" });
  const counts = pageCall(page, "/ventes/surveillance-counts", period(w));
  const discount = pageCall(page, "/ventes/discount-summary", period(w));
  await setPeriod(page, w.date_from, w.date_to);
  const l1 = await list;
  checkLedgerPage("ventes", l1, e.ventes_list, 1);
  expectSame(await counts, e.surveillance_counts, "surveillance counts");
  expectSame(await discount, e.discount_summary, "remises");

  await test.step("à l'écran : tableau, jauge, onglets, pied", async () => {
    await checkLedgerScreen(page, "ventes", l1.data);
    const d = e.discount_summary;
    await checkTileValues(
      page,
      [
        ["Sans remise", d.full_price.total_mad],
        ["Avec remise", d.discounted.total_mad],
        ["CA total", d.full_price.total_mad + d.discounted.total_mad],
        ["Transactions", d.full_price.count + d.discounted.count],
        ["Unités", d.full_price.unit_count + d.discounted.unit_count],
      ],
      "jauge remises",
    );
    for (const [field, name] of TABS) {
      const digits = (await page.getByRole("button", { name }).innerText()).replace(/\D/g, "");
      expect(digits.endsWith(String(e.surveillance_counts[field])), `onglet ${name}: ${digits}`).toBe(true);
    }
    await checkFooter(page, "TVA encaissée", [l1.summary.tva_collected, l1.summary.grand_total]);
  });

  const page2 = pageCall(page, "/ventes", { ...period(w), page: "2" });
  await page.getByRole("button", { name: "Page suivante" }).click();
  const l2 = await page2;
  checkLedgerPage("ventes", l2, e.ventes_list, 2);
  await checkLedgerScreen(page, "ventes", l2.data);
});

test("ventes: filtres actifs — retirer la période, tout réinitialiser", async ({ page }) => {
  await openWithPeriod(page);
  const noDates = pageCall(page, "/ventes", {
    date_from: null,
    date_to: null,
    page: "1",
  });
  await page.getByRole("button", { name: "Supprimer le filtre" }).first().click(); // the « Période » chip
  const all = (await noDates).data;
  await checkLedgerScreen(page, "ventes", all); // whole history: screen = API answer
  const withCat = pageCall(page, "/ventes", { category: "Médicament" });
  await page.getByRole("button", { name: "Catégorie" }).first().click();
  await page.getByRole("checkbox", { name: "Médicament", exact: true }).check();
  await withCat;
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Tout réinitialiser" }).click();
  await expect(page.getByRole("button", { name: "Supprimer le filtre" }), "plus aucun filtre").toHaveCount(0);
  await checkLedgerScreen(page, "ventes", all); // back to the no-filter list
});

test("ventes: onglets « à surveiller »", async ({ page }) => {
  await openWithPeriod(page);
  for (const [tab, name] of TABS) {
    await test.step(tab, async () => {
      const list = pageCall(page, "/ventes", {
        ...period(testWindow()),
        surveillance: tab,
      });
      await page.getByRole("button", { name }).click();
      checkLedgerPage("ventes", await list, expected().surveillance_lists[tab], 1);
    });
  }
});

test("ventes: tri de chaque colonne (desc puis asc)", async ({ page }) => {
  await openWithPeriod(page);
  for (const [key, label] of SORTABLE) {
    for (const order of ["desc", "asc"] as const) {
      await test.step(`${label} ${order}`, async () => {
        const list = pageCall(page, "/ventes", {
          ...period(testWindow()),
          sort_by: key,
          sort_order: order,
        });
        await page.getByRole("columnheader", { name: label, exact: true }).getByRole("button").click();
        checkSortPage("ventes", await list, key, order);
      });
    }
  }
});

test("ventes: recherche + suggestions", async ({ page }) => {
  await openWithPeriod(page);
  const box = page.getByPlaceholder("Produit, client, N° transaction…");
  for (const [q, summary] of Object.entries<Row>(expected().search.ventes)) {
    await test.step(q, async () => {
      const list = pageCall(page, "/ventes", {
        ...period(testWindow()),
        search: q,
      });
      const suggest = pageCall(page, "/ventes/suggestions", { q });
      await box.fill(q);
      checkLedgerPage("ventes", await list, summary, 1);
      const s = await suggest;
      expect(
        {
          products: [...s.products].sort(),
          clients: [...s.clients].sort(),
          refs: [...s.refs].sort(),
        },
        `suggestions « ${q} »`,
      ).toEqual(expected().suggestions.ventes[q]);
    });
  }
});

test("ventes: filtre catégorie « Médicament »", async ({ page }) => {
  await openWithPeriod(page);
  const list = pageCall(page, "/ventes", {
    ...period(testWindow()),
    category: "Médicament",
  });
  await page.getByRole("button", { name: "Catégorie" }).first().click();
  await page.getByRole("checkbox", { name: "Médicament", exact: true }).check();
  checkLedgerPage(
    "ventes",
    await list,
    subsetSummary("ventes", (r) => r.category.toLowerCase().startsWith("médicament")),
    1,
  );
});

test("ventes: filtre TVA « TVA (20.00%) »", async ({ page }) => {
  await openWithPeriod(page);
  const list = pageCall(page, "/ventes", {
    ...period(testWindow()),
    tva: "TVA (20.00%)",
  });
  await page.getByRole("button", { name: "TVA", exact: true }).click();
  await page.getByRole("checkbox", { name: "TVA (20.00%)", exact: true }).check();
  checkLedgerPage(
    "ventes",
    await list,
    subsetSummary("ventes", (r) => r.tva === "TVA (20.00%)"),
    1,
  );
});

test("ventes: export Excel — toutes les lignes de la période", async ({ page }) => {
  await openWithPeriod(page);
  const total = expected().ventes_list.rows_total;
  const exported = page.waitForResponse((r) => r.url().includes("/v1/ventes?") && r.url().includes("export=true"));
  const download = page.waitForEvent("download").catch(() => null); // none when the export is refused (413)
  const t0 = Date.now(); // timed: click → .xlsx written (speed gate)
  await page.getByRole("button", { name: "Exporter Excel" }).click();
  const res = await exported;
  if (total > 50_000) {
    // backend cap MAX_EXPORT_ROWS
    expect(res.status(), "export over 50 000 rows is refused").toBe(413);
    return;
  }
  expect(res.status()).toBe(200);
  const file = await download;
  const path = await file?.path();
  recordCall({
    method: "FLOW",
    path: "ventes/export",
    status: 200,
    ms: Date.now() - t0,
    source: "flow",
    test: "ventes export",
  });
  const data: Row[] = (await res.json()).data;
  checkLedgerRows("ventes", data, expected().ventes_rows);
  const type = (c: string | null) => (c === "pharmacie" ? "Pharmacie" : c === "parapharmacie" ? "Parapharmacie" : "");
  await checkXlsx(
    path!,
    [
      "Date",
      "N° transaction",
      "Client",
      "Produit",
      "Catégorie",
      "Type",
      "TVA",
      "PPV",
      "Qté",
      "Remise",
      "PU vente",
      "Sous-total",
      "PU moyen",
      "Total",
    ],
    data.map((r) => [
      r.date ?? "",
      r.transaction_ref_final ?? r.transaction_ref ?? "",
      r.client ?? "",
      r.product ?? "",
      r.category ?? "",
      type(r.category_type),
      r.tva ?? "",
      r.ppv ?? 0,
      r.quantity ?? 0,
      r.discount ?? 0,
      r.unit_price ?? 0,
      r.subtotal ?? 0,
      r.avg_pu ?? 0,
      r.total ?? 0,
    ]),
    `APCM - VENTE ${testWindow().date_from} - ${testWindow().date_to}.xlsx`,
    file!.suggestedFilename(),
  );
});
