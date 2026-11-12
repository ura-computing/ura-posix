/** Lock screen (« Mon compte » → « Verrouillage », optional, off by default), on an employee of the E2E pharmacy
 *  (made by its owner, API setup; removed at the end):
 *  - off at first; on without a code → `pinRequired` (API), the code form (UI); « Annuler » puts it back off;
 *    letters dropped, two different codes refused; the code saved → on; each delay (1, 15, 30, 5 min, 15 s);
 *    « Changer mon code » → « Annuler »
 *  - 15 s without a click or a key → « Écran verrouillé » over the page, in the 2nd tab too; every route 423
 *    `screenLocked`, `/auth/me` still answers; a wrong code → the tries left (`pinWrong`); the right code in the
 *    other tab → both pages back
 *  - 5 wrong codes → logged out (`pinTooMany`); « Code oublié ? Se déconnecter » → the login page
 *  - the owner (« Gérer mon équipe ») then the admin (pharmacy page) « Réinitialiser le code » → the new code unlocks
 *  - switched off → never locked (`POST /auth/lock` does nothing).
 *  Serial: each test needs the one before. */
import type { Browser, Page } from "@playwright/test";

import { apiDelete, apiGet, apiPost, apiPut } from "../lib/api";
import { LOGGED_OUT, loadState, sessionFile } from "../lib/auth";
import { expect, recordPage, test } from "../lib/fixtures";
import { pageSend } from "../lib/ui";

test.describe.configure({ mode: "serial" });

const EMP = { full_name: "E2E Verrouillage", email: "e2e.verrouillage@pharmagest.ma", password: "Verrou#2026" };
const PIN = "123456";
const OWNER_PIN = "246810";
const ADMIN_PIN = "135790";
let employeeId = 0;

/** The employee logs in (a new session: not locked, whatever the others are). */
async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(EMP.email);
  await page.locator('input[autocomplete="current-password"]').fill(EMP.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** « Mon compte » → « Verrouillage ». */
async function openLockTab(page: Page): Promise<void> {
  await page.goto("/auth/me");
  await page.getByRole("tab", { name: "Verrouillage", exact: true }).click();
}

/** This session locked (API), then the page reloaded: the lock screen, over « Mon compte ». */
async function lockNow(page: Page): Promise<void> {
  await page.goto("/auth/me");
  await apiPost(page, "/auth/lock", {}, {}, 204);
  await page.reload();
  await expect(lockScreen(page)).toBeVisible();
}

const lockScreen = (page: Page) => page.getByRole("dialog", { name: "Écran verrouillé", exact: true });

/** A code typed on the lock screen: sent at the 6th digit. Resolves with the answer. */
async function typeCode<T = { code?: string; lock?: { locked: boolean } }>(
  page: Page,
  pin: string,
  status: number,
): Promise<T> {
  const sent = pageSend<T>(page, "POST", "/auth/unlock", status);
  await lockScreen(page).getByLabel("Code à 6 chiffres").fill(pin);
  return sent;
}

/** A page of another account (its calls and clicks count in the gates, under the test running). */
async function openAs(browser: Browser, role: "owner" | "admin"): Promise<{ page: Page; done: () => Promise<void> }> {
  const ctx = await browser.newContext({ storageState: sessionFile(role) });
  const page = await ctx.newPage();
  const flush = recordPage(page, () => test.info().title);
  return {
    page,
    done: async () => {
      await flush();
      await ctx.close();
    },
  };
}

test.beforeAll(async ({ browser }) => {
  const { page, done } = await openAs(browser, "owner");
  const { member } = await apiPost(page, "/owner/employees", {
    ...EMP,
    role: "employee",
    pharmacy_id: loadState().pharmacyId,
  });
  employeeId = member.id;
  await done();
});

test.afterAll(async ({ browser }) => {
  if (!employeeId) return;
  const { page, done } = await openAs(browser, "owner");
  await apiDelete(page, `/owner/employees/${employeeId}`, 204);
  await done();
});

test.describe("employé", () => {
  test.use({ storageState: LOGGED_OUT });

  test("« Verrouillage » : désactivé au départ, le code d'abord, « Annuler », chaque délai, « Changer mon code »", async ({
    page,
  }) => {
    await signIn(page);
    await openLockTab(page);
    const main = page.locator("main");
    const lock = page.getByRole("switch", { name: "Verrouillage automatique", exact: true });
    await expect(lock, "désactivé par défaut").toHaveAttribute("aria-checked", "false");
    expect((await apiGet(page, "/auth/me")).lock).toEqual({
      enabled: false,
      seconds: 300,
      has_pin: false,
      locked: false,
    });
    // No code yet: refused (API, exact check); the page asks for it first.
    const refused = await apiPut(page, "/auth/me/lock", { enabled: true, seconds: 300 }, 400);
    expect(refused.code, "un code d'abord").toBe("pinRequired");

    const code = page.getByLabel("Nouveau code");
    const again = page.getByLabel("Confirmer le code");
    await lock.click();
    await expect(lock, "bouge tout de suite").toHaveAttribute("aria-checked", "true");
    await expect(code).toBeVisible();
    await main.getByRole("button", { name: "Annuler", exact: true }).click();
    await expect(lock, "« Annuler » : de nouveau désactivé").toHaveAttribute("aria-checked", "false");
    await expect(code).toHaveCount(0);

    await lock.click();
    await code.fill("12a3456"); // digits only
    await expect(code).toHaveValue(PIN);
    await again.fill("654321");
    await main.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Les deux codes ne sont pas pareils.", { exact: true })).toBeVisible();
    await again.fill(PIN);
    const saved = pageSend(page, "PUT", "/auth/me/lock");
    await main.getByRole("button", { name: "Enregistrer", exact: true }).click();
    expect((await saved).lock).toEqual({ enabled: true, seconds: 300, has_pin: true, locked: false });
    await expect(page.getByText("Code enregistré : le verrouillage est activé.").first()).toBeVisible();
    await expect(lock).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("Votre code est enregistré.", { exact: true })).toBeVisible();

    // « Après » : each delay saved at once (5 min at first); 15 s kept for the next test.
    for (const [name, seconds] of [
      ["1 min", 60],
      ["15 min", 900],
      ["30 min", 1800],
      ["5 min", 300],
      ["15 s", 15],
    ] as const) {
      const button = main.getByRole("button", { name, exact: true });
      const sent = pageSend(page, "PUT", "/auth/me/lock");
      await button.click();
      expect((await sent).lock.seconds, name).toBe(seconds);
      await expect(button, name).toHaveAttribute("aria-pressed", "true");
    }

    await page.getByRole("button", { name: "Changer mon code", exact: true }).click();
    await expect(code).toBeVisible();
    await main.getByRole("button", { name: "Annuler", exact: true }).click();
    await expect(code).toHaveCount(0);
    await expect(lock, "toujours activé").toHaveAttribute("aria-checked", "true");
  });

  test("15 s sans rien toucher → « Écran verrouillé » (l'autre onglet aussi), tout refusé, mauvais code, bon code → la page revient", async ({
    page,
  }) => {
    test.setTimeout(3 * 60_000);
    await signIn(page);
    await page.goto("/auth/me");
    const other = await page.context().newPage();
    await other.goto("/auth/me");
    // Nobody clicks or types: locked after 15 s, in both tabs (the same session).
    await expect(lockScreen(page)).toBeVisible({ timeout: 45_000 });
    await expect(lockScreen(other)).toBeVisible({ timeout: 15_000 });
    await expect(lockScreen(page).getByText(EMP.full_name, { exact: false })).toBeVisible();
    expect((await apiGet(page, "/auth/me")).lock.locked, "/auth/me répond encore").toBe(true);
    const refused = await apiGet(page, "/products", { limit: 1 }, 423);
    expect(refused.code, "tout le reste refusé").toBe("screenLocked");

    // A wrong code: the tries left, the field emptied.
    const field = lockScreen(page).getByLabel("Code à 6 chiffres");
    await lockScreen(page).getByRole("button", { name: "Afficher le mot de passe", exact: true }).click();
    expect((await typeCode(page, "000000", 400)).code).toBe("pinWrong");
    await expect(lockScreen(page).getByText("Code incorrect : encore 4 essai(s).", { exact: true })).toBeVisible();
    await expect(field, "vidé").toHaveValue("");

    // The right code in the other tab: both pages back, the calls answered again.
    expect((await typeCode(other, PIN, 200)).lock?.locked).toBe(false);
    await expect(lockScreen(other)).toHaveCount(0);
    await expect(lockScreen(page), "l'autre onglet aussi").toHaveCount(0, { timeout: 10_000 });
    expect((await apiGet(page, "/products", { limit: 1 })).data.length).toBeGreaterThan(0);
    await other.close();
  });

  test("5 codes faux → déconnecté (`pinTooMany`)", async ({ page }) => {
    await signIn(page);
    await lockNow(page);
    for (let left = 4; left >= 1; left--) {
      expect((await typeCode(page, "111111", 400)).code).toBe("pinWrong");
      await expect(
        lockScreen(page).getByText(`Code incorrect : encore ${left} essai(s).`, { exact: true }),
      ).toBeVisible();
    }
    expect((await typeCode(page, "111111", 403)).code).toBe("pinTooMany");
    await expect(page, "reconnectez-vous avec le mot de passe").toHaveURL(/\/login/);
    await apiGet(page, "/auth/me", {}, 401); // this session is over
  });

  test("« Code oublié ? Se déconnecter » → la page de connexion", async ({ page }) => {
    await signIn(page);
    await lockNow(page);
    await lockScreen(page).getByRole("button", { name: "Code oublié ? Se déconnecter", exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("réinitialiser le code", () => {
  test.use({ storageState: LOGGED_OUT });

  test("le propriétaire (« Gérer mon équipe »), puis l'administrateur (fiche pharmacie) → le nouveau code déverrouille", async ({
    browser,
    page,
  }) => {
    const reset = async (owner: Page, path: string, pin: string) => {
      await owner
        .getByRole("row", { name: new RegExp(EMP.email) })
        .getByRole("button", { name: "Plus d'actions" })
        .click();
      await owner.getByRole("menu").getByRole("menuitem", { name: "Réinitialiser le code", exact: true }).click();
      const dialog = owner.getByRole("dialog");
      await expect(dialog.getByText(`Nouveau code de ${EMP.full_name}`, { exact: true })).toBeVisible();
      await dialog.getByLabel("Nouveau code").fill(pin);
      const sent = pageSend(owner, "POST", path);
      await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();
      expect(await sent).toEqual({ user_id: employeeId });
      await expect(dialog).toHaveCount(0);
      await expect(owner.getByText("Code réinitialisé").first()).toBeVisible();
    };

    await test.step("le propriétaire", async () => {
      const { page: owner, done } = await openAs(browser, "owner");
      try {
        await owner.goto("/owner/employees");
        await reset(owner, `/owner/employees/${employeeId}/reset-pin`, OWNER_PIN);
      } finally {
        await done();
      }
      await signIn(page);
      await lockNow(page);
      expect((await typeCode(page, PIN, 400)).code, "l'ancien code").toBe("pinWrong");
      expect((await typeCode(page, OWNER_PIN, 200)).lock?.locked).toBe(false);
      await expect(lockScreen(page)).toHaveCount(0);
    });

    await test.step("l'administrateur", async () => {
      const { page: admin, done } = await openAs(browser, "admin");
      try {
        await admin.goto(`/admin/pharmacies/${loadState().pharmacyId}`);
        await reset(admin, `/admin/users/${employeeId}/reset-pin`, ADMIN_PIN);
      } finally {
        await done();
      }
      await lockNow(page);
      expect((await typeCode(page, ADMIN_PIN, 200)).lock?.locked).toBe(false);
      await expect(lockScreen(page)).toHaveCount(0);
    });
  });

  test("désactivé → plus jamais verrouillé", async ({ page }) => {
    await signIn(page);
    await openLockTab(page);
    const lock = page.getByRole("switch", { name: "Verrouillage automatique", exact: true });
    const saved = pageSend(page, "PUT", "/auth/me/lock");
    await lock.click();
    expect((await saved).lock).toEqual({ enabled: false, seconds: 15, has_pin: true, locked: false });
    await expect(lock).toHaveAttribute("aria-checked", "false");
    await expect(page.locator("main").getByRole("button", { name: "15 s", exact: true }), "plus de délai").toHaveCount(
      0,
    );
    await apiPost(page, "/auth/lock", {}, {}, 204);
    expect((await apiGet(page, "/auth/me")).lock.locked, "rien ne se verrouille").toBe(false);
    expect((await apiGet(page, "/products", { limit: 1 })).data.length).toBeGreaterThan(0);
  });
});
