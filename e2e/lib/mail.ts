/** Emails in E2E: the backend runs without SMTP and prints each magic link
 *  (`>>> [RESET] MAGIC LINK for <email>: <url>`, `>>> [SIGNUP_ACCEPTED] EMAIL for <email>: <url>`,
 *  see backend/app/core/email_service.py)
 *  to e2e/.logs/backend.log. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect } from "./fixtures";
import { E2E_DIR } from "./paths";

const LOG_FILE = resolve(E2E_DIR, ".logs/backend.log");

const escaped = (email: string) => email.replace(/[.+]/g, "\\$&");

/** Last link printed by `pattern` (polls up to 10 s — the log is flushed async). */
async function lastPrinted(pattern: RegExp, what: string): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      () => {
        const matches = [...readFileSync(LOG_FILE, "utf-8").matchAll(pattern)];
        link = matches.at(-1)?.[1];
        return link;
      },
      { timeout: 10_000, message: `${what} in ${LOG_FILE}` },
    )
    .toBeTruthy();
  return link!;
}

/** Last magic link printed for `email`. */
export async function lastMagicLink(email: string, flow: "RESET" | "WELCOME" = "RESET"): Promise<string> {
  return lastPrinted(
    new RegExp(`>>> \\[${flow}\\] MAGIC LINK for ${escaped(email)}: (\\S+)`, "g"),
    `magic link for ${email}`,
  );
}

/** Last « Créer un compte » answer emailed to `email` (`>>> [SIGNUP_ACCEPTED] EMAIL for …: <login url>`). */
export async function lastSignupEmail(email: string, decision: "ACCEPTED" | "REFUSED"): Promise<string> {
  return lastPrinted(
    new RegExp(`>>> \\[SIGNUP_${decision}\\] EMAIL for ${escaped(email)}: (\\S+)`, "g"),
    `sign-up ${decision} email for ${email}`,
  );
}
