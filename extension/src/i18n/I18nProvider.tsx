/** Same i18n as the app (frontend/src/i18n/I18nProvider.tsx): `t(key)`, French fallback, `{{var}}`.
 *  The language lives in chrome.storage (read with useQuery, changed with useMutation), shared with
 *  the Sobrus page card.
 *
 *  Usage:  const t = useT();  <span>{t("jobs.title")}</span> */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { API, refresh } from "@/api/api";

import { DEFAULT_LANG, readLang, writeLang, type Lang } from "./config";
import { translateIn, type TFn } from "./translate";

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => Promise<void>;
  t: TFn;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data: lang = DEFAULT_LANG } = useQuery({ queryKey: API.lang.current.key, queryFn: readLang });
  const { mutateAsync: setLang } = useMutation({
    mutationFn: writeLang,
    onSuccess: () => refresh(qc, API.lang.set),
  });

  const value = useMemo(() => ({ lang, setLang, t: translateIn(lang) }), [lang, setLang]);
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
