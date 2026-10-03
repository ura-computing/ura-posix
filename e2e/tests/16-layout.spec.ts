/** The frame around every page (owner), through the header / sidebar buttons:
 *  - FR ⇄ ES: every page title translated, the choice kept after a reload, the
 *    « no access » 404 too (inside the frame, sidebar kept);
 *  - theme Sombre (kept after a reload) / Clair / Système (follows the computer);
 *  - sidebar « Réduire le menu » (icons only, kept after a reload, icons still
 *    work) / « Étendre le menu »;
 *  - session ended elsewhere (401): « Session expirée » → « Plus tard » keeps the
 *    page, « Actualiser » → login page; a refused login there, in Spanish.
 *  Only this browser's cookies are removed: the saved owner session stays valid. */
import type { Page } from "@playwright/test";

import { sessionFile } from "../lib/auth";
import { expect, test } from "../lib/fixtures";
import { pageSend } from "../lib/ui";

test.use({ storageState: sessionFile("owner") });

/** Owner page → its title in French, in Spanish. */
const PAGES: [string, string, string][] = [
  ["/rapport", "Tableau de bord", "Panel de control"],
  ["/achats", "Achats", "Compras"],
  ["/ventes", "Ventes", "Ventas"],
  ["/stock", "Stock", "Stock"],
  ["/analyses", "Analyse de marge", "Análisis de margen"],
  ["/alertes", "Alertes", "Alertas"],
  ["/comptabilite", "Comptabilité", "Contabilidad"],
  ["/produits-speciaux", "Produits spéciaux", "Productos especiales"],
  ["/imports", "Gestion des imports", "Gestión de importaciones"],
  ["/owner/employees", "Gérer mon équipe", "Gestionar mi equipo"],
  ["/auth/me", "Mon compte", "Mi cuenta"],
];

const title = (page: Page, name: string) =>
  page.getByRole("heading", { level: 1, name, exact: true });

async function openAccount(page: Page): Promise<void> {
  await page.goto("/auth/me");
  await expect(title(page, "Mon compte")).toBeVisible();
}

test("FR ⇄ ES : chaque page traduite, choix gardé", async ({ page }) => {
  const sidebar = page.locator("aside");
  await openAccount(page);
  await page.getByRole("button", { name: "Espagnol", exact: true }).click();
  await expect(title(page, "Mi cuenta")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");

  for (const [path, , es] of PAGES) {
    await test.step(path, async () => {
      await page.goto(path); // full reload: the language is remembered
      await expect(title(page, es)).toBeVisible();
    });
  }

  await test.step("page sans accès : 404 dans le cadre", async () => {
    await page.goto("/admin/pharmacies");
    await expect(
      page.getByText("Página no encontrada", { exact: true }),
    ).toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Compras", exact: true }),
    ).toBeVisible();
  });

  await test.step("retour en français", async () => {
    await page.getByRole("button", { name: "Francés", exact: true }).click();
    await expect(
      page.getByText("Page introuvable", { exact: true }),
    ).toBeVisible();
    await expect(
      sidebar.getByRole("link", { name: "Achats", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("Page introuvable", { exact: true }),
    ).toBeVisible();
  });
});

test("thème : Sombre (gardé), Clair, Système (suit l'ordinateur)", async ({
  page,
}) => {
  const html = page.locator("html");
  await openAccount(page);
  await page.getByRole("button", { name: "Sombre", exact: true }).click();
  await expect(html).toHaveClass(/\bdark\b/);
  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);
  await expect(
    page.getByRole("button", { name: "Sombre", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Clair", exact: true }).click();
  await expect(html).not.toHaveClass(/\bdark\b/);

  await page.emulateMedia({ colorScheme: "dark" }); // the computer is in dark mode
  await page.getByRole("button", { name: "Système", exact: true }).click();
  await expect(html).toHaveClass(/\bdark\b/);
  await page.emulateMedia({ colorScheme: "light" }); // ... and switches back: the page follows
  await expect(html).not.toHaveClass(/\bdark\b/);
});

test("menu : Réduire (gardé, icônes cliquables), Étendre", async ({ page }) => {
  const sidebar = page.locator("aside");
  const label = sidebar.getByText("Achats", { exact: true });
  await openAccount(page);
  await expect(label).toBeVisible();

  await page
    .getByRole("button", { name: "Réduire le menu", exact: true })
    .click();
  await expect(label).toBeHidden(); // icons only
  await page.reload();
  await expect(title(page, "Mon compte")).toBeVisible();
  await expect(label).toBeHidden();
  await sidebar.locator('a[href="/achats"]').click();
  await expect(title(page, "Achats")).toBeVisible();

  await page
    .getByRole("button", { name: "Étendre le menu", exact: true })
    .click();
  await expect(label).toBeVisible();
});

test("session terminée ailleurs (401) : « Session expirée » → Plus tard / Actualiser → connexion", async ({
  page,
}) => {
  const sidebar = page.locator("aside");
  await openAccount(page);
  // This browser loses its session: every next call answers 401.
  await page.context().clearCookies();

  await test.step("« Plus tard » : le message se ferme, la page reste", async () => {
    const refused = page.waitForResponse(
      (res) =>
        new URL(res.url()).pathname.startsWith("/v1/") && res.status() === 401,
    );
    await sidebar
      .getByRole("link", { name: "Comptabilité", exact: true })
      .click();
    await refused;
    const dialog = page.getByRole("dialog", { name: "Session expirée" });
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("button", { name: "Plus tard", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    await expect(sidebar).toBeVisible();
  });

  await test.step("en espagnol : « Actualizar » → page de connexion", async () => {
    await page.getByRole("button", { name: "Espagnol", exact: true }).click();
    await sidebar.getByRole("link", { name: "Compras", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Sesión expirada" });
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("button", { name: "Actualizar", exact: true })
      .click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(title(page, "Iniciar sesión")).toBeVisible();
  });

  await test.step("connexion refusée : message en espagnol", async () => {
    await page.locator('input[type="email"]').fill("personne@pharmagest.ma");
    await page
      .locator('input[autocomplete="current-password"]')
      .fill("Mauvais#2026");
    const refused = pageSend(page, "POST", "/auth/login", 401);
    await page.locator('button[type="submit"]').click();
    expect((await refused).code, "code d'erreur").toBe("badCredentials");
    await expect(
      page.getByText("Correo o contraseña incorrectos", { exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
