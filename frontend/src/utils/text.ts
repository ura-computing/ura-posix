/** Normalize a string for accent- AND case-insensitive search:
 *  lowercase + strip diacritics.  "MÉDICAMENT" → "medicament", "Diététique" → "dietetique".
 *  Use for every client-side search/filter so a query without accents still matches
 *  accented records (mirrors the backend's SQL `unaccent`). */
export function normalizeText(s: unknown): string {
  return String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Build a `(fullText, words) => boolean` predicate for one normalized token,
 *  honoring the `*` wildcard. Anchoring is PER WORD, not against the whole field:
 *  a multi-word value like "rinomicine st b10 sachets" matches `rinom*ne` because
 *  the WORD "rinomicine" starts with "rinom" and ends with "ne".
 *    "cin"    → substring anywhere in the field   (no anchor)
 *    "rino*"  → some word starts with "rino"       (/^rino/ per word)
 *    "*ne"    → some word ends with "ne"           (/ne$/ per word)
 *    "ri*il"  → some word starts "ri" ends "il"    (/^ri.*il$/ per word)
 *  A token with no `*` keeps the old whole-field substring behavior. */
function makeTokenTest(token: string): (fullText: string, words: string[]) => boolean {
  if (!token.includes("*")) {
    return (fullText) => fullText.includes(token);   // no wildcard → substring anywhere
  }
  const escape = (chunk: string) => chunk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = token.split("*").map(escape).join(".*");
  const start = token.startsWith("*") ? "" : "^";
  const end = token.endsWith("*") ? "" : "$";
  let re: RegExp;
  try {
    re = new RegExp(`${start}${body}${end}`);
  } catch {
    const literal = token.replace(/\*/g, "");
    return (fullText) => fullText.includes(literal);
  }
  return (_fullText, words) => words.some((w) => re.test(w));   // anchored per word
}

/** Split a query into normalized token predicates (whitespace = token separator;
 *  tokens are ANDed — every one must match). */
function compileQuery(query: string): Array<(fullText: string, words: string[]) => boolean> {
  return normalizeText(query).split(/\s+/).filter(Boolean).map(makeTokenTest);
}

function wordsOf(fullText: string): string[] {
  return fullText.split(/\s+/).filter(Boolean);
}

/** True when `query` (trimmed) matches `haystack` accent/case-insensitively.
 *  Multi-word queries AND their tokens; each token supports the `*` wildcard for
 *  prefix (`rino*`), suffix (`*enil`), and infix (`ri*il`) anchoring — anchored
 *  PER WORD of the haystack. Mirrors the backend `search.py` semantics. */
export function matchesText(haystack: unknown, query: string): boolean {
  const full = normalizeText(haystack);
  const words = wordsOf(full);
  return compileQuery(query).every((pred) => pred(full, words));
}

/** Multi-field variant: every token must match SOMEWHERE across `fields` (a token
 *  can match one field, the next token another). Wildcard anchoring is per word of
 *  each field. Use this for client-side row filters searching several columns. */
export function matchesFields(fields: unknown[], query: string): boolean {
  const fulls = fields.map(normalizeText);
  const wordLists = fulls.map(wordsOf);
  return compileQuery(query).every((pred) =>
    fulls.some((full, i) => pred(full, wordLists[i])),
  );
}
