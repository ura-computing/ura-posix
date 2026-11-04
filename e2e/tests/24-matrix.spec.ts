/** Every page × every edge case, from one list (lib/pages.ts), through the UI:
 *  1. who opens it (owner, employee, admin): its sidebar link opens it; any other page = no menu entry, 404 inside the
 *     layout (sidebar kept);
 *  2. a feature switched OFF by the admin, a permission removed from an employee by the owner: no menu entry, 404
 *     inside the layout, its API refused (403 `featureDisabled`); given back after, the page opens again;
 *  4. the page's main GET fails (server error, no connection): the reason in plain words (toast), the title and the
 *     sidebar stay, the page says it could not load, « Réessayer » loads it once the API is back;
 *  5. the page's main GET is slow: the title and a skeleton at once (never blank, never an error), then the page.
 *  4 and 5 as owner and admin: an employee's pages are the owner's (same screens, same GET).
 *  The faked answers (fakeApi) are not recorded: the gates judge the real API. */
import { resolve } from "node:path";
import type { Page } from "@playwright/test";

import { apiDelete, apiGet, apiPost, apiPut } from "../lib/api";
import { ALL_FEATURES, LOGGED_OUT, loadState, sessionFile } from "../lib/auth";
import { expect, fakeApi, test } from "../lib/fixtures";
import { STATE_DIR } from "../lib/paths";
import { OPENERS, PAGES, pagesOf, splitGet, type AppPage, type Opener } from "../lib/pages";

const EMPLOYEE = {
  full_name: "Employé Matrice",
  email: "employe.matrice@pharmagest.ma",
  password: "EmployeMatrice#2026",
};
const SESSIONS: Record<Opener, string> = {
  owner: sessionFile("owner"),
  admin: sessionFile("admin"),
  employee: resolve(STATE_DIR, "employee-matrix.json"),
};
let employeeId: number;

/** The texts of `errors.serverError` and `toast.networkError` (fr.ts). */
const REASON = {
  error: "Le logiciel a rencontré un problème. Réessayez dans quelques minutes.",
  down: "Le logiciel ne répond pas pour le moment. Réessayez dans quelques minutes.",
} as const;

const title = (page: Page, name: string) => page.getByRole("heading", { level: 1, name, exact: true });
/** A page's sidebar link, by its address: its name can carry a count (« Catalogue » + « 5 non classés »). */
const menuLink = (page: Page, path: string) => page.locator(`aside a[href="${path}"]`);
const atPath = (path: string) => new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\?|$)`);
const isGet = (path: string) => (r: { url(): string; request(): { method(): string } }) =>
  new URL(r.url()).pathname === `/v1${path}` && r.request().method() === "GET";

/** A page opened like a user: its sidebar link from « Mon compte » (every account has it), else its address. */
async function open(page: Page, p: AppPage): Promise<void> {
  await page.goto("/auth/me");
  await expect(title(page, "Mon compte")).toBeVisible();
  if (p.nav) {
    await expect(menuLink(page, p.path), `« ${p.nav} » dans le menu`).toContainText(p.nav);
    await menuLink(page, p.path).click();
  } else await page.goto(p.path);
  await expect(page).toHaveURL(atPath(p.path));
  await expect(title(page, p.title), p.path).toBeVisible();
}

/** A page this account may not open: no menu entry, its address = 404 inside the layout. */
async function refused(page: Page, p: AppPage): Promise<void> {
  await page.goto("/auth/me");
  await expect(title(page, "Mon compte")).toBeVisible();
  if (p.nav) await expect(menuLink(page, p.path), `pas de « ${p.nav} » dans le menu`).toHaveCount(0);
  await page.goto(p.path);
  await expect(title(page, "Page introuvable"), p.path).toBeVisible();
  await expect(page.locator("aside"), "le menu reste").toBeVisible();
  await expect(page, "pas de redirection").toHaveURL(atPath(p.path));
}

/** A page whose feature is off for this account: refused, and its main GET too. */
async function switchedOff(page: Page, p: AppPage, main: string | null): Promise<void> {
  await refused(page, p);
  if (!main) return;
  const { path, params } = splitGet(main);
  expect((await apiGet(page, path, params, 403)).code, `GET ${path} refusé`).toBe("featureDisabled");
}

// The employee: created by the owner (again on a retry), logged in through the login page.
test.beforeAll(async ({ browser }) => {
  const ownerCtx = await browser.newContext({ storageState: SESSIONS.owner });
  const owner = await ownerCtx.newPage();
  const { employees } = await apiGet(owner, "/owner/employees");
  for (const e of employees.filter((e: { email: string }) => e.email === EMPLOYEE.email))
    await apiDelete(owner, `/owner/employees/${e.id}`, 204);
  const { member } = await apiPost(owner, "/owner/employees", {
    ...EMPLOYEE,
    role: "employee",
    pharmacy_id: loadState().pharmacyId,
  });
  employeeId = member.id;
  await ownerCtx.close();

  const ctx = await browser.newContext({ storageState: LOGGED_OUT });
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(EMPLOYEE.email);
  await page.locator('input[autocomplete="current-password"]').fill(EMPLOYEE.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login/);
  await ctx.storageState({ path: SESSIONS.employee });
  await ctx.close();
});

test.afterAll(async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: SESSIONS.owner });
  if (employeeId) await apiDelete(await ctx.newPage(), `/owner/employees/${employeeId}`, 204);
  await ctx.close();
});

for (const who of OPENERS) {
  test.describe(who, () => {
    test.use({ storageState: SESSIONS[who] });

    test(`${who} : ses pages par le menu, les autres = 404 dans le cadre`, async ({ page }) => {
      test.setTimeout(3 * 60_000);
      for (const p of PAGES) {
        await test.step(p.path, () => (who in p.open ? open(page, p) : refused(page, p)));
      }
      await test.step("404 : « Retour à l'accueil »", async () => {
        await page.goto(PAGES.find((p) => !(who in p.open))!.path); // every account has a page it may not open
        await page.getByRole("link", { name: "Retour à l'accueil", exact: true }).click();
        await expect(page).toHaveURL(/\/$/);
      });
    });
  });
}

test.describe("owner", () => {
  test.use({ storageState: SESSIONS.owner });

  test("owner : chaque fonctionnalité coupée par l'administrateur, puis rendue", async ({ page, browser }) => {
    test.setTimeout(5 * 60_000);
    const ctx = await browser.newContext({ storageState: SESSIONS.admin });
    const admin = await ctx.newPage();
    const features = `/admin/pharmacies/${loadState().pharmacyId}/features`;
    try {
      for (const feature of ALL_FEATURES) {
        await test.step(feature, async () => {
          const pages = PAGES.filter((p) => p.feature === feature && "owner" in p.open);
          await apiPut(admin, features, { features: { [feature]: false } });
          try {
            for (const p of pages) await switchedOff(page, p, p.open.owner ?? null);
          } finally {
            await apiPut(admin, features, { features: { [feature]: true } });
          }
          for (const p of pages) await open(page, p);
        });
      }
    } finally {
      await ctx.close();
    }
  });
});

test.describe("employee", () => {
  test.use({ storageState: SESSIONS.employee });

  test("employé : chaque permission retirée par le propriétaire, puis rendue", async ({ page, browser }) => {
    test.setTimeout(5 * 60_000);
    const ctx = await browser.newContext({ storageState: SESSIONS.owner });
    const owner = await ctx.newPage();
    const permissions = `/owner/employees/${employeeId}/permissions`;
    const mine = pagesOf("employee").filter((p) => p.feature);
    try {
      for (const feature of [...new Set(mine.map((p) => p.feature as string))]) {
        await test.step(feature, async () => {
          const pages = mine.filter((p) => p.feature === feature);
          await apiPut(owner, permissions, { permissions: { [feature]: false } });
          try {
            for (const p of pages) await switchedOff(page, p, p.main);
          } finally {
            await apiPut(owner, permissions, { permissions: { [feature]: true } });
          }
          for (const p of pages) await open(page, p);
        });
      }
    } finally {
      await ctx.close();
    }
  });
});

for (const who of ["owner", "admin"] as const) {
  test.describe(who, () => {
    test.use({ storageState: SESSIONS[who] });

    for (const p of pagesOf(who)) {
      if (!p.main) continue;
      const { path } = splitGet(p.main);

      test(`${who} · ${p.path} : erreur du serveur, pas de connexion → message, « Réessayer »`, async ({ page }) => {
        for (const how of ["error", "down"] as const) {
          await test.step(how, async () => {
            const back = await fakeApi(page, path, how);
            await page.goto(p.path);
            await expect(
              page.locator("[data-sonner-toast]", { hasText: REASON[how] }).first(),
              "la raison",
            ).toBeVisible();
            await expect(title(page, p.title), "le titre reste").toBeVisible();
            await expect(page.locator("aside"), "le menu reste").toBeVisible();
            const failed = page.locator("main").getByRole("alert");
            await expect(failed.first(), "la page dit qu'elle n'a pas pu charger").toBeVisible();
            await back();
            const loaded = page.waitForResponse((r) => isGet(path)(r) && r.status() === 200);
            await failed.getByRole("button", { name: "Réessayer", exact: true }).first().click();
            await loaded;
            await expect(failed, "plus d'erreur, l'API est revenue").toHaveCount(0);
          });
        }
      });

      test(`${who} · ${p.path} : réponse lente → titre + squelette tout de suite, puis la page`, async ({ page }) => {
        const back = await fakeApi(page, path, "slow");
        let arrived = false;
        const loaded = page.waitForResponse(isGet(path)).then(() => (arrived = true));
        await page.goto(p.path);
        await expect(title(page, p.title), "le titre tout de suite").toBeVisible();
        await expect(page.locator("main .animate-pulse").first(), "un squelette pendant le chargement").toBeVisible();
        await expect(page.locator("main").getByRole("alert"), "pas d'erreur").toHaveCount(0);
        expect(arrived, "vu avant la réponse").toBe(false);
        await loaded;
        await expect(page.locator("main .animate-pulse"), "le squelette fait place à la page").toHaveCount(0);
        await back();
      });
    }
  });
}
