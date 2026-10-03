/** Emails in E2E: the backend runs without SMTP and prints each magic link
 *  (`>>> [RESET] MAGIC LINK for <email>: <url>`, see backend/app/core/email_service.py)
 *  to e2e/.logs/backend.log. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect } from "./fixtures";
import { E2E_DIR } from "./paths";

const LOG_FILE = resolve(E2E_DIR, ".logs/backend.log");

/** Last magic link printed for `email` (polls up to 10 s — the log is flushed async). */
export async function lastMagicLink(email: string, flow: "RESET" | "WELCOME" = "RESET"): Promise<string> {
  const pattern = new RegExp(`>>> \\[${flow}\\] MAGIC LINK for ${email.replace(/[.+]/g, "\\$&")}: (\\S+)`, "g");
  let link: string | undefined;
  await expect
    .poll(
      () => {
        const matches = [...readFileSync(LOG_FILE, "utf-8").matchAll(pattern)];
        link = matches.at(-1)?.[1];
        return link;
      },
      { timeout: 10_000, message: `magic link for ${email} in ${LOG_FILE}` },
    )
    .toBeTruthy();
  return link!;
}
