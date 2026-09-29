/** Test accounts + login through the real login page. A logged-in session is
 *  saved per role (.state/<role>.json) and reused via `test.use({ storageState })`
 *  — /auth/login is rate-limited to 5/min, so never log in per test. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";

import { expect } from "./fixtures";
import { STATE_DIR } from "./paths";


export interface Account { email: string; password: string; name: string }

export const ADMIN: Account = { email: "admin@gmail.com", password: "admin@123", name: "Administrateur" };   // backend/seed.json
export const OWNER: Account = { email: "owner.e2e@pharmagest.ma", password: "OwnerE2e#2026", name: "Owner E2E" };
export const PHARMACY = { name: "Pharmacie E2E", city: "Bouskoura" };

export const ALL_FEATURES = [
  "rapports", "import", "achats", "ventes", "stock", "analyse", "accounting", "alertes", "special_products",
];

export type Role = "admin" | "owner";

export const sessionFile = (role: Role): string => resolve(STATE_DIR, `${role}.json`);


export async function login(page: Page, account: Account, role: Role): Promise<void> {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[autocomplete="current-password"]').fill(account.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.context().storageState({ path: sessionFile(role) });
}


/** Small key/value store shared between spec files (e.g. the E2E pharmacy id). */
const STATE_FILE = () => resolve(STATE_DIR, "state.json");

export function saveState(patch: Record<string, unknown>): void {
  writeFileSync(STATE_FILE(), JSON.stringify({ ...loadState(), ...patch }, null, 2));
}

export function loadState(): Record<string, any> {   // eslint-disable-line @typescript-eslint/no-explicit-any
  try { return JSON.parse(readFileSync(STATE_FILE(), "utf-8")); } catch { return {}; }
}
