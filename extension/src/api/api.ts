/** Every call of the extension, one entry per action — same shape as the app (frontend/src/api/api.ts):
 *
 *  - Read:   `{ url, key }` — `key` = its TanStack Query cache slot.
 *  - Write:  `{ url, refreshes }` — the reads it changes; after success `refresh(qc, API.x.write)`.
 *
 *  `jobs` and `lang` are reads of chrome.storage.local, not of the backend (no `url`): the service
 *  worker writes the jobs, the popup and the Sobrus page card read them. */
import type { QueryClient } from "@tanstack/query-core";

type Key = readonly unknown[];

/** A read as `refreshes` lists it. */
interface Read {
  key: Key;
}

export const API = {
  auth: {
    me: { url: "/auth/me", key: ["auth", "me"] },
  },
  uploads: {
    achat: { url: "/uploads/achat-json", refreshes: (): Read[] => [API.jobs.list, API.imports.list] },
    vente: { url: "/uploads/vente-json", refreshes: (): Read[] => [API.jobs.list, API.imports.list] },
    stock: { url: "/uploads/stock-json", refreshes: (): Read[] => [API.jobs.list, API.imports.list] },
    setBatchStatus: { url: (id: number) => `/uploads/batches/${id}` },
  },
  /** The pharmacy's imports on PharmaGest (the app's « Gestion des imports »): the popup's list. */
  imports: {
    list: { url: "/data/imports", key: ["imports", "list"] },
  },
  jobs: {
    list: { key: ["jobs", "list"] },
    cancel: { refreshes: (): Read[] => [API.jobs.list, API.imports.list] },
  },
  lang: {
    current: { key: ["lang"] },
    set: { refreshes: (): Read[] => [API.lang.current] },
  },
} as const;

/** After a write: refresh every read it lists (prefix match on the query keys). */
export function refresh(qc: QueryClient, write: { refreshes: () => readonly Read[] }): Promise<void> {
  const prefixes = write.refreshes().map((r) => r.key);
  return qc.invalidateQueries({
    predicate: (q) => prefixes.some((prefix) => prefix.every((part, i) => q.queryKey[i] === part)),
  });
}
