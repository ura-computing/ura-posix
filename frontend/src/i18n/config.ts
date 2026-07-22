/** i18n core config — the platform is translatable FR ↔ ES (client request).
 *  French is the default (existing users). Numbers/currency/dates keep their
 *  French-style formatting in both languages (see utils/format) — only words
 *  translate. */
export const LANGS = ["fr", "es"] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "fr";
export const LANG_STORAGE_KEY = "pg-lang";

export const LANG_LABELS: Record<Lang, string> = { fr: "FR", es: "ES" };
