/** Mon compte + mot de passe oublié, with a dedicated employee the owner
 *  creates through the API: profile (PATCH /auth/me), sessions (list, end one
 *  device, end all others), change password, then « Mot de passe oublié » →
 *  magic link (backend log) → validate-token → set-password → login with it.
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

const USER = { name: "Compte E2E", email: "compte.e2e@pharmagest.ma", password: "CompteE2e#1" };
const RENAMED = "Compte E2E Modifié";
const PHONE = { typed: "612345678", stored: "+212612345678" };
const PASSWORD_2 = "CompteE2e#2";   // « Changer mon mot de passe »
const PASSWORD_3 = "CompteE2e#3";   // « Mot de passe oublié »
const STATE = sessionFile("account");

async function openAccount(page: Page, tab?: "Mot de passe" | "Sessions"): Promise<void> {
  await page.goto("/auth/me");
  await expect(page.getByRole("heading", { level: 1, name: "Mon compte", exact: true })).toBeVisible();
  if (tab) await page.getByRole("button", { name: tab, exact: true }).click();
}


test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: sessionFile("owner") });
  await apiPost(await ctx.newPage(), "/owner/employees",
    { full_name: USER.name, email: USER.email, password: USER.password, role: "employee", pharmacy_id: loadState().pharmacyId });
  await ctx.close();
});


test.describe("première connexion", () => {
  test.use({ storageState: LOGGED_OUT });

  test("profil : nom + téléphone", async ({ page }) => {
    await login(page, USER, "account");
    await openAccount(page);
    await expect(page.getByLabel("Email")).toHaveValue(USER.email);
    await page.getByLabel("Nom complet").fill(RENAMED);
    await page.getByLabel("Téléphone").fill(PHONE.typed);
    const patched = pageSend(page, "PATCH", "/auth/me");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    const want = { email: USER.email, name: RENAMED, phone: PHONE.stored, role: "employee" };
    expectSame((await patched).user, want, "PATCH /auth/me");
    expectSame((await apiGet(page, "/auth/me")).user, want, "GET /auth/me");
  });
});


test.describe("connecté", () => {
  test.use({ storageState: STATE });

  test("sessions : fermer un appareil, puis tous les autres", async ({ page, playwright }) => {
    for (const _device of [1, 2]) {                    // 2 other devices
      const other = await playwright.request.newContext();
      expect((await other.post(`${API}/v1/auth/login`, { data: USER })).status()).toBe(200);
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
    await page.getByRole("listitem").filter({ hasNotText: "cette session" }).first()
      .getByRole("button", { name: "Déconnecter", exact: true }).click();
    await killed;
    expect((await list1).map((s) => s.id), "sessions après fermeture").toEqual(s0.filter((s) => s !== other).map((s) => s.id));

    await page.getByRole("button", { name: "Déconnecter toutes les autres sessions (1)" }).click();
    const revoked = pageSend(page, "POST", "/sessions/revoke-others", 204);
    const list2 = pageCall<Row[]>(page, "/sessions");
    await page.getByRole("dialog").getByRole("button", { name: "Déconnecter", exact: true }).click();
    await revoked;
    const s2 = await list2;
    expect(s2.map((s) => s.is_current), "seule la session courante reste").toEqual([true]);
  });

  test("changer le mot de passe (cet appareil reste connecté)", async ({ page }) => {
    await openAccount(page, "Mot de passe");
    await page.getByLabel("Mot de passe actuel", { exact: true }).fill(USER.password);
    await page.getByLabel("Nouveau mot de passe", { exact: true }).fill(PASSWORD_2);
    await page.getByLabel("Confirmer le nouveau mot de passe", { exact: true }).fill(PASSWORD_2);
    const changed = pageSend(page, "POST", "/auth/change-password", 204);
    await page.getByRole("button", { name: "Changer", exact: true }).click();
    await changed;
    expect((await apiGet(page, "/auth/me")).user.email, "toujours connecté").toBe(USER.email);
    await page.context().storageState({ path: STATE });
  });
});


test.describe("déconnecté", () => {
  test.use({ storageState: LOGGED_OUT });

  test("mot de passe oublié → lien → nouveau mot de passe → connexion", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
    // In-app navigation: the login page's own « Email » field is still there for a moment.
    await expect(page.getByRole("heading", { level: 1, name: "Mot de passe oublié" })).toBeVisible();
    await page.getByLabel("Email").fill(USER.email);
    const sent = pageSend(page, "POST", "/auth/forgot-password");
    await page.getByRole("button", { name: "Envoyer le lien" }).click();
    expect(await sent).toEqual({ detail: "Si votre compte existe, un email a été envoyé" });
    await expect(page.getByRole("heading", { name: "Vérifiez votre boîte de réception" })).toBeVisible();

    const link = await lastMagicLink(USER.email);
    const token = new URL(link).searchParams.get("token")!;
    const valid = pageCall(page, "/auth/validate-token", { token });
    await page.goto(link);
    expect(await valid, "validate-token").toEqual({ is_setup: false, full_name: RENAMED });

    await page.getByLabel("Nouveau mot de passe", { exact: true }).fill(PASSWORD_3);
    await page.getByLabel("Confirmer le nouveau mot de passe", { exact: true }).fill(PASSWORD_3);
    const set = pageSend(page, "POST", "/auth/set-password", 204);
    await page.getByRole("button", { name: "Réinitialiser mon mot de passe" }).click();
    await set;
    await expect(page).toHaveURL(/\/login$/);

    // The link works once; the old password is gone; the new one logs in.
    expect((await page.request.get(`${API}/v1/auth/validate-token?token=${token}`)).status(), "lien déjà utilisé").toBe(400);
    const old = await page.request.post(`${API}/v1/auth/login`, { data: { email: USER.email, password: PASSWORD_2 } });
    expect(old.status(), "ancien mot de passe refusé").toBe(401);
    await login(page, { ...USER, password: PASSWORD_3 }, "account");
  });
});
