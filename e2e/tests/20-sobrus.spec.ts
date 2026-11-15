/** « Connexion Sobrus »: PharmaGest imports the Sobrus achats + ventes by itself, on the FAKE Sobrus of
 *  the E2E stack (e2e/fake-sobrus/server.py: the same 5 HTTP steps as the real login, the generated
 *  CSVs as exports). A new pharmacy (its owner made by the admin, API setup) so the numbers are only
 *  the robot's:
 *  - form: consent required; a wrong password → the check run refuses it, red card, banner on every
 *    page, one email; « Mettre à jour le mot de passe » → « Connexion vérifiée », banner gone
 *  - « Tout l'historique » → « Importer »: the steps shown live (connexion, import Ventes 2026 paquet
 *    x / y), on another page the corner card (step, « Arrêter », then « Terminé »), every year done +
 *    5 empty years per kind, then today's stock; its /stats + stock summary = the oracle (02-import)
 *  - the nightly run (mode `new`, API: no button) → 0 line (already there); the « Période » bar (30 j, 90 j,
 *    Année en cours, 12 mois: their dates; the calendar) then 01/03/2014 → 01/08/2025: the past years
 *    « Déjà importé » are skipped; « Réimporter quand même » = one export per year, newest first
 *    (2025-01-01 → 2025-08-01 … 2014-03-01 → 2014-12-31); « Arrêter » a run (slow fake exports)
 *  - the Sobrus email is set by the first connection: read-only, another one refused (`sobrusEmailLocked`);
 *    the admin « Changer l'email Sobrus » → the owner may connect another account
 *  - Sobrus asks a check (« Confirmez votre numéro ») → red card; once done, « Réessayer » → active again
 *  - Sobrus answers 429 (too many logins) → the robot waits and logs in again; longer → stops, no red card
 *  - password changed on Sobrus → next run refused → banner + email → new password → banner gone
 *  - Spanish; « Déconnecter »; the admin takes the « Connexion Sobrus » access away → no menu entry,
 *    404, API 403 `featureDisabled`, then gives it back; an employee: no menu entry, 404,
 *    `GET /sobrus/connection` 403 */
import type { Browser, Page } from "@playwright/test";

import { apiDelete, apiGet, apiPost, apiPut } from "../lib/api";
import { sessionFile } from "../lib/auth";
import { CATEGORY_TYPES, checkStats, checkStockSummary } from "../lib/checks";
import { expected, testWindow } from "../lib/expected";
import { expect, recordPage, test, uiReady } from "../lib/fixtures";
import { lastSobrusProblemEmail } from "../lib/mail";
import { barPeriods, dates, pageSend, quickPeriods, setPeriod } from "../lib/ui";

test.describe.configure({ mode: "serial" });

const FAKE = "http://127.0.0.1:19100"; // the fake Sobrus, published by e2e/docker-compose.e2e.yml
const SOBRUS = { email: "pharmacie@sobrus.e2e", password: "SobrusE2e#2026" };
const OWNER = { full_name: "Owner Sobrus E2E", email: "owner.sobrus@pharmagest.ma", password: "OwnerSobrus#2026" };
const CONSENT = "J'autorise PharmaGest à se connecter à mon compte Sobrus pour importer mes achats et mes ventes.";
const BANNER_PASSWORD = "La connexion Sobrus ne fonctionne plus : votre mot de passe Sobrus a changé.";

let owner: Page;
let flushOwner: () => Promise<void>;
let pharmacyId: number;

async function control(page: Page, body: Record<string, unknown>): Promise<void> {
  const res = await page.request.post(`${FAKE}/__control`, { data: body });
  expect(res.status(), "fake Sobrus control").toBe(200);
}

/** The run in progress is over (the robot ended it). Call it once the run exists (after the answer of
 *  the click that queued it: `clickQueuing`), else it can see the previous run already over. */
async function runEnded(page: Page, timeout = 10 * 60_000): Promise<void> {
  await expect
    .poll(async () => (await apiGet(page, "/sobrus/connection")).active_run, { timeout, intervals: [1000] })
    .toBeNull();
}

/** Click a button that queues a run (« Importer »: POST /sobrus/runs; « Mettre à jour le mot de passe »:
 *  PUT /sobrus/connection queues the check run) and wait for its answer: the run exists. */
async function clickQueuing(page: Page, name: string, method: "POST" | "PUT", path: string, status: number) {
  const sent = pageSend(page, method, path, status);
  await page.getByRole("button", { name, exact: true }).click();
  await sent;
}

/** « Importer depuis Sobrus »: « Tout l'historique » in the « Période » bar, then the one « Importer » button. */
async function startImport(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Tout l'historique", exact: true }).click();
  await clickQueuing(page, "Importer", "POST", "/sobrus/runs", 201);
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
  // Its calls count in the coverage + speed gates, under the test running when they happen.
  flushOwner = recordPage(owner, () => {
    try {
      return test.info().title;
    } catch {
      return "20-sobrus";
    }
  });
  await owner.goto("/login");
  await owner.locator('input[type="email"]').fill(OWNER.email);
  await owner.locator('input[autocomplete="current-password"]').fill(OWNER.password);
  await owner.locator('button[type="submit"]').click();
  await expect(owner).not.toHaveURL(/\/login/);
  await owner.goto("/rapport");
});

test.afterAll(async () => {
  await flushOwner?.();
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
  // The eye shows what was typed, then hides it again.
  const typed = page.getByLabel("Mot de passe Sobrus"); // the label also holds « * » and the hint
  await expect(typed).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Afficher le mot de passe", exact: true }).click();
  await expect(typed).toHaveAttribute("type", "text");
  await expect(typed).toHaveValue("pas-le-bon");
  await page.getByRole("button", { name: "Masquer le mot de passe", exact: true }).click();
  await expect(typed).toHaveAttribute("type", "password");
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
  // Set by the first connection (even refused): shown, never typed again; only the admin changes it.
  const email = page.getByLabel("Email Sobrus");
  await expect(email).toHaveValue(SOBRUS.email);
  await email.click();
  await expect(email, "attaché à la pharmacie").not.toBeEditable();
  await expect(
    page.getByText("Ce compte Sobrus est attaché à la pharmacie. Pour en changer, contactez APCM.", { exact: true }),
  ).toBeVisible();
  // Another Sobrus account: refused, nothing changed.
  const other = await apiPut(page, "/sobrus/connection", { email: "autre@sobrus.e2e", password: "Autre#2026" }, 409);
  expect(other.code, "un autre compte Sobrus").toBe("sobrusEmailLocked");
  expect((await apiGet(page, "/sobrus/connection")).email).toBe(SOBRUS.email);
  await page.getByLabel("Nouveau mot de passe Sobrus").fill(SOBRUS.password);
  await clickQueuing(page, "Mettre à jour le mot de passe", "PUT", "/sobrus/connection", 200);
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
    await startImport(page);
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
    // + the « Clôture de caisse » the robot read (no file: its days).
    expect(i.filename).toMatch(
      /^Sobrus - ((Achats|Ventes) \d{4}-01-01 - \d{4}-\d{2}-\d{2}\.csv|Stock \d{8}\.csv|Clôture de caisse \d{4}-\d{2}-\d{2} - \d{4}-\d{2}-\d{2})$/,
    );
  }
  expect(imports.filter((i) => i.file_type === "closing").length, "la clôture de caisse : sa ligne").toBe(1);
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
  // `limit`: the newest runs only (the page asks the default 10).
  expect(await apiGet(page, "/sobrus/runs", { limit: 1 }), "limit 1").toEqual([run]);
  expect(run.status).toBe("success");
  expect(run.lines_added, "déjà importées").toBe(0);
  await page.reload();
  await expect(page.getByText("Terminé : 0 ligne(s) ajoutée(s)", { exact: true }).first()).toBeVisible();
});

test("importer une période : la barre « Période », le calendrier ; les années déjà importées sautées, sauf « Réimporter quand même »", async () => {
  test.setTimeout(8 * 60_000);
  const page = owner;
  const main = page.locator("main");
  const start = main.getByRole("button", { name: "Importer", exact: true });
  // The « Période » bar: « 7 j » at first, then each button = its dates.
  await expect(main.getByRole("button", { name: "7 j", exact: true }), "« 7 j » par défaut").toHaveAttribute(
    "aria-pressed",
    "true",
  );
  for (const [name, want] of barPeriods(new Date())) {
    const button = main.getByRole("button", { name, exact: true });
    await button.click();
    await expect(button, name).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => dates(page), { message: name }).toBe(want);
  }
  // « Tout l'historique »: no dates to pick.
  await main.getByRole("button", { name: "Tout l'historique", exact: true }).click();
  await expect(page.getByLabel("Date début jour", { exact: true })).toHaveCount(0);
  await main.getByRole("button", { name: "Année en cours", exact: true }).click();
  // The calendar too: a day picked = the start date (then typed over below).
  await page.getByRole("button", { name: "Ouvrir le calendrier", exact: true }).click();
  await page.getByRole("button", { name: "Go to the Previous Month" }).click(); // a month not selected yet
  await page
    .getByRole("grid")
    .first()
    .getByRole("button", { name: /^\S+ 1 \S+ \d{4}$/ })
    .first()
    .click();
  await expect(page.getByLabel("Date début jour", { exact: true })).toHaveValue("01");
  await page.keyboard.press("Escape");
  // Each quick period of the calendar: its dates.
  for (const [period, want] of quickPeriods(new Date())) {
    await page.getByRole("button", { name: "Ouvrir le calendrier", exact: true }).click();
    // .last(): the calendar's list (« Année en cours » is also a button of the bar).
    await page.getByRole("button", { name: period, exact: true }).last().click();
    await expect.poll(() => dates(page), { message: period }).toBe(want);
  }
  await setPeriod(page, "2025-08-01", "2014-03-01");
  await expect(page.getByText("La date de début doit être avant la date de fin.", { exact: true })).toBeVisible();
  await expect(start, "début après la fin").toBeDisabled();
  await setPeriod(page, "2014-03-01", "2025-08-01");
  await expect(page.getByText("La date de début doit être avant la date de fin.", { exact: true })).toHaveCount(0);
  await expect(start).toBeEnabled();

  // The past years « Tout l'historique » imported (with lines): « Déjà importé : 2024 ✓ … ».
  const done: Record<string, number[]> = (await apiGet(page, "/sobrus/connection")).imported_years;
  const years = [...new Set(Object.values(done).flat())].sort();
  expect(years.length, "années passées déjà importées").toBeGreaterThan(0);
  await expect(main.getByText("Déjà importé :", { exact: true })).toBeVisible();
  for (const y of years) await expect(main.getByText(String(y), { exact: true }).first(), `puce ${y}`).toBeVisible();
  // The whole years of this period among them: skipped, unless « Réimporter quand même ».
  const covered = years.filter((y) => y >= 2015 && y <= 2024);
  const again = page.getByRole("checkbox", { name: "Réimporter quand même", exact: true });
  await expect(again).not.toBeChecked();
  await expect(
    main.getByText(`Réimporter quand même ${covered.join(", ")} (déjà importé)`, { exact: true }),
  ).toBeVisible();

  // 01/03/2014 → 01/08/2025 = 2025-01-01 → 2025-08-01, 2024, …, 2015, 2014-03-01 → 2014-12-31.
  const want = [
    ["2025-01-01", "2025-08-01"],
    ...Array.from({ length: 10 }, (_, i) => [`${2024 - i}-01-01`, `${2024 - i}-12-31`]),
    ["2014-03-01", "2014-12-31"],
  ];
  type Event = { code: string; kind?: string; year?: number; start?: string; end?: string };
  const lastRun = async () => {
    const [run] = await apiGet(page, "/sobrus/runs");
    expect(run.mode).toBe("range");
    expect(run.status).toBe("success");
    expect([run.date_from, run.date_to]).toEqual(["2014-03-01", "2025-08-01"]);
    expect(run.lines_added, "déjà importées").toBe(0);
    return run.events as Event[];
  };
  const periods = (events: Event[], kind: string) =>
    events.filter((e) => e.code === "period_done" && e.kind === kind).map((e) => [e.start, e.end]);

  await test.step("sans la case : les années déjà importées sautées", async () => {
    await clickQueuing(page, "Importer", "POST", "/sobrus/runs", 201);
    await runEnded(page);
    await expect(page.getByText("Import du 01 mars 2014 au 01 août 2025", { exact: false }).first()).toBeVisible();
    const events = await lastRun();
    for (const kind of ["achat", "vente"]) {
      const skipped = (done[kind] ?? []).filter((y) => y >= 2015 && y <= 2024).sort((x, y) => y - x);
      expect(
        events.filter((e) => e.code === "year_skipped" && e.kind === kind).map((e) => e.year),
        `${kind} : sautées`,
      ).toEqual(skipped);
      expect(periods(events, kind), `${kind} : le reste, une année à la fois`).toEqual(
        want.filter(([from, to]) => !skipped.some((y) => from === `${y}-01-01` && to === `${y}-12-31`)),
      );
    }
  });

  await test.step("« Réimporter quand même » : chaque année, la plus récente d'abord", async () => {
    await again.click();
    await expect(again).toBeChecked();
    await clickQueuing(page, "Importer", "POST", "/sobrus/runs", 201);
    await runEnded(page);
    const events = await lastRun();
    for (const kind of ["achat", "vente"]) {
      expect(periods(events, kind), `${kind} : une année à la fois`).toEqual(want);
      expect(
        events.filter((e) => e.code === "year_skipped" && e.kind === kind),
        `${kind} : rien sauté`,
      ).toEqual([]);
    }
  });

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
    await startImport(page);
    // While the robot downloads (slow fake export): « Arrêter » ends the run at once — no waiting
    // for the download, the progress goes away (no more polling).
    await expect(page.getByText(/^Téléchargement .* depuis Sobrus…/)).toBeVisible({ timeout: 60_000 });
    const stop = page.getByRole("button", { name: "Arrêter", exact: true });
    await expect(stop).toBeEnabled();
    // One run at a time per pharmacy: another one is refused while this one runs.
    const second = await apiPost(page, "/sobrus/runs", { mode: "new" }, {}, 409);
    expect(second.code, "un import déjà en cours").toBe("sobrusRunActive");
    await stop.click();
    await expect(page.getByText(/^Téléchargement .* depuis Sobrus…/)).toHaveCount(0, { timeout: 5_000 });
    await runEnded(page);
  } finally {
    await control(page, { delay: 0 });
  }
  const [run] = await apiGet(page, "/sobrus/runs");
  expect(run.status, "arrêté").toBe("cancelled");
  await expect(page.getByText(/^Arrêté \([\d\s\u00a0\u202f]+ ligne\(s\) ajoutée\(s\) avant\)$/).first()).toBeVisible();
});

test("la carte « Import Sobrus » (sur les autres pages) : un clic ouvre la page, « Arrêter », « Fermer »", async () => {
  test.setTimeout(5 * 60_000);
  const page = owner;
  await control(page, { delay: 3 }); // each export waits 3 s: time to click
  try {
    await startImport(page);
    const card = page.getByRole("region", { name: "Import Sobrus", exact: true });
    await page.locator("aside").getByRole("link", { name: "Produits", exact: true }).click();
    await expect(card, "l'import suivi sur une autre page").toBeVisible();
    await card.getByRole("button").first().click(); // the card itself
    await expect(page).toHaveURL(/\/sobrus$/);
    await page.locator("aside").getByRole("link", { name: "Produits", exact: true }).click();
    await card.getByRole("button", { name: "Arrêter", exact: true }).click();
    await runEnded(page);
    await expect(card).toContainText(/^.*Arrêté/);
    await card.getByRole("button", { name: "Fermer", exact: true }).click();
    await expect(card, "fermée").toHaveCount(0);
  } finally {
    await control(page, { delay: 0 });
  }
  const [run] = await apiGet(page, "/sobrus/runs");
  expect(run.status, "arrêté depuis la carte").toBe("cancelled");
  await openSobrus(page);
});

test("Sobrus demande une vérification → carte rouge, « Réessayer » une fois faite → reparti", async () => {
  test.setTimeout(5 * 60_000);
  const page = owner;
  await control(page, { verify: true }); // « Confirmez votre numéro de téléphone » on sobrus.com
  try {
    await startImport(page);
    await runEnded(page);
    expect((await apiGet(page, "/sobrus/connection")).status).toBe("needs_login");
    await page.reload();
    await expect(
      page.getByText(
        "Sobrus demande une vérification. Connectez-vous une fois sur sobrus.com, puis cliquez sur « Réessayer ».",
        {
          exact: true,
        },
      ),
    ).toBeVisible();
  } finally {
    await control(page, { verify: false }); // the owner did it on sobrus.com
  }
  // « Réessayer »: the robot logs in again with the saved password, nothing to type.
  await clickQueuing(page, "Réessayer", "POST", "/sobrus/runs", 201);
  await runEnded(page);
  expect((await apiGet(page, "/sobrus/connection")).status).toBe("active");
  await expect(page.getByRole("button", { name: "Réessayer", exact: true })).toHaveCount(0);
});

test("Sobrus limite les connexions (429) → le robot attend et réessaie ; trop longtemps → pas de carte rouge", async () => {
  test.setTimeout(5 * 60_000);
  const page = owner;
  // Once: the robot waits, logs in again, the run goes on (a check run: the nightly path, no button for it).
  await control(page, { busy: 1 });
  await apiPost(page, "/sobrus/runs", { mode: "check" }, {}, 201);
  await runEnded(page);
  let [run] = await apiGet(page, "/sobrus/runs");
  expect(run.status, "réessayé tout seul").toBe("success");
  expect(run.events.map((e: { code: string }) => e.code)).toContain("login_busy");
  // Longer than the robot waits: the run stops, the connection stays OK (no red card, no « Réessayer »).
  await control(page, { busy: 99 });
  try {
    await apiPost(page, "/sobrus/runs", { mode: "check" }, {}, 201);
    await runEnded(page);
    [run] = await apiGet(page, "/sobrus/runs");
    expect(run.error_code).toBe("sobrusBusy");
    expect((await apiGet(page, "/sobrus/connection")).status, "pas de carte rouge").toBe("active");
    await page.reload();
    await expect(
      page.getByText("Sobrus limite les connexions pour le moment.", { exact: false }).first(),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Réessayer", exact: true })).toHaveCount(0);
  } finally {
    await control(page, { busy: 0 });
  }
});

test("Sobrus en panne ou qui refuse le fichier → arrêté avec la raison, pas de carte rouge", async () => {
  test.setTimeout(5 * 60_000);
  const page = owner;
  const lastRun = async () => (await apiGet(page, "/sobrus/runs"))[0];
  await control(page, { fail: "login" }); // Sobrus answers 503 at login
  try {
    await apiPost(page, "/sobrus/runs", { mode: "check" }, {}, 201);
    await runEnded(page);
    expect((await lastRun()).error_code).toBe("sobrusUnreachable");
  } finally {
    await control(page, { fail: null });
  }
  await control(page, { fail: "export" }); // logged in, but the export answers 500
  try {
    await apiPost(page, "/sobrus/runs", { mode: "new" }, {}, 201);
    await runEnded(page);
    expect((await lastRun()).error_code).toBe("sobrusExportFailed");
  } finally {
    await control(page, { fail: null });
  }
  // Temporary: the connection stays OK (retried the next night), the page says why.
  expect((await apiGet(page, "/sobrus/connection")).status).toBe("active");
  await page.reload();
  await expect(page.getByText("Sobrus n'a pas pu fournir le fichier.", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Réessayer", exact: true })).toHaveCount(0);
});

test("mot de passe changé sur Sobrus → refusé, bandeau + email, nouveau mot de passe → reparti", async () => {
  test.setTimeout(5 * 60_000);
  const page = owner;
  const NEW = "Change2026#Sobrus";
  await control(page, { password: NEW });
  try {
    await startImport(page);
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
    await clickQueuing(page, "Mettre à jour le mot de passe", "PUT", "/sobrus/connection", 200);
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

test("employé : pas d'entrée de menu, 404 dans l'interface, API refusée", async ({ browser }) => {
  // His own employee (the session saved by 12 is gone: 12 deletes its employee).
  const employee = { email: "employe.sobrus@pharmagest.ma", password: "EmployeSobrus#2026" };
  const { member } = await apiPost(owner, "/owner/employees", {
    full_name: "Employé Sobrus",
    ...employee,
    role: "employee",
    pharmacy_id: pharmacyId,
  });
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const page = await ctx.newPage();
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(employee.email);
    await page.locator('input[autocomplete="current-password"]').fill(employee.password);
    await page.locator('button[type="submit"]').click();
    await expect(page).not.toHaveURL(/\/login/);
    await page.goto("/rapport");
    await expect(page.locator("aside").getByRole("link", { name: "Connexion Sobrus", exact: true })).toHaveCount(0);
    await page.goto("/sobrus");
    await expect(page.getByRole("heading", { level: 1, name: "Page introuvable" })).toBeVisible();
    const refused = await apiGet(page, "/sobrus/connection", {}, 403);
    expect(refused.code).toBe("ownerOnly");
  } finally {
    await ctx.close();
    await apiDelete(owner, `/owner/employees/${member.id}`, 204);
  }
});

test("l'administrateur « Changer l'email Sobrus » → le propriétaire peut connecter un autre compte Sobrus", async ({
  browser,
}) => {
  const page = owner;
  // Disconnected (above): the form keeps the pharmacy's email, read-only.
  await openSobrus(page);
  const email = page.getByLabel("Email Sobrus");
  await expect(email).toHaveValue(SOBRUS.email);
  await expect(email).not.toBeEditable();
  const ctx = await browser.newContext({ storageState: sessionFile("admin") });
  const admin = await ctx.newPage();
  const flushAdmin = recordPage(admin, () => test.info().title);
  await uiReady(admin, () => test.info().title);
  try {
    await admin.goto(`/admin/pharmacies/${pharmacyId}`);
    await expect(admin.getByText(`Compte Sobrus : ${SOBRUS.email}`)).toBeVisible();
    await admin.getByRole("button", { name: "Changer l'email Sobrus", exact: true }).click();
    const dialog = admin.getByRole("dialog");
    await expect(dialog.getByText(`Détacher le compte Sobrus ${SOBRUS.email} ?`, { exact: true })).toBeVisible();
    const sent = pageSend(admin, "DELETE", `/admin/pharmacies/${pharmacyId}/sobrus-email`, 204);
    await dialog.getByRole("button", { name: "Confirmer", exact: true }).click();
    await sent;
    await expect(dialog).toHaveCount(0);
    await expect(admin.getByText("Compte Sobrus : aucun")).toBeVisible();
    await expect(admin.getByRole("button", { name: "Changer l'email Sobrus", exact: true })).toBeDisabled();
  } finally {
    await flushAdmin();
    await ctx.close();
  }
  // The owner: another Sobrus account may be typed, nothing « déjà importé » any more.
  await page.reload();
  await expect(email).toBeEditable();
  await expect(email).toHaveValue("");
  const conn = await apiGet(page, "/sobrus/connection");
  expect(conn.locked_email, "plus d'email attaché").toBeNull();
  expect(conn.imported_years, "années oubliées").toEqual({ achat: [], vente: [] });
});
