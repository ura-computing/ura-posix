/** Gestion des imports (owner). The 3 setup imports are listed with their
 *  counts. An extra achats file (2400 lines = 2 chunks of 2000, known products on new
 *  BLs) is cancelled after its first chunk (PATCH batch → its rows removed),
 *  imported again, then deleted from the list (DELETE → rows removed). After
 *  both undos the Rapport and the achats list still equal the oracle. An import
 *  marks every cached query stale: /analyses (cached 60 s) refetches after it. Serial. */
import { basename, resolve } from "node:path";
import type { Page } from "@playwright/test";

import { apiPost } from "../lib/api";
import { OWNER, loadState, saveState, sessionFile } from "../lib/auth";
import { checkLedgerPage, checkStats, type Row } from "../lib/checks";
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
  await (await pickExtraFile(page)).click();
  const c1 = await (await chunk1).json();
  expect(c1.inserted, "lot 1").toBe(2000);
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
