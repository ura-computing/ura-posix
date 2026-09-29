/** `test` with an automatic API recorder: every /v1 call the page makes is
 *  appended to .results/calls.jsonl with its status + duration. The coverage
 *  and speed gates read that file. Import `test` / `expect` from here, never
 *  from @playwright/test directly. */
import { test as base, expect, type Request } from "@playwright/test";
import { appendFileSync, mkdirSync } from "node:fs";

import { API, CALLS_FILE, RESULTS_DIR } from "./paths";


export interface CallRecord {
  method: string;           // GET / POST / … or FLOW for a measured user flow
  path:   string;           // /v1/stats  ·  flow: import/ventes
  status: number;
  ms:     number;
  source: "ui" | "api" | "flow";
  test:   string;
}


export function recordCall(rec: CallRecord): void {
  mkdirSync(RESULTS_DIR, { recursive: true });
  appendFileSync(CALLS_FILE, JSON.stringify(rec) + "\n");
}


export const test = base.extend<{ recorder: void }>({
  recorder: [async ({ page }, use, testInfo) => {
    const pending: Promise<void>[] = [];
    const onRequest = (req: Request, failed: boolean) => {
      if (!req.url().startsWith(`${API}/v1/`)) return;
      pending.push((async () => {
        const res = failed ? null : await req.response();
        recordCall({
          method: req.method(),
          path:   new URL(req.url()).pathname,
          status: res?.status() ?? 0,
          ms:     Math.round(req.timing().responseEnd),
          source: "ui",
          test:   testInfo.title,
        });
      })());
    };
    page.on("requestfinished", (req) => onRequest(req, false));
    page.on("requestfailed",   (req) => onRequest(req, true));
    await use();
    await Promise.all(pending);
  }, { auto: true }],
});

export { expect };
