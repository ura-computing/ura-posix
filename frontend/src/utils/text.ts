/** Normalize a string for accent- AND case-insensitive search:
 *  lowercase + strip diacritics.  "MÉDICAMENT" → "medicament", "Diététique" → "dietetique".
 *  Use for every client-side search/filter so a query without accents still matches
 *  accented records (mirrors the backend's SQL `unaccent`). */
export function normalizeText(s: unknown): string {
  return String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** True when `query` (already trimmed) matches `haystack` accent/case-insensitively. */
export function matchesText(haystack: unknown, query: string): boolean {
  return normalizeText(haystack).includes(normalizeText(query));
}
