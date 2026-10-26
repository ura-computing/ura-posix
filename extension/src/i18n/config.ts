export type Lang = "fr" | "es";

export const DEFAULT_LANG: Lang = "fr";
/** chrome.storage.local (shared by the popup and the Sobrus page card; not the page's localStorage). */
export const LANG_STORAGE_KEY = "pharmagest_lang";

export async function readLang(): Promise<Lang> {
  const res = await chrome.storage.local.get(LANG_STORAGE_KEY);
  return res[LANG_STORAGE_KEY] === "es" ? "es" : DEFAULT_LANG;
}

export const writeLang = (lang: Lang) => chrome.storage.local.set({ [LANG_STORAGE_KEY]: lang });
