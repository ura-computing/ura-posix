/** Analyses (/analyses) — every feature, through the page:
 *  - every tab × Mixte / Pharmacie / Parapharmacie: rows + KPIs vs the oracle, and the
 *    8 KPI tiles on screen;
 *  - Produit table: sort of every column (desc + asc, over ALL rows), pagination
 *    (next page, 50 / page), results count;
 *  - search box (in the browser): rows, KPI tiles, suggestions, picking one, « Tout
 *    réinitialiser »; Année: the box filters the sales by product (server side);
 *  - filter chips (remove the category, remove the period);
 *  - Excel export of every tab (file name, sheet, French headers, every cell);
 *  - Liste: « Importer une liste » button, status line, rows + tiles, × Pharmacie /
 *    Parapharmacie, Excel, a file with no product. */
import { basename, resolve } from "node:path";
import type { Page } from "@playwright/test";

import { sessionFile } from "../lib/auth";
import {
  ANALYSE_MODES,
  CATEGORY_TYPES,
  checkAnalyse,
  checkKpiTiles,
  checkListe,
  type AnalyseMode,
  type Row,
} from "../lib/checks";
import { expected, testWindow } from "../lib/expected";
import { expect, test } from "../lib/fixtures";
import { REPO_DIR } from "../lib/paths";
import {
  columnTexts,
  downloadXlsx,
  frNumber,
  pageCall,
  pagePost,
  period,
  pickCategoryType,
  resultsCount,
  setPeriod,
} from "../lib/ui";

test.use({ storageState: sessionFile("owner") });

const OTHER_MODES = [
  "categorie",
  "laboratoire",
  "grossiste",
  "operateur",
  "mois",
  "annee",
] as const;
const SEARCH_PH = "Rechercher dans les résultats…";

async function open(page: Page): Promise<void> {
  await page.goto("/analyses");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Analyse de marge",
      exact: true,
    }),
  ).toBeVisible();
}

const call = (page: Page, mode: string, ct: string) =>
  pageCall(page, "/stats/analyse-marge", {
    mode,
    ...period(testWindow()),
    category_type: ct,
  });

/** Open /analyses, type the period → the Produit × Mixte answer (checked vs the oracle). */
async function openWithPeriod(page: Page): Promise<Row> {
  await open(page);
  const produit = call(page, "produit", "all");
  await setPeriod(page, testWindow().date_from, testWindow().date_to);
  const a = await produit;
  checkAnalyse(a, "all", "produit");
  return a;
}

/** Same, plus the no-period answer the page loaded first. TanStack keeps it cached: clearing
 *  the period later shows it again WITHOUT a new request. */
async function openWithPeriodAndDefault(
  page: Page,
): Promise<{ a: Row; noDates: Row }> {
  const first = pageCall(page, "/stats/analyse-marge", {
    mode: "produit",
    category_type: "all",
    date_from: null,
    date_to: null,
  });
  await open(page);
  const noDates = await first;
  const produit = call(page, "produit", "all");
  await setPeriod(page, testWindow().date_from, testWindow().date_to);
  const a = await produit;
  checkAnalyse(a, "all", "produit");
  return { a, noDates };
}

async function openTab(
  page: Page,
  mode: AnalyseMode,
  ct: string,
): Promise<Row> {
  const res = call(page, mode, ct);
  await page
    .getByRole("tab", { name: ANALYSE_MODES[mode].tab, exact: true })
    .click();
  return res;
}

// ── What the Produit table shows (constants.tsx: render + raw) ──────────────

const PRODUIT_COLS: [string, string][] = [
  ["Produit", "product"],
  ["Catégorie", "category"],
  ["TVA", "tva"],
  ["Stock", "stock_dispo"],
  ["Qté vendue", "qty"],
  ["CA", "ca"],
  ["PU min", "prix_min"],
  ["PU moy", "prix_avg"],
  ["PU max", "prix_max"],
  ["PPV", "ppv"],
  ["Marge %", "marge_pct"],
  ["Marge DH", "marge_dh"],
];
const TEXT = new Set(["product", "category", "tva"]);
const shown = (r: Row, f: string): string | number | null =>
  TEXT.has(f)
    ? (r[f] ?? "—")
    : f === "qty" || f === "ca"
      ? (r[f] ?? 0)
      : f.startsWith("prix_")
        ? r[f] || null
        : (r[f] ?? null);
const raw = (r: Row, f: string): string | number | null =>
  TEXT.has(f)
    ? (r[f] ?? "")
    : f === "qty" || f === "ca"
      ? (r[f] ?? 0)
      : (r[f] ?? null);

/** The sort the page must do: the WHOLE row set, empties last in both directions. */
function sortedRows(rows: Row[], f: string, order: "asc" | "desc"): Row[] {
  const dir = order === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = raw(a, f),
      vb = raw(b, f);
    const ae = va === null || va === "",
      be = vb === null || vb === "";
    if (ae || be) return Number(ae) - Number(be);
    if (typeof va === "number" && typeof vb === "number")
      return (va - vb) * dir;
    return String(va).localeCompare(String(vb), "fr") * dir;
  });
}

/** The column `header` shows `rows` (in that order) on the current page. */
async function expectColumn(
  page: Page,
  header: string,
  field: string,
  rows: Row[],
): Promise<void> {
  const want = rows.map((r) => shown(r, field));
  const same = (got: string[]) =>
    got.length === want.length &&
    got.every((t, i) =>
      typeof want[i] === "string"
        ? t.trim() === want[i]
        : (() => {
            const n = frNumber(t),
              w = want[i] as number | null;
            return n === null || w === null
              ? n === w
              : Math.abs(n - w) <= 0.006;
          })(),
    );
  const ok = await expect
    .poll(async () => same(await columnTexts(page, header)), {
      timeout: 10_000,
    })
    .toBe(true)
    .then(
      () => true,
      () => false,
    );
  if (!ok)
    expect(await columnTexts(page, header), `colonne « ${header} »`).toEqual(
      want.map(String),
    );
}

const headerButton = (page: Page, label: string) =>
  page
    .locator("table thead")
    .getByRole("button", {
      name: new RegExp(
        `^${label.replace(/[.*+?^${}()|[\]\\%]/g, "\\$&")}$`,
        "i",
      ),
    });

// ── Excel export (constants.tsx EXPORT_COLS: old-app headers) ───────────────

type Col = [string, (r: Row) => unknown];
const MONTHS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Août",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];
const AGG_TAIL: Col[] = [
  ["Prix max", (r) => r.prix_max],
  ["Prix min", (r) => r.prix_min],
  ["Prix moy.", (r) => r.prix_avg],
  ["Marge % moy.", (r) => r.marge_pct_avg],
  ["Marge DH moy.", (r) => r.marge_dh_avg],
  ["Qté", (r) => r.qty ?? 0],
  ["CA (MAD)", (r) => r.ca ?? 0],
];
const COUNTS: Col[] = [
  ["Transactions", (r) => r.nb_transactions ?? 0],
  ["Qté", (r) => r.qty ?? 0],
  ["CA (MAD)", (r) => r.ca ?? 0],
];
const EXPORT: Record<AnalyseMode | "liste", Col[]> = {
  produit: [
    ["Produit", (r) => r.product ?? ""],
    ["Stock dispo", (r) => r.stock_dispo],
    ["Vente total unit", (r) => r.qty ?? 0],
    ["Vente total DH", (r) => r.ca ?? 0],
    ["Prix unit +", (r) => r.prix_max],
    ["Prix unit -", (r) => r.prix_min],
    ["Prix unit X", (r) => r.prix_avg],
    ["PPV", (r) => r.ppv],
    ["Marge% X", (r) => r.marge_pct],
    ["Marge DH X", (r) => r.marge_dh],
    ["Catégorie", (r) => r.category ?? ""],
    ["TVA", (r) => r.tva ?? ""],
  ],
  categorie: [["Catégorie", (r) => r.category ?? ""], ...AGG_TAIL],
  grossiste: [["Grossiste", (r) => r.grossiste ?? ""], ...AGG_TAIL],
  laboratoire: [["Laboratoire", (r) => r.laboratoire ?? ""], ...AGG_TAIL],
  operateur: [["Opérateur / Client", (r) => r.client ?? ""], ...COUNTS],
  mois: [["Mois", (r) => r.mois ?? ""], ...COUNTS],
  annee: [
    ["Année", (r) => r.annee ?? ""],
    ...MONTHS.flatMap((m, i): Col[] => {
      const k = `m${String(i + 1).padStart(2, "0")}`;
      return [
        [`${m} (Qty)`, (r) => r[k]?.qty ?? 0],
        [`${m} (CA)`, (r) => r[k]?.ca ?? 0],
      ];
    }),
    ["Total Qté", (r) => r.qty ?? 0],
    ["Total CA", (r) => r.ca ?? 0],
  ],
  liste: [
    [
      "Statut",
      (r) =>
        r.match_status === "found"
          ? "Trouvé"
          : r.match_status === "not_found"
            ? "Introuvable"
            : "",
    ],
    ["Produit", (r) => r.product ?? ""],
    ["Stock dispo", (r) => r.stock_dispo],
    ["Ventes", (r) => r.qty ?? 0],
    ["PPV", (r) => r.ppv],
    ["PU moy.", (r) => r.pu],
    ["Marge %", (r) => r.marge_pct],
    ["Marge DH", (r) => r.marge_dh],
    ["Catégorie", (r) => r.category ?? ""],
  ],
};

/** « Exporter Excel » → APCM - ANALYSE <MODE> <from> - <to>.xlsx, sheet « Analyse »,
 *  French headers, one line per row in the page's order, every cell = the row's value. */
async function checkExport(
  page: Page,
  mode: AnalyseMode | "liste",
  rows: Row[],
): Promise<void> {
  const w = testWindow();
  const x = await downloadXlsx(page, () =>
    page.getByRole("button", { name: "Exporter Excel" }).click(),
  );
  expect(x.filename, "nom du fichier").toBe(
    `APCM - ANALYSE ${mode.toUpperCase()} ${w.date_from} - ${w.date_to}.xlsx`,
  );
  expect(x.sheet, "feuille").toBe("Analyse");
  expect(x.rows[0], `${mode}: en-têtes`).toEqual(
    EXPORT[mode].map(([label]) => label),
  );
  expect(x.rows.slice(1), `${mode}: cellules`).toEqual(
    rows.map((r) => EXPORT[mode].map(([, v]) => v(r) ?? "")),
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

test("analyses: chaque onglet × Mixte / Pharmacie / Parapharmacie (lignes, KPI, tuiles à l'écran)", async ({
  page,
}) => {
  const w = testWindow();
  await open(page);
  for (const [i, { ct, label }] of CATEGORY_TYPES.entries()) {
    await test.step(label, async () => {
      // Back on Produit first (already cached for the previous category → no request).
      if (i > 0)
        await page.getByRole("tab", { name: "Produit", exact: true }).click();
      const produit = call(page, "produit", ct);
      if (i === 0) await setPeriod(page, w.date_from, w.date_to);
      else await pickCategoryType(page, label);
      const p = await produit;
      checkAnalyse(p, ct, "produit");
      await checkKpiTiles(page, p.kpis);
      for (const mode of OTHER_MODES) {
        await test.step(ANALYSE_MODES[mode].tab, async () => {
          const a = await openTab(page, mode, ct);
          checkAnalyse(a, ct, mode);
          await checkKpiTiles(page, a.kpis);
        });
      }
    });
  }
});

test("analyses: Produit — pagination (suivante, 50 / page) et nombre de résultats", async ({
  page,
}) => {
  const rows = (await openWithPeriod(page)).rows as Row[];
  await expect
    .poll(() => resultsCount(page), "nombre de résultats")
    .toBe(rows.length);
  await expectColumn(page, "Produit", "product", rows.slice(0, 25));
  await page.getByRole("button", { name: "Page suivante" }).click();
  await expectColumn(page, "Produit", "product", rows.slice(25, 50));
  await page.getByRole("button", { name: "25 / page" }).click();
  await page.getByRole("button", { name: "50 / page", exact: true }).click();
  await expectColumn(page, "Produit", "product", rows.slice(0, 50)); // back on page 1
});

test("analyses: Produit — tri de chaque colonne (desc puis asc), sur toutes les lignes", async ({
  page,
}) => {
  const rows = (await openWithPeriod(page)).rows as Row[];
  for (const [header, field] of PRODUIT_COLS) {
    await test.step(header, async () => {
      for (const order of ["desc", "asc"] as const) {
        await headerButton(page, header).click();
        await expectColumn(
          page,
          header,
          field,
          sortedRows(rows, field, order).slice(0, 25),
        );
      }
    });
  }
});

test("analyses: recherche (Produit × Mixte) — lignes, tuiles, suggestions, choix, tout réinitialiser", async ({
  page,
}) => {
  const { noDates } = await openWithPeriodAndDefault(page);
  const box = page.getByPlaceholder(SEARCH_PH);
  const dropdown = box.locator("xpath=following-sibling::div[1]");
  for (const [q, e] of Object.entries<Row>(expected().analyse_search)) {
    await test.step(q, async () => {
      await box.fill(q);
      if (e.suggestions.length) {
        await expect
          .poll(
            async () =>
              (await dropdown.getByRole("button").allInnerTexts()).sort(),
            "suggestions",
          )
          .toEqual(e.suggestions);
      } else {
        await expect(dropdown, "aucune suggestion").toContainText(
          "Aucun résultat",
        );
      }
      await page.getByRole("heading", { level: 1 }).click(); // close the dropdown
      if (e.rows.length) {
        await expect
          .poll(() => resultsCount(page), "lignes trouvées")
          .toBe(e.rows.length);
        const want = new Set((e.rows as Row[]).map((r) => r.product));
        expect(
          (await columnTexts(page, "Produit")).every((p) => want.has(p)),
          "chaque ligne correspond",
        ).toBe(true);
      } else {
        await expect(
          page.getByText("Aucun résultat").first(),
          "tableau vide",
        ).toBeVisible();
      }
      await checkKpiTiles(page, e.kpis, e.ties.difference_gain_dh);
    });
  }

  await test.step("choisir une suggestion", async () => {
    const pick = expected().analyse_search["00*42"].suggestions[0];
    await box.fill("00*42");
    await dropdown.getByRole("button", { name: pick, exact: true }).click();
    await expect(box).toHaveValue(pick);
    await expectColumn(page, "Produit", "product", [{ product: pick }]);
  });

  await test.step("tout réinitialiser → plus de recherche ni de période", async () => {
    await page.getByRole("button", { name: "Tout réinitialiser" }).click();
    await expect(box).toHaveValue("");
    await expect
      .poll(() => resultsCount(page), "lignes sans période (en cache)")
      .toBe(noDates.rows.length);
    await expect(
      page.locator("span.rounded-full").filter({ hasText: "Période :" }),
    ).toHaveCount(0);
  });
});

test("analyses: Année — la recherche filtre les ventes par produit (côté serveur)", async ({
  page,
}) => {
  await openWithPeriod(page);
  const annee = await openTab(page, "annee", "all");
  checkAnalyse(annee, "all", "annee");
  const e = expected().analyse_annee_product;
  const filtered = pageCall(page, "/stats/analyse-marge", {
    mode: "annee",
    ...period(testWindow()),
    category_type: "all",
    product: e.q,
  });
  await page.getByPlaceholder(SEARCH_PH).fill(e.q);
  const a = await filtered;
  checkAnalyse(a, "all", "annee", e, `analyse annee « ${e.q} »`);
  await checkKpiTiles(page, a.kpis);
});

test("analyses: puces de filtre — retirer la catégorie, retirer la période", async ({
  page,
}) => {
  const { noDates } = await openWithPeriodAndDefault(page);
  const chip = (start: string) =>
    page.locator("span.rounded-full").filter({ hasText: start });
  const pharma = call(page, "produit", "pharmacie");
  await pickCategoryType(page, "Pharmacie");
  checkAnalyse(await pharma, "pharmacie", "produit");
  await expect(chip("Catégorie :")).toContainText("Pharmacie");

  await chip("Catégorie :")
    .getByRole("button", { name: "Supprimer le filtre" })
    .click(); // Mixte again (cached)
  await expect(chip("Catégorie :")).toHaveCount(0);
  await expect
    .poll(() => resultsCount(page), "lignes Mixte")
    .toBe(expected().analyse.all.produit.rows.length);

  await chip("Période :")
    .getByRole("button", { name: "Supprimer le filtre" })
    .click();
  await expect(chip("Période :")).toHaveCount(0);
  await expect
    .poll(() => resultsCount(page), "lignes sans période (en cache)")
    .toBe(noDates.rows.length);
});

test("analyses: export Excel de chaque onglet — nom, feuille, en-têtes, chaque cellule", async ({
  page,
}) => {
  const produit = await openWithPeriod(page);
  await test.step("Produit", () => checkExport(page, "produit", produit.rows));
  for (const mode of OTHER_MODES) {
    await test.step(ANALYSE_MODES[mode].tab, async () =>
      checkExport(page, mode, (await openTab(page, mode, "all")).rows),
    );
  }
});

test("analyses: Liste — bouton « Importer une liste », état, lignes + tuiles, × Pharmacie / Parapharmacie, Excel", async ({
  page,
}) => {
  await openWithPeriod(page);
  await page.getByRole("tab", { name: "Liste", exact: true }).click();
  await expect(
    page.getByText("Importez un fichier .csv avec une colonne Produit.", {
      exact: false,
    }),
  ).toBeVisible();

  const file = resolve(REPO_DIR, expected().files.liste.path);
  const chooser = page.waitForEvent("filechooser");
  const posted = pagePost(page, "/stats/analyse-liste");
  await page.getByRole("button", { name: "Importer une liste" }).click();
  await (await chooser).setFiles(file);
  const a = await posted;
  checkListe(a);
  await expect(
    page.getByText(
      `${basename(file)} · ${expected().liste.items.length} produits`,
    ),
    "ligne d'état",
  ).toBeVisible();
  await expect.poll(() => resultsCount(page), "lignes").toBe(a.rows.length);
  const statuses = (a.rows as Row[])
    .slice(0, 25)
    .map((r) => (r.match_status === "found" ? "Trouvé" : "Introuvable"));
  expect(
    await columnTexts(page, "Statut"),
    "badges Trouvé / Introuvable",
  ).toEqual(statuses);
  await checkKpiTiles(page, a.kpis);
  await test.step("Excel", () => checkExport(page, "liste", a.rows));

  for (const { ct, label } of CATEGORY_TYPES.slice(1)) {
    await test.step(label, async () => {
      const again = pagePost(page, "/stats/analyse-liste"); // the list re-runs on the new category
      await pickCategoryType(page, label);
      const r = await again;
      checkListe(r, expected().liste_ct[ct], `liste[${ct}]`);
      await checkKpiTiles(page, r.kpis);
    });
  }
});

test("analyses: Liste — fichier sans produit → message, aucun appel", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("tab", { name: "Liste", exact: true }).click();
  let posted = false;
  page.on("request", (r) => {
    if (r.url().includes("/stats/analyse-liste")) posted = true;
  });
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Importer une liste" }).click();
  await (
    await chooser
  ).setFiles({
    name: "vide.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Produit;PID\n"),
  });
  await expect(
    page.getByText("Aucun produit détecté dans le fichier."),
  ).toBeVisible();
  expect(posted, "aucun POST /stats/analyse-liste").toBe(false);
});

test("analyses: catégorie — une seule ligne par catégorie (« Médicament (33.930%) » + « (30.000%) » = « Médicament »)", async ({
  page,
}) => {
  await open(page);
  const produit = call(page, "produit", "all");
  await setPeriod(page, testWindow().date_from, testWindow().date_to);
  await produit;
  const rows = (await openTab(page, "categorie", "all")).rows as Row[];
  const labels = rows.map((r) => r.category);
  expect(labels.length).toBe(new Set(labels).size);
});
