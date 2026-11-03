/** `test` with automatic recorders, read by the gates (99-gates):
 *  - API: every /v1 call the page makes → .results/calls.jsonl (status, duration, query + body KEYS, error code)
 *  - UI: every interactive element the page shows and every one used (clicked, typed, changed) → .results/ui.jsonl
 *  Import `test` / `expect` from here, never from @playwright/test directly. */
import { test as base, expect, type BrowserContext, type Page, type Request } from "@playwright/test";
import { appendFileSync, mkdirSync } from "node:fs";

import { API, CALLS_FILE, RESULTS_DIR, UI_FILE } from "./paths";

export interface CallRecord {
  method: string; // GET / POST / … or FLOW for a measured user flow
  path: string; // /v1/stats  ·  flow: import/ventes
  status: number;
  ms: number;
  source: "ui" | "api" | "flow";
  test: string;
  query?: string[]; // query param names sent (never values)
  body?: string[]; // JSON / form field names sent (never values)
  code?: string; // ApiError `code` of a 4xx / 5xx answer
  codes?: string[]; // error codes inside a 2xx answer (see answerCodes)
}

/** Answers that carry error codes while being 2xx: the Sobrus robot's runs / connection, the catalogue import's
 *  rows refused (`errors[].code`). */
export const CODES_IN_ANSWER = ["/v1/sobrus/", "/v1/uploads/catalog"];

/** `error_code` / `last_error_code` / `code` values anywhere in a JSON answer. */
export function answerCodes(json: unknown, out: Set<string> = new Set()): string[] {
  if (Array.isArray(json)) json.forEach((x) => answerCodes(x, out));
  else if (json && typeof json === "object") {
    for (const [k, v] of Object.entries(json)) {
      if (["error_code", "last_error_code", "code"].includes(k) && typeof v === "string") out.add(v);
      else if (v && typeof v === "object") answerCodes(v, out);
    }
  }
  return [...out];
}

export function recordCall(rec: CallRecord): void {
  mkdirSync(RESULTS_DIR, { recursive: true });
  appendFileSync(CALLS_FILE, JSON.stringify(rec) + "\n");
}

/** Field names of a request body: JSON keys, or the names of a multipart / urlencoded form. */
export function bodyKeys(raw: string | null, json: unknown): string[] | undefined {
  if (json && typeof json === "object" && !Array.isArray(json)) return Object.keys(json);
  if (!raw) return undefined;
  const multipart = [...raw.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
  if (multipart.length) return [...new Set(multipart)];
  if (/^[\w.%-]+=/.test(raw)) return [...new URLSearchParams(raw).keys()];
  return undefined;
}

/** Records every /v1 call `page` makes (`title()` = the test it belongs to), and its UI (seen / used
 *  elements). The fixture page is recorded by itself; a page a spec opens in its own context (another
 *  user) calls this once, before its first page load. Resolves the returned function once every call seen
 *  so far is written. */
export function recordPage(page: Page, title: () => string): () => Promise<void> {
  const pending: Promise<void>[] = [];
  const onRequest = (req: Request) => {
    if (!req.url().startsWith(`${API}/v1/`)) return;
    pending.push(
      (async () => {
        // Also on "requestfailed": Chromium reports a 204 No Content fetch as
        // failed, yet its response (with the 204) is there.
        const res = await req.response().catch(() => null);
        const status = res?.status() ?? 0;
        let json: unknown = null;
        try {
          json = req.postDataJSON();
        } catch {}
        const path = new URL(req.url()).pathname;
        const withCodes = CODES_IN_ANSWER.some((p) => path.startsWith(p));
        const answer = status >= 400 || withCodes ? await res?.json().catch(() => null) : null;
        const code = status >= 400 ? (answer as { code?: string } | null)?.code : undefined;
        const codes = status < 300 && answer ? answerCodes(answer) : undefined;
        recordCall({
          method: req.method(),
          path,
          status,
          ms: Math.round(req.timing().responseEnd),
          source: "ui",
          test: title(),
          query: [...new URL(req.url()).searchParams.keys()],
          // latin1: a multipart upload (a file) is not valid UTF-8, its field names are.
          body: bodyKeys(req.postDataBuffer()?.toString("latin1") ?? null, json),
          code,
          codes,
        });
      })(),
    );
  };
  page.on("requestfinished", onRequest);
  page.on("requestfailed", onRequest);
  void recordUi(page.context(), title);
  return () => Promise.all(pending).then(() => undefined);
}

// ── UI: every interactive element seen / used ───────────────────────────────

export interface UiRecord {
  kind: "seen" | "used";
  key: string; // route | role | name  (see UI_SCRIPT)
  test: string;
}

/** Runs in every page. An element's key: the route (ids → :id) + its role + its name (aria-label, label, first line of
 *  its text; numbers and counts dropped: « Catégorie (2) » → « Catégorie »; an icon-only button → its icon).
 *  A select's trigger keeps its label only (« Fournisseur: Société X » → « Fournisseur »).
 *  Shared, not per page: the sidebar, top bar and corner cards (`layout`). Data-driven elements share one key: inside a table row →
 *  its column; inside a `[data-list]` (search suggestions, multi-select options, corner cards…) → that list; calendar
 *  days → their role; links → their target route. Only enabled, visible elements; French only (the app's `pg-lang`:
 *  the Spanish test checks texts). Not counted as « to use »: the option already on (aria-pressed / aria-selected:
 *  « Français » in French), a link to the page itself. « seen » goes by batches, « used » at once (not lost on a
 *  reload). */
const UI_SCRIPT = () => {
  const w = window as unknown as {
    __e2eUiOn?: boolean;
    __e2eUi?: (records: { kind: string; key: string }[]) => Promise<void>;
  };
  if (w.__e2eUiOn) return;
  w.__e2eUiOn = true;
  const SELECTOR = [
    "button",
    "a[href]",
    "[role=tab]",
    "[role=menuitem]",
    "[role=option]",
    "[role=checkbox]",
    "[role=switch]",
    "[role=radio]",
    "input:not([type=hidden])",
    "select",
    "textarea",
  ].join(",");
  const ID = /\/\d+(?=\/|$)/g;
  const route = () => location.pathname.replace(ID, "/:id") || "/";
  const clean = (s: string | null | undefined) =>
    (s ?? "")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)[0]
      ?.split(":")[0]
      .replace(/\d+([.,]\d+)?/g, " ")
      .replace(/[()%:·]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60) ?? "";
  const name = (el: Element): string => {
    const h = el as HTMLInputElement;
    const label =
      el.getAttribute("aria-label") ||
      (el.getAttribute("aria-labelledby") &&
        el
          .getAttribute("aria-labelledby")!
          .split(" ")
          .map((id) => document.getElementById(id)?.textContent)
          .join(" ")) ||
      (h.labels && h.labels[0]?.textContent) ||
      (h.placeholder ?? "") ||
      (el as HTMLElement).innerText ||
      el.getAttribute("title") ||
      "";
    const text = clean(label);
    if (text) return text;
    const icon = [...(el.querySelector("svg")?.classList ?? [])].find((c) => c.startsWith("lucide-") && c !== "lucide");
    return icon ? `icon:${icon.slice(7)}` : "(no name)";
  };
  const role = (el: Element): string => {
    const r = el.getAttribute("role");
    if (r) return r;
    if (el.tagName === "A") return "link";
    if (el.tagName === "INPUT") {
      // One text field whatever its type (a password shown by the eye becomes `text`).
      const type = (el as HTMLInputElement).type || "text";
      return ["text", "email", "password", "search", "tel", "url", "number"].includes(type) ? "field" : `input:${type}`;
    }
    return el.tagName.toLowerCase();
  };
  const key = (el: Element): string => {
    const r = role(el);
    const shared = el.closest("aside") || el.closest("[aria-live]") || (el.closest("header") && !el.closest("main"));
    const at = shared ? "layout" : route();
    const list = el.closest("[data-list]") as HTMLElement | null;
    if (list) return `${at}|list:${list.dataset.list}|${r}`;
    if (el.closest("[role=grid], .rdp, .rdp-root")) return `${at}|calendar|${r}`;
    if (r === "option") return `${at}|option`;
    const cell = el.closest("tbody td") as HTMLTableCellElement | null;
    if (cell) return `${at}|table-col-${cell.cellIndex}|${r}`;
    if (r === "link") {
      const u = new URL((el as HTMLAnchorElement).href, location.href);
      return u.origin === location.origin ? `${at}|link|${u.pathname.replace(ID, "/:id")}` : `${at}|link-out|${u.host}`;
    }
    return `${at}|${r}|${name(el)}`;
  };
  const usable = (el: Element) => {
    const h = el as HTMLButtonElement;
    if (h.disabled || el.getAttribute("aria-disabled") === "true") return false;
    if (el.getAttribute("aria-pressed") === "true" || el.getAttribute("aria-selected") === "true") return false;
    if (el.tagName === "A") {
      const u = new URL((el as HTMLAnchorElement).href, location.href);
      if (u.origin === location.origin && u.pathname === location.pathname) return false;
    }
    const b = el.getBoundingClientRect();
    return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== "hidden";
  };
  const french = () => {
    try {
      return (localStorage.getItem("pg-lang") || "fr").startsWith("fr");
    } catch {
      return true;
    }
  };
  const seen = new Set<string>();
  const queue: { kind: string; key: string }[] = [];
  const scan = () => {
    if (!french()) return;
    for (const el of document.querySelectorAll(SELECTOR)) {
      if (!usable(el)) continue;
      const k = key(el);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push({ kind: "seen", key: k });
      }
    }
  };
  const used = (e: Event) => {
    const el = (e.target as Element | null)?.closest?.(SELECTOR);
    if (!el || !french()) return;
    const rec = { kind: "used", key: key(el) };
    if (w.__e2eUi) void w.__e2eUi([rec]);
    else queue.push(rec);
  };
  for (const type of ["click", "input", "change"]) document.addEventListener(type, used, true);
  let timer: number | undefined;
  const later = () => {
    clearTimeout(timer);
    timer = window.setTimeout(scan, 200);
  };
  const start = () => {
    scan();
    new MutationObserver(later).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled", "aria-disabled", "class", "style", "hidden"],
    });
  };
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
  window.setInterval(() => {
    if (queue.length && w.__e2eUi) void w.__e2eUi(queue.splice(0));
  }, 300);
  window.addEventListener("pagehide", () => {
    if (queue.length && w.__e2eUi) void w.__e2eUi(queue.splice(0));
  });
};

const uiContexts = new WeakMap<BrowserContext, Promise<void>>();

/** The UI recorder of one browser context (set up once; every caller waits for the same setup). */
function recordUi(context: BrowserContext, title: () => string): Promise<void> {
  let ready: Promise<void> | undefined = uiContexts.get(context);
  if (ready === undefined) {
    mkdirSync(RESULTS_DIR, { recursive: true });
    ready = context
      .exposeBinding("__e2eUi", (_source, records: { kind: UiRecord["kind"]; key: string }[]) => {
        const test = title();
        appendFileSync(UI_FILE, records.map((r) => JSON.stringify({ ...r, test })).join("\n") + "\n");
      })
      .then(() => context.addInitScript(UI_SCRIPT))
      .then(() => undefined);
    uiContexts.set(context, ready);
  }
  return ready;
}

export const test = base.extend<{ recorder: void }>({
  recorder: [
    async ({ page }, use, testInfo) => {
      const flush = recordPage(page, () => testInfo.title);
      await recordUi(page.context(), () => testInfo.title);
      await use();
      // The last events of the page (the queue is sent every 300 ms).
      await page.waitForTimeout(400).catch(() => {});
      await flush();
    },
    { auto: true },
  ],
});

export { expect };
