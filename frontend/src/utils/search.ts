/**
 * Tokenize a search query for AND matching (Google / GitHub-style).
 *
 * Splits on whitespace and `*` so users can write either:
 *   - `la roche posay`           → ["la", "roche", "posay"]
 *   - `*roche*posay`             → ["roche", "posay"]
 *   - `*anthe`                   → ["anthe"]
 *
 * All tokens must be present (AND) for a row to match.
 */
export function tokenizeSearch(query: string | null | undefined): string[] {
  if (!query) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of query.trim().split(/[\s*]+/)) {
    const tok = raw.trim().toLowerCase();
    if (tok && !seen.has(tok)) {
      seen.add(tok);
      out.push(tok);
    }
  }
  return out;
}

/**
 * Returns true if every token in *tokens* is contained in *haystack*
 * (case-insensitive). An empty token list matches everything.
 */
export function matchesAllTokens(haystack: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const lower = haystack.toLowerCase();
  return tokens.every((t) => lower.includes(t));
}
