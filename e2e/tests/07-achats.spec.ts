/** Achats: every call the page makes, every field.
 *  List (page 1 + 2), categories, TVA rates, grossistes / direct labo gauge,
 *  every sortable column (desc + asc), search + suggestions, category / TVA
 *  filters, and the Excel export (all rows of the period). */
import type { Page } from "@playwright/test";

import { sessionFile } from "../lib/auth";
import * as XLSX from "xlsx";

import {
  checkLedgerScreen,
  checkTileValues,
  checkLedgerPage,
  checkLedgerRows,
  checkSortPage,
  subsetSummary,
  type Row,
} from "../lib/checks";
import { expectSame } from "../lib/diff";
import { expected, testWindow } from "../lib/expected";
import { expect, recordCall, test } from "../lib/fixtures";
import { frNumber, pageCall, period, setPeriod } from "../lib/ui";

test.use({ storageState: sessionFile("owner") });

const SORTABLE = [
  ["delivery_date", "Date BL"],
  ["delivery_ref", "Référence"],
  ["supplier", "Fournisseur"],
  ["product", "Produit"],
  ["category", "Catégorie"],
  ["quantity", "Qté"],
  ["pph", "PPH"],
  ["unit_price", "PU (achat)"],
  ["expiry_date", "Péremption"],
  ["total", "Total"],
] as const;

/** Footer « … (filtres actifs) : X · … : Y » = the list summary (all filtered rows). */
async function checkFooter(
  page: Page,
  first: string,
  values: number[],
): Promise<void> {
  const nums = page
    .locator("div")
    .filter({ hasText: new RegExp(`^${first}`) })
    .last()
    .locator("span.font-mono");
  await expect
    .poll(
      async () =>
        (await nums.allInnerTexts())
          .map(frNumber)
          .map((v, i) => Math.abs((v ?? NaN) - values[i]) <= 0.011),
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
      : [
          `ligne ${i + 1}: ${JSON.stringify(sheet[i + 1])} ≠ ${JSON.stringify(r)}`,
        ],
  );
  expect(bad.slice(0, 10), "cellules").toEqual([]);
}

async function open(page: Page): Promise<void> {
  await page.goto("/achats");
  await expect(
    page.getByRole("heading", { level: 1, name: "Achats", exact: true }),
  ).toBeVisible();
}

async function openWithPeriod(page: Page): Promise<Row> {
  await open(page);
  const list = pageCall(page, "/achats", {
    ...period(testWindow()),
    page: "1",
  });
  await setPeriod(page, testWindow().date_from, testWindow().date_to);
  return list;
}

test("achats: liste, pagination, catégories, TVA, grossistes / direct labo", async ({
  page,
}) => {
  const e = expected();
  const w = testWindow();
  const cats = pageCall(page, "/achats/categories");
  const tvas = pageCall(page, "/achats/tva-rates");
  await open(page);
  expect(await cats, "catégories").toEqual(e.achats_categories);
  expect(await tvas, "taux de TVA").toEqual(e.achats_tva_rates);

  const list = pageCall(page, "/achats", { ...period(w), page: "1" });
  const suppliers = pageCall(page, "/achats/supplier-summary", period(w));
  await setPeriod(page, w.date_from, w.date_to);
  const l1 = await list;
  checkLedgerPage("achats", l1, e.achats_list, 1);
  expectSame(await suppliers, e.supplier_summary, "grossistes / direct labo");

  await test.step("à l'écran : tableau, jauge, pied", async () => {
    await checkLedgerScreen(page, "achats", l1.data);
    const g = e.supplier_summary.grossiste,
      d = e.supplier_summary.direct_labo;
    await checkTileValues(
      page,
      [
        ["Grossistes", g.total_mad],
        ["Direct laboratoire", d.total_mad],
        ["Somme commandée", g.total_mad + d.total_mad],
        ["BL", g.bl_count + d.bl_count],
        ["Unités", g.unit_count + d.unit_count],
      ],
      "jauge grossistes",
    );
    await checkFooter(page, "TVA payé", [
      l1.summary.tva_payee,
      l1.summary.grand_total,
    ]);
  });

  const page2 = pageCall(page, "/achats", { ...period(w), page: "2" });
  await page.getByRole("button", { name: "Page suivante" }).click();
  const l2 = await page2;
  checkLedgerPage("achats", l2, e.achats_list, 2);
  await checkLedgerScreen(page, "achats", l2.data);
});

test("achats: tri de chaque colonne (desc puis asc)", async ({ page }) => {
  await openWithPeriod(page);
  for (const [key, label] of SORTABLE) {
    for (const order of ["desc", "asc"] as const) {
      await test.step(`${label} ${order}`, async () => {
        const list = pageCall(page, "/achats", {
          ...period(testWindow()),
          sort_by: key,
          sort_order: order,
        });
        await page
          .getByRole("columnheader", { name: label, exact: true })
          .getByRole("button")
          .click();
        checkSortPage("achats", await list, key, order);
      });
    }
  }
});

test("achats: recherche + suggestions", async ({ page }) => {
  await openWithPeriod(page);
  const box = page.getByPlaceholder("Produit, fournisseur, référence…");
  for (const [q, summary] of Object.entries<Row>(expected().search.achats)) {
    await test.step(q, async () => {
      const list = pageCall(page, "/achats", {
        ...period(testWindow()),
        search: q,
      });
      const suggest = pageCall(page, "/achats/suggestions", { q });
      await box.fill(q);
      checkLedgerPage("achats", await list, summary, 1);
      const s = await suggest;
      expect(
        {
          products: [...s.products].sort(),
          suppliers: [...s.suppliers].sort(),
          refs: [...s.refs].sort(),
        },
        `suggestions « ${q} »`,
      ).toEqual(expected().suggestions.achats[q]);
    });
  }
});

test("achats: filtre catégorie « Médicament »", async ({ page }) => {
  await openWithPeriod(page);
  const list = pageCall(page, "/achats", {
    ...period(testWindow()),
    category: "Médicament",
  });
  await page.getByRole("button", { name: "Catégorie" }).first().click();
  await page.getByRole("checkbox", { name: "Médicament", exact: true }).check();
  checkLedgerPage(
    "achats",
    await list,
    subsetSummary("achats", (r) =>
      r.category.toLowerCase().startsWith("médicament"),
    ),
    1,
  );
});

test("achats: filtre TVA « TVA (20.00%) »", async ({ page }) => {
  await openWithPeriod(page);
  const list = pageCall(page, "/achats", {
    ...period(testWindow()),
    tva: "TVA (20.00%)",
  });
  await page.getByRole("button", { name: "TVA", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "TVA (20.00%)", exact: true })
    .check();
  checkLedgerPage(
    "achats",
    await list,
    subsetSummary("achats", (r) => r.tva === "TVA (20.00%)"),
    1,
  );
});

test("achats: export Excel — toutes les lignes de la période", async ({
  page,
}) => {
  await openWithPeriod(page);
  const total = expected().achats_list.rows_total;
  const exported = page.waitForResponse(
    (r) => r.url().includes("/v1/achats?") && r.url().includes("export=true"),
  );
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
    path: "achats/export",
    status: 200,
    ms: Date.now() - t0,
    source: "flow",
    test: "achats export",
  });
  const data: Row[] = (await res.json()).data;
  checkLedgerRows("achats", data, expected().achats_rows);
  const type = (c: string | null) =>
    c === "pharmacie"
      ? "Pharmacie"
      : c === "parapharmacie"
        ? "Parapharmacie"
        : "";
  await checkXlsx(
    path!,
    [
      "Date BL",
      "Référence",
      "Fournisseur",
      "Produit",
      "Catégorie",
      "Type",
      "TVA",
      "Qté",
      "PPH",
      "PU achat",
      "Péremption",
      "Total",
    ],
    data.map((r) => [
      r.delivery_date ?? "",
      r.delivery_ref_final ?? r.delivery_ref ?? "",
      r.supplier ?? "",
      r.product ?? "",
      r.category ?? "",
      type(r.category_type),
      r.tva ?? "",
      r.quantity ?? 0,
      r.pph ?? 0,
      r.unit_price ?? 0,
      r.expiry_date ?? "",
      r.total ?? 0,
    ]),
    `APCM - ACHAT ${testWindow().date_from} - ${testWindow().date_to}.xlsx`,
    file!.suggestedFilename(),
  );
});
