/** `test` with an automatic API recorder: every /v1 call the page makes is
 *  appended to .results/calls.jsonl with its status + duration. The coverage
 *  and speed gates read that file. Import `test` / `expect` from here, never
 *  from @playwright/test directly. */
import { test as base, expect, type Page, type Request } from "@playwright/test";
import { appendFileSync, mkdirSync } from "node:fs";

import { API, CALLS_FILE, RESULTS_DIR } from "./paths";

export interface CallRecord {
  method: string; // GET / POST / … or FLOW for a measured user flow
  path: string; // /v1/stats  ·  flow: import/ventes
  status: number;
  ms: number;
  source: "ui" | "api" | "flow";
  test: string;
}

export function recordCall(rec: CallRecord): void {
  mkdirSync(RESULTS_DIR, { recursive: true });
  appendFileSync(CALLS_FILE, JSON.stringify(rec) + "\n");
}

/** Records every /v1 call `page` makes (`title()` = the test it belongs to). The fixture page is
 *  recorded by itself; a page a spec opens in its own context (another user) calls this once.
 *  Resolves the returned function once every call seen so far is written. */
export function recordPage(page: Page, title: () => string): () => Promise<void> {
  const pending: Promise<void>[] = [];
  const onRequest = (req: Request) => {
    if (!req.url().startsWith(`${API}/v1/`)) return;
    pending.push(
      (async () => {
        // Also on "requestfailed": Chromium reports a 204 No Content fetch as
        // failed, yet its response (with the 204) is there.
        const res = await req.response().catch(() => null);
        recordCall({
          method: req.method(),
          path: new URL(req.url()).pathname,
          status: res?.status() ?? 0,
          ms: Math.round(req.timing().responseEnd),
          source: "ui",
          test: title(),
        });
      })(),
    );
  };
  page.on("requestfinished", onRequest);
  page.on("requestfailed", onRequest);
  return () => Promise.all(pending).then(() => undefined);
}

export const test = base.extend<{ recorder: void }>({
  recorder: [
    async ({ page }, use, testInfo) => {
      const flush = recordPage(page, () => testInfo.title);
      await use();
      await flush();
    },
    { auto: true },
  ],
});

export { expect };
