/** Normalize a string for accent- AND case-insensitive search:
 *  lowercase + strip diacritics.  "MÉDICAMENT" → "medicament", "Diététique" → "dietetique".
 *  Use for every client-side search/filter so a query without accents still matches
 *  accented records (mirrors the backend's SQL `unaccent`). */
export function normalizeText(s: unknown): string {
  return String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Build a `(fullText) => boolean` predicate for one normalized token, honoring the
 *  `*` grammar (mirrors backend `search.py`):
 *    "med"     → contains "med"          (full.includes)
 *    "*med"    → contains "med"          (full.includes)
 *    "med*"    → starts with "med"       (full.startsWith)
 *    "a*b"     → infix WITHIN one word   (per-word regex, mirrors backend _token_to_regex_sql)
 *    "*a*b*c"  → contains a OR b OR c    (OR of contains — no word boundary)
 */
function makeTokenTest(token: string): (full: string) => boolean {
  const parts = token.split("*").filter(Boolean);
  if (parts.length === 0) return () => true;                       // lone "*"
  if (parts.length === 1) {
    const seg = parts[0];
    if (token.endsWith("*") && !token.startsWith("*")) {
      return (full) => full.startsWith(seg);                       // starts with
    }
    return (full) => full.includes(seg);                           // contains
  }
  // 2+ parts: infix a*b*c → must match WITHIN ONE WORD
  // (mirrors backend _token_to_regex_sql: \ma[^[:space:]]*b\M)
  const inner = parts.map(escapeRegex).join("[^\\s]*");
  const pattern = new RegExp(inner);
  const words = (full: string) => full.split(/\s+/);
  return (full) => words(full).some((w) => pattern.test(w));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Split a query into normalized token predicates (whitespace = token separator;
 *  tokens are ANDed — every one must match). */
function compileQuery(query: string): Array<(full: string) => boolean> {
  return normalizeText(query).split(/\s+/).filter(Boolean).map(makeTokenTest);
}

/** True when `query` (trimmed) matches `haystack` accent/case-insensitively.
 *  Multi-word queries AND their tokens; each token supports the `*` grammar
 *  (contains / starts-with / OR). Mirrors backend `search.py`. */
export function matchesText(haystack: unknown, query: string): boolean {
  const full = normalizeText(haystack);
  return compileQuery(query).every((pred) => pred(full));
}

/** Multi-field variant: every token must match SOMEWHERE across `fields` (a token
 *  can match one field, the next token another). Use for client-side row filters
 *  searching several columns. */
export function matchesFields(fields: unknown[], query: string): boolean {
  const fulls = fields.map(normalizeText);
  return compileQuery(query).every((pred) => fulls.some((full) => pred(full)));
}
