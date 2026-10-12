/** Gestion des imports (owner). The 3 setup imports are listed with their
 *  counts. An extra achats file (2400 lines = 2 chunks of 2000, known products on new
 *  BLs) is cancelled after its first chunk (PATCH batch → its rows removed),
 *  imported again, then deleted from the list (DELETE → rows removed). After
 *  both undos the Rapport and the achats list still equal the oracle. An import
 *  marks every cached query stale: /analyses (cached 60 s) refetches after it.
 *  Deleting the stock import removes its stock (Produits, Stock); importing it again puts
 *  it back. Serial. */
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import type { Page } from "@playwright/test";

import { apiDelete, apiGet, apiPost } from "../lib/api";
import { OWNER, loadState, saveState, sessionFile } from "../lib/auth";
import { checkLedgerPage, checkStats, checkStockSummary, type Row } from "../lib/checks";
import { expectSame, expectSameSet } from "../lib/diff";
import { expected, testWindow } from "../lib/expected";
import { expect, test } from "../lib/fixtures";
import { REPO_DIR } from "../lib/paths";
import { pageCall, pageSend, period, setPeriod } from "../lib/ui";

test.use({ storageState: sessionFile("owner") });
test.describe.configure({ mode: "serial" });

const extraName = (): string => basename(expected().files.extra_achats.path);

/** /upload-file?type=achat with the extra file picked; returns the start button. */
async function pickExtraFile(page: Page) {
  await page.goto("/upload-file?type=achat");
  await page.locator('input[type="file"]').setInputFiles(resolve(REPO_DIR, expected().files.extra_achats.path));
  const start = page.getByRole("button", { name: "Importer dans la base" });
  await expect(start).toBeVisible();
  return start;
}

test("nom de fichier invalide : le message s'affiche puis se ferme", async ({ page }) => {
  await page.goto("/upload-file?type=achat");
  await page.locator('input[type="file"]').setInputFiles({
    name: "achats.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("a;b\n1;2\n"),
  });
  const error = page.getByText(/^Nom de fichier invalide\. Format attendu : « .+ »$/);
  await expect(error).toBeVisible();
  await expect(page.getByRole("button", { name: "Importer dans la base" }), "pas d'aperçu").toHaveCount(0);
  await error.locator("..").getByRole("button", { name: "Fermer" }).click();
  await expect(error).toBeHidden();
});

test("fichier vide, d'un autre type ou abîmé : message, pas d'aperçu", async ({ page }) => {
  await page.goto("/upload-file?type=achat");
  const input = page.locator('input[type="file"]');
  const name = "Sobrus - Achats 2026-01-01 - 2026-01-31.csv"; // a valid Achats name
  const importButton = page.getByRole("button", {
    name: "Importer dans la base",
  });

  // Header only, no line.
  await input.setInputFiles({
    name,
    mimeType: "text/csv",
    buffer: Buffer.from(
      '"Créée le";"Date Bon de Livraison";"Référence de livraison";Fournisseur;PID;Produit;TVA;PPH;PPV;Catégorie;Zone;Quantité;"Prix unitaire";"Date de péremption";"Stock min";"Stock max";Total\n',
    ),
  });
  await expect(
    page.getByText("Le fichier est vide : aucune ligne à importer.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(importButton, "pas d'aperçu").toHaveCount(0);

  // A Ventes file under an Achats name: its delivery-ref column is missing.
  await input.setInputFiles({
    name,
    mimeType: "text/csv",
    buffer: Buffer.from(
      'PID;Produit;Date;"Numéro de transaction";Client;TVA;PPH;PPV;Catégorie;Zone;Quantité;Remise;"Prix unitaire";Total\n' +
        "900001;E2E PRODUIT 00001;2026-01-02;FAC-1;;7;10;12;Médicament;A;1;0;12;12\n",
    ),
  });
  await expect(
    page.getByText("Ce fichier ne correspond pas à ce type d'import. Colonnes manquantes : Référence de livraison", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(importButton, "pas d'aperçu").toHaveCount(0);

  // A damaged file: a NUL byte on line 3 → the line is named, nothing is imported.
  const header =
    '"Créée le";"Date Bon de Livraison";"Référence de livraison";Fournisseur;PID;Produit;TVA;PPH;PPV;Catégorie;Zone;Quantité;"Prix unitaire";"Date de péremption";"Stock min";"Stock max";Total\n';
  const line = (supplier: string) =>
    `2026-01-02;2026-01-02;BL-NUL;${supplier};900001;E2E PRODUIT 00001;TVA (7.00%);10;12;Médicament;A;1;10;;;;10\n`;
  await input.setInputFiles({
    name,
    mimeType: "text/csv",
    buffer: Buffer.from(header + line("GROSSISTE") + line("GROSSISTE\0CASSE")),
  });
  await expect(
    page.getByText("Ce fichier est abîmé (ligne 3). Téléchargez-le à nouveau depuis Sobrus, puis réessayez.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(importButton, "pas d'aperçu").toHaveCount(0);

  // Safety net: the same line sent straight to the API is refused before anything is written.
  const refused = await apiPost(
    page,
    "/uploads/achat-json",
    { rows: [{ PID: "900001", Produit: "E2E PRODUIT 00001", Fournisseur: "GROSSISTE\0CASSE" }], filename: name },
    {},
    400,
  );
  expect(refused.code, "code d'erreur").toBe("fileCorrupted");
});

test("liste : les 3 imports du départ", async ({ page }) => {
  const list = pageCall(page, "/data/imports");
  await page.goto("/imports");
  await expect(page.getByRole("heading", { level: 1, name: "Gestion des imports" })).toBeVisible();
  const e = expected();
  const state = loadState();
  const want = (
    [
      ["achats", "achat"],
      ["ventes", "vente"],
      ["stock", "stock"],
    ] as const
  ).map(([kind, fileType]) => ({
    id: state[`batch_${kind}`],
    file_type: fileType,
    filename: basename(e.files[kind].path),
    rows_inserted: e.import[kind].inserted,
    rows_skipped: 0,
    status: "success",
    error_message: null,
    created_by_full_name: OWNER.name,
    created_by_email: OWNER.email,
    deleted_at: null,
  }));
  expectSameSet((await list).data, want, (r) => r.file_type, "imports");
});

test("annuler un import en cours : les lignes déjà importées sont retirées", async ({ page }) => {
  // Chunk 1 is held until « Annuler l'import » is clicked, so the cancel always
  // lands between chunk 1 and chunk 2.
  let release!: () => void;
  const clicked = new Promise<void>((r) => {
    release = r;
  });
  let first = true;
  await page.route("**/v1/uploads/achat-json", async (route) => {
    if (first) {
      first = false;
      await clicked;
    }
    await route.continue();
  });

  const start = await pickExtraFile(page);
  const chunk1 = page.waitForResponse((r) => r.url().endsWith("/v1/uploads/achat-json"));
  const patched = pageSend(page, "PATCH", /^\/v1\/uploads\/batches\/\d+$/);
  await start.click();
  await page.getByRole("button", { name: "Annuler l'import" }).click();
  release();

  const c1 = await (await chunk1).json();
  expect(c1.inserted, "lot 1").toBe(2000);
  expectSame(
    await patched,
    {
      id: c1.batch_id,
      status: "cancelled",
      error_message: null,
      deleted_rows: 2000,
    },
    "PATCH /uploads/batches",
  );
  await expect(page.getByRole("heading", { name: "Import annulé" })).toBeVisible();
  saveState({ cancelledBatch: c1.batch_id });
});

test("réimporter puis supprimer l'import depuis la liste", async ({ page }) => {
  // In-app links only (no reload) so the TanStack cache survives: /analyses
  // keeps its answer 60 s, the import must make it stale.
  const sidebar = page.getByRole("navigation");
  const first = pageCall(page, "/stats/analyse-marge");
  await page.goto("/analyses");
  await first;
  await sidebar.getByRole("link", { name: "Achats", exact: true }).click();
  await page.getByRole("link", { name: "Importer", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(resolve(REPO_DIR, expected().files.extra_achats.path));
  await page.getByRole("button", { name: "Importer dans la base" }).click();
  const outcome = page.getByRole("heading", {
    level: 3,
    name: /lignes importées$|^Erreur d'importation$|^Import annulé$/,
  });
  await expect(outcome).toBeVisible({ timeout: 5 * 60_000 });
  expect((await outcome.textContent())?.replace(/\D/g, ""), "lignes importées").toBe("2400");
  const refetch = pageCall(page, "/stats/analyse-marge");
  await sidebar.getByRole("link", { name: "Analyses", exact: true }).click();
  await refetch; // no request = stale numbers shown after the import

  // The same file again: every line is already stored by the import above → 0 added.
  const again = pageSend(page, "POST", "/uploads/achat-json");
  await (await pickExtraFile(page)).click();
  await expect(outcome).toBeVisible({ timeout: 5 * 60_000 });
  expect((await outcome.textContent())?.replace(/\D/g, ""), "même fichier une 2e fois : lignes importées").toBe("0");
  expectSame(await again, { inserted: 0, skipped: 2000, skipped_duplicate: 2000 }, "1er lot du même fichier");

  const list = pageCall(page, "/data/imports");
  await page.goto("/imports");
  const extra = (await list).data.filter((r: Row) => r.filename === extraName());
  const cancelled = extra.find((r: Row) => r.status === "cancelled");
  const done = extra.find((r: Row) => r.status === "success" && r.rows_inserted > 0);
  const twice = extra.find((r: Row) => r.status === "success" && r.rows_inserted === 0);
  expectSame(
    twice,
    {
      file_type: "achat",
      rows_inserted: 0,
      rows_skipped: 2400,
      deleted_at: null,
    },
    "même fichier une 2e fois dans la liste",
  );
  expectSame(
    cancelled,
    {
      id: loadState().cancelledBatch,
      file_type: "achat",
      rows_inserted: 0,
      rows_skipped: 0,
      deleted_at: null,
    },
    "import annulé dans la liste",
  );
  expectSame(
    done,
    {
      file_type: "achat",
      rows_inserted: 2400,
      rows_skipped: 0,
      deleted_at: null,
    },
    "réimport dans la liste",
  );

  await page
    .getByRole("row")
    .filter({ hasText: extraName() })
    .filter({ hasText: "Réussi" })
    .filter({
      has: page.getByRole("cell", { name: /^2[\s\u00a0\u202f]?400$/ }),
    }) // « 2 400 » cell, not « 0 · 2 400 ignorées »
    .getByRole("button", { name: "Supprimer" })
    .click();
  // « Annuler » in the confirmation: nothing is deleted.
  await page
    .getByRole("dialog", { name: "Supprimer cet import ?" })
    .getByRole("button", { name: "Annuler", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("row")
    .filter({ hasText: extraName() })
    .filter({ hasText: "Réussi" })
    .filter({
      has: page.getByRole("cell", { name: /^2[\s\u00a0\u202f]?400$/ }),
    })
    .getByRole("button", { name: "Supprimer" })
    .click();
  const deleted = pageSend(page, "DELETE", `/data/imports/${done.id}`);
  const list2 = pageCall(page, "/data/imports");
  await page
    .getByRole("dialog", { name: "Supprimer cet import ?" })
    .getByRole("button", { name: "Supprimer", exact: true })
    .click();
  expect(await deleted, "DELETE /data/imports").toEqual({
    id: done.id,
    deleted_rows: 2400,
    file_type: "achat",
  });
  const after = (await list2).data.find((r: Row) => r.id === done.id);
  expectSame(after, { deleted_by_full_name: OWNER.name, deleted_by_email: OWNER.email }, "import supprimé");
  expect(after.deleted_at, "deleted_at").not.toBeNull();
  await expect(page.getByText(`Supprimé par ${OWNER.name}`, { exact: false })).toBeVisible();

  // Every toast has a close button: the success toast goes before its 4 s auto-close.
  const toast = page.locator("[data-sonner-toast][data-type=success]").first();
  await toast.getByRole("button", { name: "Fermer" }).click();
  await expect(toast).toBeHidden({ timeout: 2_000 });
});

test("navigateur fermé pendant un import : « En cours », pas « Réussi » ; supprimé depuis la liste", async ({
  page,
  context,
}) => {
  // Chunk 1 goes through; after it the server hears nothing more from this browser:
  // chunk 2 and the final status call are dropped (a request left unanswered is still
  // sent when the tab closes, so they are aborted, not held).
  let sent = 0;
  await page.route("**/v1/uploads/achat-json", (route) => (++sent === 1 ? route.continue() : route.abort()));
  await page.route("**/v1/uploads/batches/*", (route) => route.abort());
  const chunk1 = page.waitForResponse((r) => r.url().endsWith("/v1/uploads/achat-json"));
  // The page reports chunk 2's failure with a status call: close only once that call is
  // dropped too (closing the tab cancels the routes, a pending call would get through).
  const statusDropped = page.waitForEvent("requestfailed", (r) => r.url().includes("/v1/uploads/batches/"));
  await (await pickExtraFile(page)).click();
  const c1 = await (await chunk1).json();
  expect(c1.inserted, "lot 1").toBe(2000);
  await statusDropped;
  await page.close();

  const again = await context.newPage();
  const list = pageCall(again, "/data/imports");
  await again.goto("/imports");
  const cut = (await list).data.find((r: Row) => r.id === c1.batch_id);
  expectSame(cut, { status: "in_progress", rows_inserted: 2000, deleted_at: null }, "import coupé");
  const row = again.getByRole("row").filter({ hasText: extraName() }).filter({ hasText: "En cours" });
  await expect(row, "« En cours », pas « Réussi »").toHaveCount(1);

  // Its 2 000 lines leave with it: the next test checks the Rapport is back to the oracle.
  const deleted = pageSend(again, "DELETE", `/data/imports/${c1.batch_id}`);
  await row.getByRole("button", { name: "Supprimer" }).click();
  await again
    .getByRole("dialog", { name: "Supprimer cet import ?" })
    .getByRole("button", { name: "Supprimer", exact: true })
    .click();
  expect(await deleted, "DELETE /data/imports").toEqual({ id: c1.batch_id, deleted_rows: 2000, file_type: "achat" });
});

test("dates tapées à la main : lues comme Sobrus ; date impossible : ligne non importée, message clair", async ({
  page,
}) => {
  // A file saved again in Excel: day first, spaces. The 3rd line's date does not exist.
  const [header, first] = readFileSync(resolve(REPO_DIR, expected().files.extra_achats.path), "utf-8").split("\n");
  const rest = first.split(";").slice(3); // known product of the extra file, its own prices
  const line = (created: string, day: string, bl: string) => [created, day, bl, ...rest].join(";");
  await page.goto("/upload-file?type=achat");
  await page.locator('input[type="file"]').setInputFiles({
    name: "Sobrus - Achats 2026-01-01 - 2026-01-31.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      [
        header,
        line("23/1/26 14:19", "23/1/26", "E2E-DATE-1"),
        line("05.01.2026 09:05", '" 05/01/2026 "', "E2E-DATE-2"),
        line("31/02/2026 10:00", "31/02/2026", "E2E-DATE-3"),
      ].join("\n") + "\n",
    ),
  });
  const sent = pageSend(page, "POST", "/uploads/achat-json");
  await page.getByRole("button", { name: "Importer dans la base" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "2 lignes importées" })).toBeVisible();
  await expect(
    page.getByText("1 ligne(s) non importée(s) : date illisible (exemple de date correcte : 23/01/2026)"),
  ).toBeVisible();
  const result = await sent;
  expectSame(result, { inserted: 2, skipped: 1, skipped_bad_date: 1 }, "POST /uploads/achat-json");

  // Exact extra check: stored as Sobrus writes it, so every period filter finds them.
  const lines = (await apiGet(page, "/achats", { search: "e2e-date" })).data as Row[];
  expect(lines.map((l) => [l.delivery_ref, l.delivery_date]).sort(), "dates enregistrées").toEqual([
    ["E2E-DATE-1", "2026-01-23"],
    ["E2E-DATE-2", "2026-01-05"],
  ]);

  // Cleanup: the last test checks the Rapport is back to the oracle.
  await apiDelete(page, `/data/imports/${result.batch_id}`);
});

test("plusieurs fichiers d'un coup, puis les supprimer d'un coup : cocher, « Supprimer la sélection »", async ({
  page,
}) => {
  // Two small achats files (a known product of the extra file on new BLs) + a file with a wrong
  // name, picked together in the wizard: the wrong one is left out, the 2 others imported in order.
  const [header, first] = readFileSync(resolve(REPO_DIR, expected().files.extra_achats.path), "utf-8").split("\n");
  const rest = first.split(";").slice(3);
  const names = ["Sobrus - Achats 2026-02-01 - 2026-02-28.csv", "Sobrus - Achats 2026-03-01 - 2026-03-31.csv"];
  const file = (name: string, i: number) => ({
    name,
    mimeType: "text/csv",
    buffer: Buffer.from(
      `${header}\n${["2026-02-02 10:00:00", "2026-02-02", `E2E-MULTI-${i + 1}`, ...rest].join(";")}\n`,
    ),
  });
  await page.goto("/upload-file?type=achat");
  await expect(page.getByText("Glissez un ou plusieurs fichiers ici")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles([...names.map(file), file("achats février.csv", 2)]);
  await expect(page.getByRole("heading", { level: 3, name: "3 fichiers choisis" })).toBeVisible();
  await expect(page.getByText("2 lignes à importer")).toBeVisible();
  for (const name of names) {
    const line = page.locator("li").filter({ hasText: name });
    await expect(line, name).toContainText("1 lignes");
    await expect(line, name).toContainText(
      name.includes("02-01") ? "du 01 févr. 2026 au 28 févr. 2026" : "du 01 mars 2026 au 31 mars 2026",
    );
  }
  await expect(page.locator("li").filter({ hasText: "achats février.csv" })).toContainText(
    "Ce fichier ne sera pas importé. Nom de fichier invalide.",
  );
  await page.getByRole("button", { name: "Importer les 2 fichiers" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Import de 2 fichiers" })).toBeVisible();
  for (const name of names) {
    await expect(page.locator("li").filter({ hasText: name }), `${name} importé`).toContainText("1 lignes importées");
  }
  await expect(page.getByText("2 sur 2 terminé(s)")).toBeVisible();
  // The results stay on the page until « Nouvel import »; the corner cards hide 4 s after success.
  await page.waitForTimeout(4_500);
  await expect(page.getByText("2 sur 2 terminé(s)")).toBeVisible();
  await expect(page.getByRole("status").getByText(names[0]), "carte du coin cachée").toHaveCount(0);
  await page.getByRole("button", { name: "Nouvel import" }).click();
  await expect(page.getByRole("heading", { level: 3, name: "Import de 2 fichiers" })).toHaveCount(0);

  // Stock: one file only (each stock file replaces the previous one).
  await page.goto("/upload-file?type=stock");
  await expect(page.getByText("Glissez votre fichier ici")).toBeVisible();

  const list = pageCall(page, "/data/imports");
  await page.goto("/imports");
  const rows = (await list).data as Row[];
  const ids = rows.filter((r) => names.includes(r.filename) && !r.deleted_at).map((r) => r.id);
  expect(ids.length, "les 2 imports dans la liste").toBe(2);

  // The button is always there, disabled until a line is ticked.
  await expect(page.getByRole("button", { name: "Supprimer la sélection (0)" })).toBeDisabled();
  await expect(page.getByText("Cochez les imports à supprimer.")).toBeVisible();

  // « Tout sélectionner » ticks every import not deleted yet; unticked again → disabled.
  const all = page.getByRole("checkbox", { name: "Tout sélectionner" });
  await all.check();
  await expect(
    page.getByRole("button", { name: `Supprimer la sélection (${rows.filter((r) => !r.deleted_at).length})` }),
  ).toBeVisible();
  await all.uncheck();
  await expect(page.getByRole("button", { name: "Supprimer la sélection (0)" })).toBeDisabled();

  for (const name of names) await page.getByRole("checkbox", { name: `Sélectionner « ${name} »` }).check();
  await page.getByRole("button", { name: "Supprimer la sélection (2)" }).click();
  const dialog = page.getByRole("dialog", { name: "Supprimer 2 import(s) ?" });
  for (const name of names) await expect(dialog.getByText(name, { exact: false }), "fichier listé").toBeVisible();
  const deletes = ids.map((id) => pageSend(page, "DELETE", `/data/imports/${id}`));
  await dialog.getByRole("button", { name: "Supprimer (2)" }).click();
  for (const res of await Promise.all(deletes)) {
    expectSame(res, { deleted_rows: 1, file_type: "achat" }, "DELETE /data/imports");
  }
  await expect(page.getByText("2 import(s) supprimé(s) · 2 ligne(s) effacée(s)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Supprimer la sélection (0)" }), "sélection vidée").toBeDisabled();

  // Exact extra check: their lines are gone (the last test checks the Rapport is back to the oracle).
  expect((await apiGet(page, "/achats", { search: "e2e-multi" })).data, "lignes retirées").toEqual([]);
});

test("deux imports créent le même nouveau produit au même moment : pas d'erreur, un seul produit", async ({ page }) => {
  // Two chunks sent together (2 backend workers): both name the same unknown PID.
  const row = (ref: string) => ({
    "Date Bon de Livraison": "2026-01-02",
    "Référence de livraison": ref,
    Fournisseur: "GROSSISTE E2E",
    PID: "E2E-MEME-PRODUIT",
    Produit: "E2E PRODUIT EN DOUBLE",
    Quantité: "1",
    "Prix unitaire": "10",
    Total: "10",
  });
  const send = (ref: string) =>
    apiPost(page, "/uploads/achat-json", { rows: [row(ref)], filename: "Sobrus - Achats 2026-01-02 - 2026-01-02.csv" });
  const [a, b] = await Promise.all([send("BL-MEME-A"), send("BL-MEME-B")]);
  expect(a.new_medicaments.count + b.new_medicaments.count, "produit créé une seule fois").toBe(1);
  const lines = (await apiGet(page, "/achats", { search: "E2E PRODUIT EN DOUBLE" })).data as Row[];
  expect(lines.map((l) => l.pid).sort(), "2 lignes, même produit").toEqual(["E2E-MEME-PRODUIT", "E2E-MEME-PRODUIT"]);

  // Cleanup: the next test checks the Rapport is back to the oracle.
  for (const id of new Set([a.batch_id, b.batch_id])) await apiDelete(page, `/data/imports/${id}`);
});

test("supprimer l'import de stock retire son stock ; le réimporter le remet", async ({ page }) => {
  const e = expected();
  const stockId = loadState().batch_stock;
  const produits = async (): Promise<Row> => {
    const list = pageCall(page, "/products", { page: "1" });
    await page.getByRole("navigation").getByRole("link", { name: "Produits", exact: true }).click();
    return list;
  };

  const list = pageCall(page, "/data/imports");
  await page.goto("/imports");
  await list;
  await page
    .getByRole("row")
    .filter({ hasText: basename(e.files.stock.path) })
    .getByRole("button", { name: "Supprimer" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Supprimer cet import ?" });
  await expect(dialog.getByText(`Les ${e.import.stock.inserted} ligne(s) importée(s) seront retirées`)).toBeVisible();
  const deleted = pageSend(page, "DELETE", `/data/imports/${stockId}`);
  await dialog.getByRole("button", { name: "Supprimer", exact: true }).click();
  expect(await deleted, "DELETE /data/imports (stock)").toEqual({
    id: stockId,
    deleted_rows: e.import.stock.inserted,
    file_type: "stock",
  });

  // No stock left: Produits lists only sold / bought products, none with a stock.
  const empty = await produits();
  expect(empty.pagination.total, "produits sans le fichier de stock").toBe(e.products.count_without_stock_file);
  expect(
    empty.data.every((r: Row) => r.current_stock === null),
    "aucun stock",
  ).toBe(true);
  expectSame(await apiGet(page, "/stats/stock-summary"), { total_references: 0, ppv_potentiel: 0 }, "stock vide");

  // The same file again (wizard): the stock is back, the oracle's.
  await page.goto("/upload-file?type=stock");
  await page.locator('input[type="file"]').setInputFiles(resolve(REPO_DIR, e.files.stock.path));
  const sent = pageSend(page, "POST", "/uploads/stock-json");
  await page.getByRole("button", { name: "Importer dans la base" }).click();
  const outcome = page.getByRole("heading", { level: 3, name: /lignes importées$/ });
  await expect(outcome).toBeVisible();
  expect((await outcome.textContent())?.replace(/\D/g, ""), "lignes importées").toBe(String(e.import.stock.inserted));
  saveState({ batch_stock: (await sent).batch_id });
  checkStockSummary(await apiGet(page, "/stats/stock-summary"));
  const back = await produits();
  expect(back.pagination.total, "produits avec le stock").toBe(e.products.rows.length);
  expectSame(
    back.data.map((r: Row) => ({ pid: r.pid, current_stock: r.current_stock })),
    e.products.rows.slice(0, 25).map((r: Row) => ({ pid: r.pid, current_stock: r.current_stock })),
    "stock de la page 1",
  );
});

test("après l'annulation et la suppression, rien n'a bougé", async ({ page }) => {
  // On screen: the Rapport, then Achats (sidebar link, the period stays) = the oracle.
  const w = testWindow();
  const stats = pageCall(page, "/stats", {
    ...period(w),
    category_type: "all",
  });
  await page.goto("/rapport");
  await setPeriod(page, w.date_from, w.date_to);
  checkStats(await stats, "all");
  const list = pageCall(page, "/achats", { ...period(w), page: "1" });
  await page.getByRole("navigation").getByRole("link", { name: "Achats", exact: true }).click();
  checkLedgerPage("achats", await list, expected().achats_list, 1);
});
