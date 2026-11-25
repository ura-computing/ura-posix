/** « Créer un compte » (T4), through the pages:
 *  - a visitor signs up: new pharmacy, or joins one with its code; the page gives the same
 *    answer whatever was typed (it never says whether a code or an email exists);
 *  - before the admin's « Accepter » (« Pharmacies et utilisateurs » → « Demandes ») the
 *    account logs in but waits: no menu entry, the 404 page says why, not in « Utilisateurs »;
 *    an email that already has an account gets no second one (generic login message);
 *  - « Accepter » creates the pharmacy (code from the city) and opens the account,
 *    « Refuser » deletes the waiting account; both are emailed;
 *  - a request whose email already has an account, or whose code no pharmacy has, can only
 *    be refused (« Accepter » greyed out, with the reason). Serial. */
import type { Page } from "@playwright/test";

import { apiGet } from "../lib/api";
import { LOGGED_OUT, OWNER, PHARMACY_FEATURES, loadState, saveState, sessionFile } from "../lib/auth";
import { type Row } from "../lib/checks";
import { expectSame } from "../lib/diff";
import { expect, test } from "../lib/fixtures";
import { lastSignupEmail } from "../lib/mail";
import { pageCall, pageSend } from "../lib/ui";

test.describe.configure({ mode: "serial" });

const NEW_OWNER = {
  name: "Propriétaire Inscrit E2E",
  email: "inscrit.e2e@pharmagest.ma",
  phone: "0611223344",
  password: "InscritE2e#1",
};
const NEW_PHARMACY = { name: "Pharmacie Inscription E2E", city: "Tanger" };
const EMPLOYEE = {
  name: "Employé Inscrit E2E",
  email: "employe.inscrit.e2e@pharmagest.ma",
  phone: "0622334455",
  password: "EmployeInscrit#1",
};
const UNKNOWN_CODE = {
  name: "Code Inconnu E2E",
  email: "inconnu.e2e@pharmagest.ma",
  phone: "0633445566",
  password: "CodeInconnu#1",
};
const TAKEN = { name: "Email Déjà Pris E2E", email: OWNER.email, phone: "0644556677", password: "EmailPris#1" };

type Person = { name: string; email: string; phone: string; password: string };
type Kind =
  "Propriétaire d'une nouvelle pharmacie" | "Propriétaire d'une pharmacie déjà inscrite" | "Employé d'une pharmacie";

/** /login → « Créer un compte » → one screen per question, « Suivant » each time →
 *  « Envoyer ma demande »: the same answer every time. */
async function signUp(page: Page, kind: Kind, person: Person, pharmacy: { code: string } | typeof NEW_PHARMACY) {
  const next = () => page.getByRole("button", { name: "Suivant" }).click();
  await page.goto("/login");
  await page.getByRole("link", { name: "Créer un compte" }).click();
  await page.getByRole("radio", { name: new RegExp(`^${kind}`) }).click();
  await next();
  if ("code" in pharmacy) {
    await page.getByLabel("Code de la pharmacie").fill(pharmacy.code);
  } else {
    await page.getByLabel("Nom de la pharmacie").fill(pharmacy.name);
    await page.getByLabel("Ville").fill(pharmacy.city);
  }
  await next();
  await page.getByLabel("Nom complet").fill(person.name);
  await page.getByLabel("Téléphone").fill(person.phone);
  await next();
  await page.getByLabel("Email").fill(person.email);
  await next();
  await page.getByLabel("Mot de passe", { exact: true }).fill(person.password);
  await page.getByLabel("Confirmer le mot de passe").fill(person.password);
  // The eye shows what was typed.
  await page.getByRole("button", { name: "Afficher le mot de passe", exact: true }).first().click();
  await expect(page.getByLabel("Mot de passe", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Masquer le mot de passe", exact: true }).first().click();
  await expect(page.getByLabel("Mot de passe", { exact: true })).toHaveAttribute("type", "password");
  const sent = pageSend(page, "POST", "/auth/signup");
  await page.getByRole("button", { name: "Envoyer ma demande" }).click();
  expect(await sent, "POST /auth/signup").toEqual({ detail: "Demande envoyée" });
  await expect(page.getByRole("heading", { name: "Demande envoyée" })).toBeVisible();
}

/** The login page refuses this person (refused, or an email that already had an account). */
async function loginRefused(page: Page, person: Person) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(person.email);
  await page.locator('input[autocomplete="current-password"]').fill(person.password);
  const refused = pageSend(page, "POST", "/auth/login", 401);
  await page.locator('button[type="submit"]').click();
  await refused;
  await expect(page.getByText("Email ou mot de passe incorrect")).toBeVisible();
}

const PENDING_HINT = "Votre compte attend l'accord de l'administrateur. Vous recevrez un email dès qu'il est prêt.";

/** Signed up, not accepted yet: the login works (status « pending », no pharmacy, no
 *  permission); « Aller à mon espace » opens the app with no menu entry and a 404 that says
 *  why; « Équipe » (owner page) is the same 404; « Déconnexion » stays. */
async function loginPending(page: Page, person: Person) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(person.email);
  await page.locator('input[autocomplete="current-password"]').fill(person.password);
  const me = pageSend(page, "POST", "/auth/login");
  await page.locator('button[type="submit"]').click();
  expectSame(
    await me,
    { user: { email: person.email, status: "pending", pharmacy_id: null }, pharmacy: null, permissions: [] },
    "compte en attente (POST /auth/login)",
  );
  await expect(page).not.toHaveURL(/\/login/);
  await page.getByRole("link", { name: "Aller à mon espace" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Page introuvable" })).toBeVisible();
  await expect(page.getByText(PENDING_HINT)).toBeVisible();
  await expect(page.locator("aside nav").getByRole("link"), "menu vide").toHaveCount(0);
  await page.getByRole("button", { name: "Mon compte et déconnexion" }).click();
  await expect(page.getByRole("menuitem", { name: "Mon compte", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/owner/employees");
  await expect(page.getByRole("heading", { level: 1, name: "Page introuvable" })).toBeVisible();
  await expect(page.getByText(PENDING_HINT), "« Équipe » : même 404").toBeVisible();

  const out = pageSend(page, "POST", "/auth/logout", 204);
  await page.getByRole("button", { name: "Mon compte et déconnexion" }).click();
  await page.getByRole("menuitem", { name: "Déconnexion", exact: true }).click();
  await out;
  await expect(page).toHaveURL(/\/login$/);
}

/** The login page lets this person in (home page), « Aller à mon espace » opens the app,
 *  whose header shows their pharmacy code. */
async function loginWorks(page: Page, person: Person, code: string) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(person.email);
  await page.locator('input[autocomplete="current-password"]').fill(person.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.getByRole("link", { name: "Aller à mon espace" }).first().click();
  await expect(page.getByText(code, { exact: true }).first(), "code de la pharmacie dans l'en-tête").toBeVisible();
}

/** Admin « Demandes » tab, with the list the page loaded. */
async function openRequests(page: Page, count: number): Promise<Row[]> {
  const list = pageCall<Row[]>(page, "/admin/signup-requests");
  await page.goto("/admin/pharmacies");
  await page.getByRole("tab", { name: `Demandes (${count})` }).click();
  return await list;
}

const requestRow = (page: Page, email: string) => page.getByRole("row").filter({ hasText: email });

test.describe("visiteur", () => {
  test.use({ storageState: LOGGED_OUT });

  test("nouvelle pharmacie : 5 écrans, « Suivant » grisé jusqu'au choix, demande envoyée, connexion en attente (menu vide)", async ({
    page,
  }) => {
    // Screen 1 of 5: « Suivant » waits for a choice; a wrong field stops on its screen.
    await page.goto("/login");
    await page.getByRole("link", { name: "Créer un compte" }).click();
    await expect(page.getByText("Créer un compte · Étape 1 sur 5")).toBeVisible();
    await expect(page.getByRole("button", { name: "Suivant" })).toBeDisabled();
    await expect(page.getByText("Choisissez une des 3 options.")).toBeVisible();
    await page.getByRole("radio", { name: /^Propriétaire d'une nouvelle pharmacie/ }).click();
    await page.getByRole("button", { name: "Suivant" }).click();
    await page.getByRole("button", { name: "Suivant" }).click(); // empty pharmacy name → stays
    await expect(page.getByText("Ce champ est requis.").first()).toBeVisible();
    await expect(page.getByText("Créer un compte · Étape 2 sur 5")).toBeVisible();

    await signUp(page, "Propriétaire d'une nouvelle pharmacie", NEW_OWNER, NEW_PHARMACY);
    await loginPending(page, NEW_OWNER);
  });

  test("code inconnu, email déjà utilisé : même réponse « Demande envoyée » ; l'email déjà utilisé n'a pas de 2e compte", async ({
    page,
  }) => {
    await signUp(page, "Employé d'une pharmacie", UNKNOWN_CODE, { code: "ZZZ9999" });
    await signUp(page, "Propriétaire d'une pharmacie déjà inscrite", TAKEN, { code: "CAS0001" });
    await loginRefused(page, TAKEN);
  });
});

test.describe("admin", () => {
  test.use({ storageState: sessionFile("admin") });

  test("« Demandes (3) » : ce qui bloque « Accepter » est montré ; « Accepter » crée la pharmacie et le compte", async ({
    page,
  }) => {
    // The waiting accounts are in « Demandes » only, not in « Utilisateurs ».
    const users = pageCall<Row[]>(page, "/admin/users");
    await page.goto("/admin/pharmacies");
    await page.getByRole("tab", { name: "Utilisateurs", exact: true }).click();
    const emails = (await users).map((u) => u.email);
    for (const person of [NEW_OWNER, UNKNOWN_CODE]) {
      expect(emails, `« Utilisateurs » sans ${person.email} (en attente)`).not.toContain(person.email);
    }
    await expect(page.getByText("admin@gmail.com").first(), "la liste est chargée").toBeVisible();
    await expect(page.getByText(NEW_OWNER.email)).toHaveCount(0);

    const rows = await openRequests(page, 3);
    const byEmail = (email: string) => rows.find((r) => r.email === email);
    expectSame(
      byEmail(NEW_OWNER.email),
      {
        role: "owner",
        full_name: NEW_OWNER.name,
        phone: NEW_OWNER.phone,
        pharmacy_code: null,
        new_pharmacy_name: NEW_PHARMACY.name,
        new_pharmacy_city: NEW_PHARMACY.city,
        new_pharmacy_address: null,
        email_taken: false,
        code_unknown: false,
      },
      "nouvelle pharmacie",
    );
    expectSame(
      byEmail(UNKNOWN_CODE.email),
      { role: "employee", pharmacy_code: "ZZZ9999", pharmacy: null, code_unknown: true, email_taken: false },
      "code inconnu",
    );
    expectSame(
      byEmail(TAKEN.email),
      { role: "owner", pharmacy_code: "CAS0001", email_taken: true, code_unknown: false },
      "email déjà utilisé",
    );

    // On screen: what blocks « Accepter » (greyed out, with the reason).
    await expect(requestRow(page, NEW_OWNER.email).getByText("Rien à signaler")).toBeVisible();
    await expect(requestRow(page, UNKNOWN_CODE.email).getByText("Code inconnu", { exact: true })).toBeVisible();
    await expect(requestRow(page, UNKNOWN_CODE.email).getByRole("button", { name: "Accepter" })).toBeDisabled();
    await expect(requestRow(page, TAKEN.email).getByText("Email déjà utilisé", { exact: true })).toBeVisible();
    await expect(requestRow(page, TAKEN.email).getByRole("button", { name: "Accepter" })).toBeDisabled();

    await requestRow(page, NEW_OWNER.email).getByRole("button", { name: "Accepter" }).click();
    const dialog = page.getByRole("dialog", { name: `Accepter la demande de ${NEW_OWNER.name} ?` });
    await expect(dialog.getByText(NEW_PHARMACY.name, { exact: false })).toBeVisible();
    const accepted = pageSend(page, "POST", /^\/v1\/admin\/signup-requests\/\d+\/accept$/);
    await dialog.getByRole("button", { name: "Accepter", exact: true }).click();
    const res = await accepted;
    expect(res.pharmacy_code, "code de la ville (Tanger)").toMatch(/^TAN\d{4}$/);
    await expect(page.getByText(`Compte créé · pharmacie ${res.pharmacy_code}`)).toBeVisible();
    await expect(page.getByRole("tab", { name: "Demandes (2)" })).toBeVisible();
    await lastSignupEmail(NEW_OWNER.email, "ACCEPTED");
    saveState({ signupPharmacyCode: res.pharmacy_code });

    // The new pharmacy is in the « Pharmacies » tab (exact check: its city + every feature on).
    await page.getByRole("tab", { name: "Pharmacies", exact: true }).click();
    await expect(page.getByText(NEW_PHARMACY.name).first()).toBeVisible();
    const created = (await apiGet<Row[]>(page, "/admin/pharmacies")).find((p) => p.code === res.pharmacy_code);
    expectSame(created, { name: NEW_PHARMACY.name, city: NEW_PHARMACY.city }, "pharmacie créée");
    const detail = await apiGet<Row>(page, `/admin/pharmacies/${created!.id}`);
    expect([...detail.enabled_features].sort(), "toutes les fonctionnalités, Étiquette / Commander coupées").toEqual(
      [...PHARMACY_FEATURES].sort(),
    );
  });

  test("« Refuser » les 2 autres : rien n'est créé, un email part", async ({ page }) => {
    await openRequests(page, 2);
    for (const person of [UNKNOWN_CODE, TAKEN]) {
      await requestRow(page, person.email).getByRole("button", { name: "Refuser" }).click();
      const refused = pageSend(page, "POST", /^\/v1\/admin\/signup-requests\/\d+\/refuse$/, 204);
      await page
        .getByRole("dialog", { name: `Refuser la demande de ${person.name} ?` })
        .getByRole("button", { name: "Refuser", exact: true })
        .click();
      await refused;
      await lastSignupEmail(person.email, "REFUSED");
    }
    await expect(page.getByText("Aucune demande en attente.")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Demandes (0)" })).toBeVisible();
  });
});

test.describe("après l'accord", () => {
  test.use({ storageState: LOGGED_OUT });

  test("le nouveau propriétaire se connecte ; le refusé non", async ({ page }) => {
    await loginWorks(page, NEW_OWNER, loadState().signupPharmacyCode);
    await page.context().clearCookies();
    await loginRefused(page, UNKNOWN_CODE);
  });

  test("un employé rejoint la nouvelle pharmacie avec son code (tapé en minuscules) ; connexion en attente", async ({
    page,
  }) => {
    await signUp(page, "Employé d'une pharmacie", EMPLOYEE, { code: loadState().signupPharmacyCode.toLowerCase() });
    await loginPending(page, EMPLOYEE);
  });
});

test.describe("admin, employé", () => {
  test.use({ storageState: sessionFile("admin") });

  test("« Accepter » l'employé : son compte est créé dans cette pharmacie", async ({ page }) => {
    const code: string = loadState().signupPharmacyCode;
    const rows = await openRequests(page, 1);
    expectSame(
      rows[0],
      { email: EMPLOYEE.email, role: "employee", pharmacy_code: code, pharmacy: { code, name: NEW_PHARMACY.name } },
      "employé",
    );
    await expect(requestRow(page, EMPLOYEE.email).getByText(`Rejoindre ${code}`)).toBeVisible();
    await requestRow(page, EMPLOYEE.email).getByRole("button", { name: "Accepter" }).click();
    const accepted = pageSend(page, "POST", /^\/v1\/admin\/signup-requests\/\d+\/accept$/);
    await page
      .getByRole("dialog", { name: `Accepter la demande de ${EMPLOYEE.name} ?` })
      .getByRole("button", { name: "Accepter", exact: true })
      .click();
    expectSame(await accepted, { pharmacy_code: code }, "POST accept");
    await lastSignupEmail(EMPLOYEE.email, "ACCEPTED");
  });
});

test.describe("après l'accord, employé", () => {
  test.use({ storageState: LOGGED_OUT });

  test("l'employé se connecte dans sa pharmacie", async ({ page }) => {
    await loginWorks(page, EMPLOYEE, loadState().signupPharmacyCode);
  });
});
