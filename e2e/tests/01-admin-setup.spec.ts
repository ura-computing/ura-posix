/** Admin creates the E2E pharmacy and its owner through the UI.
 *  Checks: every feature is on by default, the owner gets every permission,
 *  the password is the one typed, the reveal offers the Gmail link. */
import { apiGet } from "../lib/api";
import {
  ADMIN,
  ALL_FEATURES,
  OWNER,
  PHARMACY,
  login,
  saveState,
} from "../lib/auth";
import { expect, test } from "../lib/fixtures";

test("backend: /health", async ({ page }) => {
  expect(await apiGet(page, "/health")).toBeTruthy(); // only route no page calls (Docker healthcheck)
});

test("admin: crée la pharmacie E2E et son propriétaire", async ({ page }) => {
  await login(page, ADMIN, "admin");

  // ── Pharmacy ────────────────────────────────────────────────────────────
  await page.goto("/admin/pharmacies");
  await page.getByRole("button", { name: "Nouvelle pharmacie" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nom").fill(PHARMACY.name);
  await dialog.getByLabel("Ville").fill(PHARMACY.city);
  await dialog.getByRole("button", { name: "Créer la pharmacie" }).click();
  await page.waitForURL(/\/admin\/pharmacies\/\d+$/);

  const pharmacyId = Number(new URL(page.url()).pathname.split("/").pop());
  const pharmacy = await apiGet(page, `/admin/pharmacies/${pharmacyId}`);
  expect(pharmacy.code, "code derived from the city").toMatch(/^BOU\d{4}$/);
  expect(
    [...pharmacy.enabled_features].sort(),
    "all features on by default",
  ).toEqual([...ALL_FEATURES].sort());

  // ── Owner (password typed by the admin) ─────────────────────────────────
  await page.getByRole("button", { name: "Nouvel utilisateur" }).click();
  await dialog.getByLabel("Nom complet").fill(OWNER.name);
  await dialog.getByLabel("Email").fill(OWNER.email);
  await dialog.getByLabel("Mot de passe", { exact: true }).fill(OWNER.password);
  await dialog.getByRole("button", { name: /^Propriétaire/ }).click();
  await dialog.getByRole("button", { name: "Créer le compte" }).click();

  await expect(dialog.getByText("Compte créé", { exact: true })).toBeVisible();
  await expect(dialog.getByText(OWNER.password)).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: "Ouvrir dans Gmail" }),
  ).toHaveAttribute("href", /mail\.google\.com\/mail\/\?view=cm/);
  await dialog.getByRole("button", { name: "Fermer" }).last().click();

  const after = await apiGet(page, `/admin/pharmacies/${pharmacyId}`);
  const owner = after.members.find(
    (m: { email: string }) => m.email === OWNER.email,
  );
  expect(owner?.role).toBe("owner");
  expect(
    [...owner.granted_permissions].sort(),
    "all permissions by default",
  ).toEqual([...ALL_FEATURES].sort());

  saveState({ pharmacyId });
});
