/** The owner imports the 3 huge generated files through /upload-file, exactly
 *  like a user (browser parses the CSV, sends 2000-row chunks). Checks the
 *  inserted / skipped / new-product counts against the oracle and records the
 *  total import time as a `FLOW import/<kind>` entry for the speed gate. */
import { resolve } from "node:path";

import { OWNER, login, saveState, sessionFile } from "../lib/auth";
import { expected } from "../lib/expected";
import { expect, recordCall, test } from "../lib/fixtures";
import { REPO_DIR } from "../lib/paths";

test.describe.configure({ mode: "serial" });

test("propriétaire: connexion", async ({ page }) => {
  await login(page, OWNER, "owner");
});

const KINDS = [
  { kind: "achats", type: "achat" },
  { kind: "ventes", type: "vente" },
  { kind: "stock", type: "stock" },
] as const;

test.describe("imports", () => {
  test.use({ storageState: sessionFile("owner") });

  for (const { kind, type } of KINDS) {
    test(`import ${kind}`, async ({ page }) => {
      test.setTimeout(20 * 60_000); // huge files go through the browser in 2000-row chunks
      const want = expected().import[kind];
      const file = resolve(REPO_DIR, expected().files[kind].path);

      const got = {
        chunks: 0,
        inserted: 0,
        skipped: 0,
        newMeds: 0,
        batchId: 0,
        errors: [] as string[],
      };
      const pending: Promise<void>[] = [];
      let lastChunkAt = 0;
      page.on("response", (res) => {
        if (!res.url().endsWith(`/v1/uploads/${type}-json`)) return;
        lastChunkAt = Date.now();
        pending.push(
          (async () => {
            if (!res.ok()) {
              got.errors.push(`${res.status()} ${await res.text()}`);
              return;
            }
            const body = await res.json();
            got.chunks += 1;
            got.batchId = body.batch_id;
            got.inserted += body.inserted;
            got.skipped +=
              type === "stock" ? body.skipped_unknown.length : body.skipped;
            got.newMeds += body.new_medicaments.count;
          })(),
        );
      });

      await page.goto(`/upload-file?type=${type}`);
      await page.locator('input[type="file"]').setInputFiles(file);
      const start = page.getByRole("button", { name: "Importer dans la base" });
      await expect(start).toBeVisible();

      const t0 = Date.now();
      await start.click();
      // The result card title. ("Import terminé" only shows after the card
      // auto-dismisses 4 s later: waiting for it added 4 s to every import.)
      const outcome = page.getByRole("heading", {
        level: 3,
        name: /lignes importées$|^Erreur d'importation$|^Import annulé$/,
      });
      await expect(outcome).toBeVisible({ timeout: 20 * 60_000 });
      const ms = lastChunkAt - t0; // click → last chunk answered (UI polling not counted)
      const title = (await outcome.textContent()) ?? "";
      recordCall({
        method: "FLOW",
        path: `import/${kind}`,
        status: 200,
        ms,
        source: "flow",
        test: `import ${kind}`,
      });

      await Promise.all(pending);
      expect(got.errors, "chunk errors").toEqual([]);
      expect(title, "result card").toMatch(/lignes importées$/);
      expect(title.replace(/\D/g, ""), "rows shown on the result card").toBe(
        String(want.inserted),
      );
      expect(got.inserted, "inserted rows").toBe(want.inserted);
      expect(got.skipped, "skipped rows").toBe(
        type === "stock" ? want.skipped_unknown : want.skipped,
      );
      expect(got.newMeds, "new products").toBe(want.new_medicaments);
      saveState({ [`batch_${kind}`]: got.batchId }); // rows' import_batch_id in later checks
      test
        .info()
        .annotations.push({
          type: "import",
          description: `${kind}: ${got.inserted} rows · ${got.chunks} chunks · ${(ms / 1000).toFixed(1)} s`,
        });
    });
  }
});
