/** Gestion des imports (owner). The 3 setup imports are listed with their
 *  counts. An extra achats file (600 lines = 2 chunks, known products on new
 *  BLs) is cancelled after its first chunk (PATCH batch → its rows removed),
 *  imported again, then deleted from the list (DELETE → rows removed). After
 *  both undos the Rapport and the achats list still equal the oracle. An import
 *  marks every cached query stale: /analyses (cached 60 s) refetches after it. Serial. */
import { basename, resolve } from "node:path";
import type { Page } from "@playwright/test";

import { apiGet } from "../lib/api";
import { OWNER, loadState, saveState, sessionFile } from "../lib/auth";
import { checkLedgerPage, checkStats, type Row } from "../lib/checks";
import { expectSame, expectSameSet } from "../lib/diff";
import { expected, testWindow } from "../lib/expected";
import { expect, test } from "../lib/fixtures";
import { REPO_DIR } from "../lib/paths";
import { pageCall, pageSend, period } from "../lib/ui";


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


test("liste : les 3 imports du départ", async ({ page }) => {
  const list = pageCall(page, "/data/imports");
  await page.goto("/imports");
  await expect(page.getByRole("heading", { level: 1, name: "Gestion des imports" })).toBeVisible();
  const e = expected();
  const state = loadState();
  const want = ([["achats", "achat"], ["ventes", "vente"], ["stock", "stock"]] as const).map(([kind, fileType]) => ({
    id: state[`batch_${kind}`], file_type: fileType, filename: basename(e.files[kind].path),
    rows_inserted: e.import[kind].inserted, rows_skipped: 0, status: "success", error_message: null,
    created_by_full_name: OWNER.name, created_by_email: OWNER.email, deleted_at: null,
  }));
  expectSameSet((await list).data, want, (r) => r.file_type, "imports");
});


test("annuler un import en cours : les lignes déjà importées sont retirées", async ({ page }) => {
  // Chunk 1 is held until « Annuler l'import » is clicked, so the cancel always
  // lands between chunk 1 and chunk 2.
  let release!: () => void;
  const clicked = new Promise<void>((r) => { release = r; });
  let first = true;
  await page.route("**/v1/uploads/achat-json", async (route) => {
    if (first) { first = false; await clicked; }
    await route.continue();
  });

  const start = await pickExtraFile(page);
  const chunk1 = page.waitForResponse((r) => r.url().endsWith("/v1/uploads/achat-json"));
  const patched = pageSend(page, "PATCH", /^\/v1\/uploads\/batches\/\d+$/);
  await start.click();
  await page.getByRole("button", { name: "Annuler l'import" }).click();
  release();

  const c1 = await (await chunk1).json();
  expect(c1.inserted, "lot 1").toBe(500);
  expectSame(await patched, { id: c1.batch_id, status: "cancelled", error_message: null, deleted_rows: 500 },
    "PATCH /uploads/batches");
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
  const outcome = page.getByRole("heading", { level: 3, name: /lignes importées$|^Erreur d'importation$|^Import annulé$/ });
  await expect(outcome).toBeVisible({ timeout: 5 * 60_000 });
  expect((await outcome.textContent())?.replace(/\D/g, ""), "lignes importées").toBe("600");
  const refetch = pageCall(page, "/stats/analyse-marge");
  await sidebar.getByRole("link", { name: "Analyses", exact: true }).click();
  await refetch;                     // no request = stale numbers shown after the import

  const list = pageCall(page, "/data/imports");
  await page.goto("/imports");
  const extra = (await list).data.filter((r: Row) => r.filename === extraName());
  const cancelled = extra.find((r: Row) => r.status === "cancelled");
  const done = extra.find((r: Row) => r.status === "success");
  expectSame(cancelled, { id: loadState().cancelledBatch, file_type: "achat", rows_inserted: 0, rows_skipped: 0, deleted_at: null },
    "import annulé dans la liste");
  expectSame(done, { file_type: "achat", rows_inserted: 600, rows_skipped: 0, deleted_at: null }, "réimport dans la liste");

  await page.getByRole("row").filter({ hasText: extraName() }).filter({ hasText: "Réussi" })
    .getByRole("button", { name: "Supprimer" }).click();
  const deleted = pageSend(page, "DELETE", `/data/imports/${done.id}`);
  const list2 = pageCall(page, "/data/imports");
  await page.getByRole("dialog", { name: "Supprimer cet import ?" }).getByRole("button", { name: "Supprimer", exact: true }).click();
  expect(await deleted, "DELETE /data/imports").toEqual({ id: done.id, deleted_rows: 600, file_type: "achat" });
  const after = (await list2).data.find((r: Row) => r.id === done.id);
  expectSame(after, { deleted_by_full_name: OWNER.name, deleted_by_email: OWNER.email }, "import supprimé");
  expect(after.deleted_at, "deleted_at").not.toBeNull();
  await expect(page.getByText(`Supprimé par ${OWNER.name}`, { exact: false })).toBeVisible();

  // Every toast has a close button: the success toast goes before its 4 s auto-close.
  const toast = page.locator("[data-sonner-toast][data-type=success]").first();
  await toast.getByRole("button", { name: "Fermer" }).click();
  await expect(toast).toBeHidden({ timeout: 2_000 });
});


test("après l'annulation et la suppression, rien n'a bougé", async ({ page }) => {
  const w = testWindow();
  checkStats(await apiGet(page, "/stats", { ...period(w), category_type: "all", include_non_declared: true }), "all");
  checkLedgerPage("achats", await apiGet(page, "/achats", { ...period(w), page: 1, limit: 20 }), expected().achats_list, 1);
});
