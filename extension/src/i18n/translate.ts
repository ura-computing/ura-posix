/** `t()` without React (the Sobrus page card) and the error text — used by `I18nProvider` too.
 *  A dot-path in the language's dictionary, else French, else the key; `{{var}}` filled in. */
import type { JobError } from "@/types";

import type { Lang } from "./config";
import { es } from "./locales/es";
import { fr } from "./locales/fr";

const DICTS: Record<Lang, unknown> = { fr, es };

function lookup(dict: unknown, path: string): string | undefined {
  const val = path
    .split(".")
    .reduce<unknown>(
      (acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined),
      dict,
    );
  return typeof val === "string" ? val : undefined;
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : `{{${k}}}`));
}

export type TFn = (key: string, vars?: Record<string, string | number>) => string;

export const translateIn =
  (lang: Lang): TFn =>
  (key, vars) =>
    interpolate(lookup(DICTS[lang], key) ?? lookup(fr, key) ?? key, vars);

/** An import / account error in the user's language: `errors.<code>`, else the backend's French detail. */
export function errorText(t: TFn, error: JobError): string {
  const key = `errors.${error.code}`;
  const text = t(key, error.params);
  return text !== key ? text : error.detail || t("errors.unknown");
}
