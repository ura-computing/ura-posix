/** Mon compte + mot de passe oublié, with a dedicated employee the owner
 *  creates through the API: profile (form errors, PATCH /auth/me), sessions
 *  (list, end one device, end all others), change password (form errors, wrong
 *  current one), log out (session row), then « Mot de passe oublié » →
 *  magic link (backend log) → validate-token → set-password → the link a 2nd
 *  time (« Lien expiré »), the old password refused, login with the new one.
 *  Serial. The session file is saved again after every cookie change. */
import type { Page } from "@playwright/test";

import { apiGet, apiPost } from "../lib/api";
import { LOGGED_OUT, loadState, login, sessionFile } from "../lib/auth";
import { type Row } from "../lib/checks";
import { expectSame } from "../lib/diff";
import { expect, test } from "../lib/fixtures";
import { lastMagicLink } from "../lib/mail";
import { API } from "../lib/paths";
import { pageCall, pageSend } from "../lib/ui";

test.describe.configure({ mode: "serial" });

const USER = {
  name: "Compte E2E",
  email: "compte.e2e@pharmagest.ma",
  password: "CompteE2e#1",
};
const RENAMED = "Compte E2E Modifié";
const PHONE = { typed: "612345678", stored: "+212612345678" };
const PASSWORD_2 = "CompteE2e#2"; // « Changer mon mot de passe »
const PASSWORD_3 = "CompteE2e#3"; // « Mot de passe oublié »
const STATE = sessionFile("account");

async function openAccount(
  page: Page,
  tab?: "Mot de passe" | "Sessions",
): Promise<void> {
  await page.goto("/auth/me");
  await expect(
    page.getByRole("heading", { level: 1, name: "Mon compte", exact: true }),
  ).toBeVisible();
  if (tab) await page.getByRole("tab", { name: tab, exact: true }).click();
}

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: sessionFile("owner") });
  await apiPost(await ctx.newPage(), "/owner/employees", {
    full_name: USER.name,
    email: USER.email,
    password: USER.password,
    role: "employee",
    pharmacy_id: loadState().pharmacyId,
  });
  await ctx.close();
});

test.describe("première connexion", () => {
  test.use({ storageState: LOGGED_OUT });

  test("profil : nom + téléphone", async ({ page }) => {
    await login(page, USER, "account");
    await openAccount(page);
    await expect(page.getByLabel("Email")).toHaveValue(USER.email);
    // Checked in the browser before any call: empty name, phone too short.
    await page.getByLabel("Nom complet").fill("");
    await page.getByLabel("Téléphone").fill("12");
    await page
      .getByRole("button", { name: "Enregistrer", exact: true })
      .click();
    await expect(
      page.getByText("Le nom est requis.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Numéro de téléphone invalide.", { exact: true }),
    ).toBeVisible();

    await page.getByLabel("Nom complet").fill(RENAMED);
    await page.getByLabel("Téléphone").fill(PHONE.typed);
    const patched = pageSend(page, "PATCH", "/auth/me");
    await page
      .getByRole("button", { name: "Enregistrer", exact: true })
      .click();
    const want = {
      email: USER.email,
      name: RENAMED,
      phone: PHONE.stored,
      role: "employee",
    };
    expectSame((await patched).user, want, "PATCH /auth/me");
    expectSame((await apiGet(page, "/auth/me")).user, want, "GET /auth/me");
  });
});

test.describe("connecté", () => {
  test.use({ storageState: STATE });

  test("sessions : fermer un appareil, puis tous les autres", async ({
    page,
    playwright,
  }) => {
    for (const _device of [1, 2]) {
      // 2 other devices
      const other = await playwright.request.newContext();
      expect(
        (await other.post(`${API}/v1/auth/login`, { data: USER })).status(),
      ).toBe(200);
      await other.dispose();
    }

    const list0 = pageCall<Row[]>(page, "/sessions");
    await openAccount(page, "Sessions");
    const s0 = await list0;
    expect(s0.length, "3 sessions").toBe(3);
    expect(s0.filter((s) => s.is_current).length, "1 seule courante").toBe(1);

    // Rows come in API order: the first non-current row is the first non-current session.
    const other = s0.find((s) => !s.is_current)!;
    const killed = pageSend(page, "DELETE", `/sessions/${other.id}`, 204);
    const list1 = pageCall<Row[]>(page, "/sessions");
    await page
      .getByRole("listitem")
      .filter({ hasNotText: "cette session" })
      .first()
      .getByRole("button", { name: "Déconnecter", exact: true })
      .click();
    await killed;
    expect(
      (await list1).map((s) => s.id),
      "sessions après fermeture",
    ).toEqual(s0.filter((s) => s !== other).map((s) => s.id));

    await page
      .getByRole("button", {
        name: "Déconnecter toutes les autres sessions (1)",
      })
      .click();
    const revoked = pageSend(page, "POST", "/sessions/revoke-others", 204);
    const list2 = pageCall<Row[]>(page, "/sessions");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Déconnecter", exact: true })
      .click();
    await revoked;
    const s2 = await list2;
    expect(
      s2.map((s) => s.is_current),
      "seule la session courante reste",
    ).toEqual([true]);
  });

  test("changer le mot de passe (cet appareil reste connecté)", async ({
    page,
  }) => {
    await openAccount(page, "Mot de passe");
    const current = page.getByLabel("Mot de passe actuel", { exact: true });
    const next = page.getByLabel("Nouveau mot de passe", { exact: true });
    const confirm = page.getByLabel("Confirmer le nouveau mot de passe", {
      exact: true,
    });
    const change = page.getByRole("button", { name: "Changer", exact: true });

    // Checked in the browser before any call: too short, then the 2 new ones differ.
    await current.fill(USER.password);
    await next.fill("court");
    await confirm.fill("court");
    await change.click();
    await expect(
      page.getByText("Minimum 8 caractères.", { exact: true }),
    ).toBeVisible();
    await next.fill(PASSWORD_2);
    await confirm.fill(`${PASSWORD_2}x`);
    await change.click();
    await expect(
      page.getByText("Les mots de passe ne correspondent pas.", {
        exact: true,
      }),
    ).toBeVisible();

    // Wrong current password: refused by the server (400, not 401: no « Session expirée »).
    await current.fill("Mauvais#2026");
    await confirm.fill(PASSWORD_2);
    const refused = pageSend(page, "POST", "/auth/change-password", 400);
    await change.click();
    expect((await refused).code, "code d'erreur").toBe("wrongPassword");
    await expect(
      page.getByText(/^Mot de passe actuel incorrect\.?$/).first(),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await current.fill(USER.password);
    const changed = pageSend(page, "POST", "/auth/change-password", 204);
    await change.click();
    await changed;
    expect(
      (await apiGet(page, "/auth/me")).user.email,
      "toujours connecté",
    ).toBe(USER.email);
    await page.context().storageState({ path: STATE });
  });

  // The menu « Déconnexion » is checked in 12-equipe.
  test("se déconnecter : bouton « Se déconnecter » de cette session", async ({
    page,
  }) => {
    await openAccount(page, "Sessions");
    const out = pageSend(page, "POST", "/auth/logout", 204);
    await page
      .getByRole("listitem")
      .filter({ hasText: "cette session" })
      .getByRole("button", { name: "Se déconnecter", exact: true })
      .click();
    await out;
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/auth/me"); // the session is really gone
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("déconnecté", () => {
  test.use({ storageState: LOGGED_OUT });

  test("mot de passe oublié → lien → nouveau mot de passe → connexion", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
    // In-app navigation: the login page's own « Email » field is still there for a moment.
    await expect(
      page.getByRole("heading", { level: 1, name: "Mot de passe oublié" }),
    ).toBeVisible();
    await page.getByLabel("Email").fill(USER.email);
    const sent = pageSend(page, "POST", "/auth/forgot-password");
    await page.getByRole("button", { name: "Envoyer le lien" }).click();
    expect(await sent).toEqual({
      detail: "Si votre compte existe, un email a été envoyé",
    });
    await expect(
      page.getByRole("heading", { name: "Vérifiez votre boîte de réception" }),
    ).toBeVisible();

    const link = await lastMagicLink(USER.email);
    const token = new URL(link).searchParams.get("token")!;
    const valid = pageCall(page, "/auth/validate-token", { token });
    await page.goto(link);
    expect(await valid, "validate-token").toEqual({
      is_setup: false,
      full_name: RENAMED,
    });

    await page
      .getByLabel("Nouveau mot de passe", { exact: true })
      .fill(PASSWORD_3);
    await page
      .getByLabel("Confirmer le nouveau mot de passe", { exact: true })
      .fill(PASSWORD_3);
    const set = pageSend(page, "POST", "/auth/set-password", 204);
    await page
      .getByRole("button", { name: "Réinitialiser mon mot de passe" })
      .click();
    await set;
    await expect(page).toHaveURL(/\/login$/);

    // The link works once: opened again → « Lien expiré ».
    const used = page.waitForResponse(
      (res) => new URL(res.url()).pathname === "/v1/auth/validate-token",
    );
    await page.goto(link);
    expect((await used).status(), "lien déjà utilisé").toBe(400);
    await expect(
      page.getByRole("heading", { level: 2, name: "Lien expiré" }),
    ).toBeVisible();

    // The old password is gone (error toast, still on /login); the new one logs in.
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(USER.email);
    await page
      .locator('input[autocomplete="current-password"]')
      .fill(PASSWORD_2);
    const refused = pageSend(page, "POST", "/auth/login", 401);
    await page.locator('button[type="submit"]').click();
    await refused;
    await expect(
      page.getByText("Email ou mot de passe incorrect"),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await login(page, { ...USER, password: PASSWORD_3 }, "account");
  });
});
