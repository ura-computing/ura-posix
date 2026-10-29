/** « Connexion Sobrus »: PharmaGest imports the Sobrus achats + ventes by itself, on the FAKE Sobrus of
 *  the E2E stack (e2e/fake-sobrus/server.py: the same 5 HTTP steps as the real login, the generated
 *  CSVs as exports). A new pharmacy (its owner made by the admin, API setup) so the numbers are only
 *  the robot's:
 *  - form: consent required; a wrong password → the check run refuses it, red card, banner on every
 *    page, one email; « Mettre à jour le mot de passe » → « Connexion vérifiée », banner gone
 *  - « Tout l'historique » → « Importer »: the steps shown live (connexion, import Ventes 2026 paquet
 *    x / y), on another page the corner card (step, « Arrêter », then « Terminé »), every year done +
 *    5 empty years per kind, then today's stock; its /stats + stock summary = the oracle (02-import)
 *  - the nightly run (mode `new`, API: no button) → 0 line (already there); « Choisir les dates »
 *    01/03/2014 → 01/08/2025 = one export per year, newest first (2025-01-01 → 2025-08-01 …
 *    2014-03-01 → 2014-12-31); « Arrêter » a run (slow fake exports)
 *  - password changed on Sobrus → next run refused → banner + email → new password → banner gone
 *  - Spanish; « Déconnecter »; the admin takes the « Connexion Sobrus » access away → no menu entry,
 *    404, API 403 `featureDisabled`, then gives it back; an employee: no menu entry, 404,
 *    `GET /sobrus/connection` 403 */
import type { Browser, Page } from "@playwright/test";

import { apiGet, apiPost, apiPut } from "../lib/api";
import { sessionFile } from "../lib/auth";
import { CATEGORY_TYPES, checkStats, checkStockSummary } from "../lib/checks";
import { expected, testWindow } from "../lib/expected";
import { expect, test } from "../lib/fixtures";
import { lastSobrusProblemEmail } from "../lib/mail";
import { setPeriod } from "../lib/ui";

test.describe.configure({ mode: "serial" });

const FAKE = "http://127.0.0.1:9100"; // the fake Sobrus, published by e2e/docker-compose.e2e.yml
const SOBRUS = { email: "pharmacie@sobrus.e2e", password: "SobrusE2e#2026" };
const OWNER = { full_name: "Owner Sobrus E2E", email: "owner.sobrus@pharmagest.ma", password: "OwnerSobrus#2026" };
const CONSENT = "J'autorise PharmaGest à se connecter à mon compte Sobrus pour importer mes achats et mes ventes.";
const BANNER_PASSWORD = "La connexion Sobrus ne fonctionne plus : votre mot de passe Sobrus a changé.";

let owner: Page;
let pharmacyId: number;

async function control(page: Page, body: Record<string, unknown>): Promise<void> {
  const res = await page.request.post(`${FAKE}/__control`, { data: body });
  expect(res.status(), "fake Sobrus control").toBe(200);
}

/** The run in progress is over (the robot ended it). */
async function runEnded(page: Page, timeout = 10 * 60_000): Promise<void> {
  await expect
    .poll(async () => (await apiGet(page, "/sobrus/connection")).active_run, { timeout, intervals: [1000] })
    .toBeNull();
}

/** « Importer depuis Sobrus »: the choice, then the one « Importer » button. */
async function startImport(page: Page, choice: "Tout l'historique" | "Choisir les dates"): Promise<void> {
  await page.getByRole("button", { name: choice, exact: true }).click();
  await page.getByRole("button", { name: "Importer", exact: true }).click();
}

async function openSobrus(page: Page): Promise<void> {
  await page.locator("aside").getByRole("link", { name: "Connexion Sobrus", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Connexion Sobrus" })).toBeVisible();
}

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  const admin = await browser.newContext({ storageState: sessionFile("admin") });
  const adminPage = await admin.newPage();
  const pharmacy = await apiPost(adminPage, "/admin/pharmacies", { name: "Pharmacie Sobrus E2E", city: "Rabat" });
  pharmacyId = pharmacy.id;
  await apiPost(adminPage, `/admin/pharmacies/${pharmacy.id}/users`, {
    ...OWNER,
    role: "owner",
    pharmacy_id: pharmacy.id,
  });
  await admin.close();

  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  owner = await ctx.newPage();
  await owner.goto("/login");
  await owner.locator('input[type="email"]').fill(OWNER.email);
  await owner.locator('input[autocomplete="current-password"]').fill(OWNER.password);
  await owner.locator('button[type="submit"]').click();
  await expect(owner).not.toHaveURL(/\/login/);
  await owner.goto("/rapport");
});

test.afterAll(async () => {
  await owner?.context().close();
});

test("connexion : accord obligatoire, mot de passe refusé → carte rouge, bandeau, email", async () => {
  test.setTimeout(120_000);
  const page = owner;
  await openSobrus(page);
  await expect(
    page.getByText("PharmaGest importe vos achats et vos ventes Sobrus tout seul, chaque nuit."),
  ).toBeVisible();
  await page.getByLabel("Email Sobrus").fill(SOBRUS.email);
  await page.getByLabel("Mot de passe Sobrus").fill("pas-le-bon");
  const connect = page.getByRole("button", { name: "Connecter mon compte Sobrus", exact: true });
  await expect(connect, "sans l'accord").toBeDisabled();
  await page.getByRole("checkbox", { name: CONSENT }).click();
  await connect.click();

  // The check run (login test) refuses the password: red card + « Mettre à jour le mot de passe ».
  await expect(
    page.getByText("Sobrus refuse le mot de passe enregistré : il a sans doute été changé.", { exact: false }),
  ).toBeVisible({
    timeout: 60_000,
  });
  const conn = await apiGet(page, "/sobrus/connection");
  expect(conn.status, "connexion").toBe("invalid");
  expect(conn.last_error_code).toBe("sobrusBadCredentials");
  expect(JSON.stringify(conn), "jamais le mot de passe").not.toContain("pas-le-bon");
  await lastSobrusProblemEmail(OWNER.email);

  // The banner on every page (not on its own page).
  await page.locator("aside").getByRole("link", { name: "Tableau de bord", exact: true }).click();
  await expect(page.getByRole("alert").getByText(BANNER_PASSWORD, { exact: false })).toBeVisible();
  await page.getByRole("alert").getByRole("link", { name: "Mettre à jour le mot de passe", exact: true }).click();
  await expect(page).toHaveURL(/\/sobrus$/);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("mettre à jour le mot de passe → connexion vérifiée, bandeau parti", async () => {
  test.setTimeout(120_000);
  const page = owner;
  await page.getByLabel("Nouveau mot de passe Sobrus").fill(SOBRUS.password);
  await page.getByRole("button", { name: "Mettre à jour le mot de passe", exact: true }).click();
  await runEnded(page);
  await expect(page.getByText("Connexion vérifiée", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(`Connecté à Sobrus : ${SOBRUS.email}`, { exact: true })).toBeVisible();
  await page.locator("aside").getByRole("link", { name: "Tableau de bord", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("importer tout l'historique : chaque étape à l'écran, puis les chiffres = oracle", async () => {
  test.setTimeout(15 * 60_000);
  const page = owner;
  await openSobrus(page);
  await control(page, { delay: 3 }); // each export waits 3 s: every step stays on screen long enough
  const corner = page.getByRole("region", { name: "Import Sobrus" });
  try {
    await startImport(page, "Tout l'historique");
    const progress = page.locator("section", {
      has: page.getByRole("heading", { name: "Import de tout l'historique" }),
    });
    await expect(progress).toBeVisible();
    // Live: what it does now, and the steps already done.
    await expect(progress.getByText(/^Téléchargement Achats \d{4} depuis Sobrus… [\d,]+ Mo$/)).toBeVisible({
      timeout: 60_000,
    });
    // Logged in again, or the session of the check run still open.
    await expect(progress.getByText(/^(Connecté à Sobrus|Session Sobrus encore ouverte)$/).first()).toBeVisible();
    await expect(
      progress.getByText(/^Achats \d{4} : [\d\s\u00a0\u202f]+ ligne\(s\) ajoutée\(s\)$/).first(),
    ).toBeVisible({
      timeout: 120_000,
    });
    await expect(progress.getByText(/^Téléchargement Ventes \d{4} depuis Sobrus… [\d,]+ Mo$/)).toBeVisible({
      timeout: 120_000,
    });
    // Any other page: the corner card follows the run, « Arrêter » there too; none on its own page.
    await expect(corner, "pas de carte sur sa page").toHaveCount(0);
    await page.locator("aside").getByRole("link", { name: "Tableau de bord", exact: true }).click();
    await expect(corner.getByText(/^(Téléchargement|Import) Ventes \d{4}/)).toBeVisible({ timeout: 60_000 });
    await expect(corner.getByRole("button", { name: "Arrêter", exact: true })).toBeEnabled();
  } finally {
    await control(page, { delay: 0 });
  }
  // Its end, still on the Tableau de bord: « Terminé » in the corner, gone by itself a moment later.
  await expect(corner.getByText(/^Terminé : [\d\s\u00a0\u202f]+ ligne\(s\) ajoutée\(s\)$/)).toBeVisible({
    timeout: 10 * 60_000,
  });
  await runEnded(page);
  await expect(corner, "partie seule").toHaveCount(0, { timeout: 15_000 });
  await openSobrus(page);
  await expect(page.getByText(/^Terminé : [\d\s\u00a0\u202f]+ ligne\(s\) ajoutée\(s\)$/).first()).toBeVisible();
  const stockWant = expected().import.stock;

  // The robot's run: every year with lines, then 5 empty years, for achats then ventes.
  const [run] = await apiGet(page, "/sobrus/runs");
  expect(run.mode).toBe("full");
  expect(run.status).toBe("success");
  const stockDone = run.events.find((e: { code: string }) => e.code === "stock_done");
  expect(stockDone?.n, "« Stock du jour » : produits mis à jour").toBe(stockWant.inserted);
  for (const kind of ["achat", "vente"]) {
    const done = run.events.filter((e: { code: string; kind?: string }) => e.code === "year_done" && e.kind === kind);
    const empty = run.events.filter((e: { code: string; kind?: string }) => e.code === "year_empty" && e.kind === kind);
    expect(done.length, `${kind} : années importées`).toBeGreaterThan(0);
    expect(empty.length, `${kind} : 5 années vides avant d'arrêter`).toBe(5);
  }
  // Same import as the wizard: one batch per year, named with its dates, + the stock, in « Gestion des imports ».
  const imports: { file_type: string; filename: string; status: string; rows_inserted: number }[] = (
    await apiGet(page, "/data/imports", { limit: 200 })
  ).data;
  expect(imports.length, "un import par année").toBeGreaterThan(1);
  for (const i of imports) {
    expect(i.status, i.filename).toBe("success");
    expect(i.filename).toMatch(/^Sobrus - ((Achats|Ventes) \d{4}-01-01 - \d{4}-\d{2}-\d{2}|Stock \d{8})\.csv$/);
  }
  const stock = imports.filter((i) => i.file_type === "stock");
  expect(stock.length, "un import du stock").toBe(1);
  expect(stock[0].rows_inserted, "stock : produits").toBe(stockWant.inserted);
  checkStockSummary(await apiGet(page, "/stats/stock-summary"));

  // Every figure of the Tableau de bord = the oracle (the same lines as 02-import).
  const w = testWindow();
  for (const { ct } of CATEGORY_TYPES) {
    checkStats(await apiGet(page, "/stats", { ...w, category_type: ct, include_non_declared: true }), ct);
  }
});

test("import de la nuit (nouveautés, sans bouton) : rien de nouveau → 0 ligne", async () => {
  test.setTimeout(5 * 60_000);
  const page = owner;
  await apiPost(page, "/sobrus/runs", { mode: "new" }, {}, 201); // what the 02:00 run does
  await runEnded(page);
  const [run] = await apiGet(page, "/sobrus/runs");
  expect(run.mode).toBe("new");
  expect(run.status).toBe("success");
  expect(run.lines_added, "déjà importées").toBe(0);
  await page.reload();
  await expect(page.getByText("Terminé : 0 ligne(s) ajoutée(s)", { exact: true }).first()).toBeVisible();
});

test("importer une période : coupée en années (Sobrus exporte 1 an au plus), la plus récente d'abord", async () => {
  test.setTimeout(5 * 60_000);
  const page = owner;
  const start = page.getByRole("button", { name: "Importer", exact: true });
  await page.getByRole("button", { name: "Choisir les dates", exact: true }).click();
  await setPeriod(page, "2025-08-01", "2014-03-01");
  await expect(page.getByText("La date de début doit être avant la date de fin.", { exact: true })).toBeVisible();
  await expect(start, "début après la fin").toBeDisabled();
  await setPeriod(page, "2014-03-01", "2025-08-01");
  await expect(page.getByText("La date de début doit être avant la date de fin.", { exact: true })).toHaveCount(0);
  await start.click();
  await runEnded(page);
  await expect(page.getByText("Import du 01 mars 2014 au 01 août 2025", { exact: false }).first()).toBeVisible();

  // 01/03/2014 → 01/08/2025 = 2025-01-01 → 2025-08-01, 2024, …, 2015, 2014-03-01 → 2014-12-31.
  const want = [
    ["2025-01-01", "2025-08-01"],
    ...Array.from({ length: 10 }, (_, i) => [`${2024 - i}-01-01`, `${2024 - i}-12-31`]),
    ["2014-03-01", "2014-12-31"],
  ];
  const [run] = await apiGet(page, "/sobrus/runs");
  expect(run.mode).toBe("range");
  expect(run.status).toBe("success");
  expect([run.date_from, run.date_to]).toEqual(["2014-03-01", "2025-08-01"]);
  for (const kind of ["achat", "vente"]) {
    const done = run.events.filter((e: { code: string; kind?: string }) => e.code === "period_done" && e.kind === kind);
    expect(
      done.map((e: { start: string; end: string }) => [e.start, e.end]),
      `${kind} : une année à la fois`,
    ).toEqual(want);
  }
  expect(run.lines_added, "déjà importées").toBe(0);

  // Nothing counted twice: the Tableau de bord still = the oracle.
  const w = testWindow();
  for (const { ct } of CATEGORY_TYPES) {
    checkStats(await apiGet(page, "/stats", { ...w, category_type: ct, include_non_declared: true }), ct);
  }
});

test("arrêter un import en cours", async () => {
  test.setTimeout(5 * 60_000);
  const page = owner;
  await control(page, { delay: 3 }); // each export waits 3 s: time to click
  try {
    await startImport(page, "Tout l'historique");
    // Once the robot runs (a queued run is cancelled at once, without « Arrêt en cours… »).
    await expect(page.getByText(/^Téléchargement .* depuis Sobrus…/)).toBeVisible({ timeout: 60_000 });
    const stop = page.getByRole("button", { name: "Arrêter", exact: true });
    await expect(stop).toBeEnabled();
    await stop.click();
    await expect(page.getByText("Arrêt en cours…", { exact: true })).toBeVisible();
    await runEnded(page);
  } finally {
    await control(page, { delay: 0 });
  }
  const [run] = await apiGet(page, "/sobrus/runs");
  expect(run.status, "arrêté").toBe("cancelled");
  await expect(page.getByText(/^Arrêté \([\d\s\u00a0\u202f]+ ligne\(s\) ajoutée\(s\) avant\)$/).first()).toBeVisible();
});

test("mot de passe changé sur Sobrus → refusé, bandeau + email, nouveau mot de passe → reparti", async () => {
  test.setTimeout(5 * 60_000);
  const page = owner;
  const NEW = "Change2026#Sobrus";
  await control(page, { password: NEW });
  try {
    await startImport(page, "Tout l'historique");
    await runEnded(page);
    expect((await apiGet(page, "/sobrus/connection")).status).toBe("invalid");
    await lastSobrusProblemEmail(OWNER.email);
    await page.locator("aside").getByRole("link", { name: "Produits", exact: true }).click();
    await expect(page.getByRole("alert").getByText(BANNER_PASSWORD, { exact: false })).toBeVisible();
    // Runs refused until the new password is typed.
    const refused = await apiPost(page, "/sobrus/runs", { mode: "new" }, {}, 409);
    expect(refused.code).toBe("sobrusBadCredentials");

    await page.getByRole("alert").getByRole("link", { name: "Mettre à jour le mot de passe", exact: true }).click();
    await page.getByLabel("Nouveau mot de passe Sobrus").fill(NEW);
    await page.getByRole("button", { name: "Mettre à jour le mot de passe", exact: true }).click();
    await runEnded(page);
    expect((await apiGet(page, "/sobrus/connection")).status).toBe("active");
  } finally {
    await control(page, { password: SOBRUS.password });
  }
  // Back to the test password for the next tests.
  await page.getByRole("button", { name: "Déconnecter", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Déconnecter", exact: true }).click();
  await expect(page.getByRole("button", { name: "Connecter mon compte Sobrus", exact: true })).toBeVisible();
  const history = (await apiGet(page, "/history", { kind: "all", page: 1, limit: 50 })).data.map(
    (r: { action: string }) => r.action,
  );
  for (const action of ["sobrus_connected", "sobrus_login_refused", "sobrus_password_updated", "sobrus_disconnected"]) {
    expect(history, `historique : ${action}`).toContain(action);
  }
});

test("en espagnol", async () => {
  const page = owner;
  await page.getByRole("button", { name: "Espagnol", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Conexión Sobrus" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Conectar mi cuenta Sobrus", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Francés", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Connexion Sobrus" })).toBeVisible();
});

test("accès « Connexion Sobrus » retiré par l'administrateur → absent du menu, 404 dans le cadre, API refusée", async ({
  browser,
}) => {
  const page = owner;
  const ctx = await browser.newContext({ storageState: sessionFile("admin") });
  const admin = await ctx.newPage();
  const features = `/admin/pharmacies/${pharmacyId}/features`;
  const menu = page.locator("aside").getByRole("link", { name: "Connexion Sobrus", exact: true });
  await apiPut(admin, features, { features: { sobrus: false } });
  try {
    await page.goto("/rapport");
    await expect(page.getByRole("heading", { level: 1, name: "Tableau de bord" })).toBeVisible();
    await expect(menu, "plus dans le menu").toHaveCount(0);
    await page.goto("/sobrus");
    await expect(page.getByRole("heading", { level: 1, name: "Page introuvable" })).toBeVisible();
    const refused = await apiGet(page, "/sobrus/connection", {}, 403);
    expect(refused.code, "API refusée").toBe("featureDisabled");
  } finally {
    await apiPut(admin, features, { features: { sobrus: true } });
    await ctx.close();
  }
  await page.goto("/rapport");
  await expect(menu, "rendu par l'administrateur").toBeVisible();
});

test.describe("employé", () => {
  test.use({ storageState: sessionFile("employee") });

  test("pas d'entrée de menu, 404 dans l'interface, API refusée", async ({ page }) => {
    await page.goto("/rapport");
    await expect(page.locator("aside").getByRole("link", { name: "Connexion Sobrus", exact: true })).toHaveCount(0);
    await page.goto("/sobrus");
    await expect(page.getByRole("heading", { level: 1, name: "Page introuvable" })).toBeVisible();
    const refused = await apiGet(page, "/sobrus/connection", {}, 403);
    expect(refused.code).toBe("ownerOnly");
  });
});
