/** Minimal, dependency-free i18n. A Context holds the current language; `t(key)`
 *  resolves a dot-path against the active dictionary, falling back to French then
 *  to the key itself. `{{var}}` placeholders are interpolated.
 *
 *  Usage:  const t = useT();  <span>{t("nav.achats")}</span>
 *          t("liste.count", { n: 23 })   // "23 produits"
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { DEFAULT_LANG, LANG_STORAGE_KEY, type Lang } from "./config";
import { fr } from "./locales/fr";
import { es } from "./locales/es";


const DICTS: Record<Lang, unknown> = { fr, es };

function lookup(dict: unknown, path: string): string | undefined {
  const val = path.split(".").reduce<unknown>(
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

interface I18nContextValue {
  lang:    Lang;
  setLang: (l: Lang) => void;
  t:       TFn;
}

const I18nContext = createContext<I18nContextValue | null>(null);


function readInitialLang(): Lang {
  const stored = localStorage.getItem(LANG_STORAGE_KEY);
  return stored === "fr" || stored === "es" ? stored : DEFAULT_LANG;
}


export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang);

  const setLang = useCallback((next: Lang) => {
    localStorage.setItem(LANG_STORAGE_KEY, next);
    document.documentElement.lang = next;
    setLangState(next);
  }, []);

  const t = useCallback<TFn>((key, vars) => {
    const raw = lookup(DICTS[lang], key) ?? lookup(fr, key) ?? key;
    return interpolate(raw, vars);
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}


export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}

export function useT(): TFn {
  return useI18n().t;
}

/** `t()` for code outside React (API client, query-cache toasts): uses the
 *  language the user picked (stored), French fallback. */
export const translate: TFn = (key, vars) =>
  interpolate(lookup(DICTS[readInitialLang()], key) ?? lookup(fr, key) ?? key, vars);

/** French whatever the UI language: Excel headers are always French (client rule). */
export const translateFr: TFn = (key, vars) => interpolate(lookup(fr, key) ?? key, vars);
