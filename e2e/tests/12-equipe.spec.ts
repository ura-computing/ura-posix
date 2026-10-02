/** Gérer mon équipe (owner): invite an employee (password typed by the owner,
 *  every permission on by default), remove 2 permissions, reset the password,
 *  deactivate / reactivate, delete a second employee (confirmation dialog).
 *  Then the employee logs in with the new password: /auth/me carries the
 *  restricted set, a blocked page shows the 404 INSIDE the layout, and the
 *  sidebar « Déconnexion » works. Serial: each test needs the one before. */
import type { Page } from "@playwright/test";

import { apiGet, apiPost } from "../lib/api";
import { ALL_FEATURES, LOGGED_OUT, loadState, login, saveState, sessionFile } from "../lib/auth";
import { type Row } from "../lib/checks";
import { expectSame } from "../lib/diff";
import { expect, test } from "../lib/fixtures";
import { pageCall, pageSend } from "../lib/ui";


test.describe.configure({ mode: "serial" });

const EMP = { name: "Employé E2E", email: "employe.e2e@pharmagest.ma", password: "EmployeE2e#1" };
const NEW_PASSWORD = "EmployeE2e#2";
const REMOVED = ["stock", "analyse"];
const GRANTED = ALL_FEATURES.filter((f) => !REMOVED.includes(f)).sort();

const employeeId = (): number => loadState().employeeId;

/** Open the page; resolves with the list it loads. */
async function open(page: Page): Promise<Row> {
  const list = pageCall(page, "/owner/employees");
  await page.goto("/owner/employees");
  await expect(page.getByRole("heading", { level: 1, name: "Gérer mon équipe", exact: true })).toBeVisible();
  return list;
}

const row = (page: Page, email = EMP.email) => page.getByRole("row", { name: new RegExp(email) });

/** Row kebab → one menu entry. */
async function rowAction(page: Page, email: string, action: string): Promise<void> {
  await row(page, email).getByRole("button", { name: "Plus d'actions" }).click();
  await page.getByRole("menu").getByRole("button", { name: action, exact: true }).click();
}


test.describe("propriétaire", () => {
  test.use({ storageState: sessionFile("owner") });

  test("inviter un employé : mot de passe tapé, toutes les permissions", async ({ page }) => {
    const all = [...ALL_FEATURES].sort();
    expectSame(await open(page), { employees: [], pharmacy_features: all, my_permissions: all }, "équipe au départ");

    await page.getByRole("button", { name: "Inviter un employé" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: /^Propriétaire/ }), "rôle imposé : employé").toHaveCount(0);
    await dialog.getByLabel("Nom complet").fill(EMP.name);
    await dialog.getByLabel("Email").fill(EMP.email);
    await dialog.getByLabel("Mot de passe", { exact: true }).fill(EMP.password);
    const created = pageSend(page, "POST", "/owner/employees");
    const list = pageCall(page, "/owner/employees");
    await dialog.getByRole("button", { name: "Créer le compte" }).click();

    const { member } = await created;
    const want = { full_name: EMP.name, email: EMP.email, role: "employee", status: "active", granted_permissions: all };
    expectSame(member, want, "POST /owner/employees");
    expectSame((await list).employees, [{ id: member.id, ...want }], "équipe après invitation");
    await expect(dialog.getByText(EMP.password)).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Ouvrir dans Gmail" }))
      .toHaveAttribute("href", new RegExp(`to=${encodeURIComponent(EMP.email)}`));
    await dialog.getByRole("button", { name: "Fermer" }).last().click();
    saveState({ employeeId: member.id });
  });

  test("retirer 2 permissions (Stock, Analyse)", async ({ page }) => {
    await open(page);
    await row(page).getByRole("button", { name: "Gérer les permissions" }).click();
    const dialog = page.getByRole("dialog");
    // One switch per feature, in ALL_FEATURES order (components/shared/members/constants.ts).
    for (const f of REMOVED) await dialog.getByRole("switch").nth(ALL_FEATURES.indexOf(f)).click();
    const saved = pageSend(page, "PUT", `/owner/employees/${employeeId()}/permissions`);
    const list = pageCall(page, "/owner/employees");
    await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();
    expectSame(await saved, { id: employeeId(), granted_permissions: GRANTED }, "PUT permissions");
    expectSame((await list).employees[0].granted_permissions, GRANTED, "permissions dans la liste");
  });

  test("réinitialiser le mot de passe", async ({ page }) => {
    await open(page);
    await rowAction(page, EMP.email, "Réinitialiser le mot de passe");
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nouveau mot de passe", { exact: true }).fill(NEW_PASSWORD);
    const reset = pageSend(page, "POST", `/owner/employees/${employeeId()}/reset-password`);
    await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();
    expect(await reset, "POST reset-password").toEqual({ user_id: employeeId() });
    await expect(dialog.getByText("Mot de passe réinitialisé", { exact: true })).toBeVisible();
    await expect(dialog.getByText(NEW_PASSWORD)).toBeVisible();
    await dialog.getByRole("button", { name: "Fermer" }).last().click();
  });

  test("désactiver puis réactiver", async ({ page }) => {
    await open(page);
    for (const [action, status, label] of [["Désactiver", "inactive", "Inactif"], ["Réactiver", "active", "Actif"]]) {
      await test.step(action, async () => {
        const patched = pageSend(page, "PATCH", `/owner/employees/${employeeId()}/status`);
        const list = pageCall(page, "/owner/employees");
        await rowAction(page, EMP.email, action);
        expectSame(await patched, { id: employeeId(), status }, `PATCH status ${status}`);
        expect((await list).employees[0].status, "statut dans la liste").toBe(status);
        await expect(row(page)).toContainText(label);
      });
    }
  });

  test("supprimer un employé (confirmation)", async ({ page }) => {
    const other = { full_name: "Stagiaire E2E", email: "stagiaire.e2e@pharmagest.ma", password: "StagiaireE2e#1" };
    const { member } = await apiPost(page, "/owner/employees",
      { ...other, role: "employee", pharmacy_id: loadState().pharmacyId });
    await open(page);
    await rowAction(page, other.email, "Supprimer");
    const confirm = page.getByRole("dialog", { name: /^Supprimer définitivement Stagiaire E2E/ });
    const deleted = pageSend(page, "DELETE", `/owner/employees/${member.id}`, 204);
    const list = pageCall(page, "/owner/employees");
    await confirm.getByRole("button", { name: "Confirmer", exact: true }).click();
    expect(await deleted, "DELETE employee → 204, corps vide").toBeNull();
    expect((await list).employees.map((e: Row) => e.email), "équipe après suppression").toEqual([EMP.email]);
  });
});


test.describe("employé", () => {
  test.use({ storageState: LOGGED_OUT });

  test("connexion : droits restreints, 404 dans l'interface, déconnexion", async ({ page }) => {
    await login(page, { ...EMP, password: NEW_PASSWORD }, "employee");
    const me = await apiGet(page, "/auth/me");
    expectSame(me.user, { email: EMP.email, name: EMP.name, role: "employee", status: "active" }, "/auth/me");
    expect([...me.permissions].sort(), "permissions effectives").toEqual(GRANTED);
    const refused = await apiPost(page, "/owner/employees", {}, {}, 403);
    expect(refused.code, "un employé ne gère pas l'équipe (POST /owner/employees)").toBe("ownerOnly");
    await expect(page.getByRole("link", { name: "Stock", exact: true }), "menu sans Stock").toHaveCount(0);

    await page.goto("/stock");
    await expect(page.getByRole("heading", { level: 1, name: "Page introuvable" })).toBeVisible();
    const logout = page.getByRole("button", { name: "Déconnexion", exact: true });
    await expect(logout, "le menu reste là (on peut se déconnecter)").toBeVisible();

    const out = pageSend(page, "POST", "/auth/logout", 204);
    await logout.click();
    await out;
    await expect(page).toHaveURL(/\/login$/);
  });
});
