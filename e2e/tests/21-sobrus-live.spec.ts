/** « Connexion Sobrus » against the REAL Sobrus, once per run, read-only: the robot's own client
 *  (backend/scripts/sobrus_live_check.py, in the E2E worker container) logs in with the account of
 *  e2e/tests.env (EMAIL, PASSWORD; run.sh asks for it the first time) and exports 7 days of Achats.
 *  Catches what the fake Sobrus can't: Sobrus changing its login or its export (a new page before the app,
 *  a flag, a status). The exact numbers stay on the fake (20-sobrus): a real account's data can't be predicted. */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "../lib/fixtures";
import { E2E_DIR } from "../lib/paths";

function account(): { EMAIL: string; PASSWORD: string } {
  const env: Record<string, string> = {};
  for (const line of readFileSync(resolve(E2E_DIR, "tests.env"), "utf-8").split("\n")) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line); // written raw by scripts/run.sh (a password may hold quotes)
    if (m) env[m[1]] = m[2];
  }
  return { EMAIL: env.EMAIL ?? "", PASSWORD: env.PASSWORD ?? "" };
}

test("Sobrus réel : le robot se connecte et exporte 7 jours d'achats (compte de e2e/tests.env)", async () => {
  test.setTimeout(3 * 60_000);
  const { EMAIL, PASSWORD } = account();
  expect(EMAIL && PASSWORD, "e2e/tests.env : EMAIL + PASSWORD").toBeTruthy();
  // Values through the environment (never on the command line); the real Sobrus URLs for this one command.
  const run = spawnSync(
    "docker",
    [
      "compose",
      "-f",
      resolve(E2E_DIR, "docker-compose.e2e.yml"),
      "exec",
      "-T",
      "-e",
      "EMAIL",
      "-e",
      "PASSWORD",
      "-e",
      "SOBRUS_API_URL=https://api.pharmav4.sobrus.com",
      "-e",
      "SOBRUS_ACCOUNT_API_URL=https://api.account.sobrus.com",
      "worker",
      "python",
      "-m",
      "scripts.sobrus_live_check",
    ],
    { env: { ...process.env, EMAIL, PASSWORD }, encoding: "utf-8", timeout: 150_000 },
  );
  const last = (run.stdout ?? "").trim().split("\n").at(-1) ?? "";
  expect(run.status, `live check: ${run.stderr?.slice(-500)}`).toBe(0);
  const out = JSON.parse(last);
  const why = `robot log: ${(out.log as string[]).join(" | ") || "—"}`;
  expect(out.error, why).toBeNull();
  expect(out.login, `connexion · ${why}`).toBe(true);
  expect(out.sbsid2, `cookie SBSID2 · ${why}`).toBe(true);
  expect(out.export_status, `export Achats · ${why}`).toBe(200);
  // A Sobrus Achats CSV: the columns the import reads (backend/app/ingestion/service.py ACHAT_CFG).
  if (out.lines > 0) {
    for (const col of [
      "Date Bon de Livraison",
      "Référence de livraison",
      "Fournisseur",
      "Produit",
      "Quantité",
      "Prix unitaire",
    ]) {
      expect(out.header, `colonne « ${col} »`).toContain(col);
    }
  }
});
