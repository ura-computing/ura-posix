/**
 * Reverse double-encoded mojibake (UTF-8 → MacRoman/cp1252 → UTF-8).
 *
 * Sobrus exports sometimes arrive with this corruption pattern:
 *   "Cat√©gorie" instead of "Catégorie"
 *   "HELIOCARE 360¬∞" instead of "HELIOCARE 360°"
 *
 * Browsers don't have a built-in MacRoman codec, so we use a substitution table.
 */

const FIXES: Record<string, string> = {
  "√©": "é",
  "√®": "è",
  "√à": "è",
  "√™": "ê",
  "√Æ": "î",
  "√è": "ï",
  "√Ø": "ï",
  "√†": "à",
  "√§": "ä",
  "√≥": "ó",
  "√µ": "õ",
  "√º": "ü",
  "√â": "É",
  "√ä": "Ë",
  "√Ä": "À",
  "√î": "Ô",
  "√ô": "Ù",
  "√ª": "û",
  "√Ç": "Â",
  "√ß": "ç",
  "√Ñ": "Ä",
  "√û": "Þ",
  "¬∞": "°",
  "¬µ": "µ",
  "¬¥": "´",
  "¬Æ": "®",
  "¬©": "©",
  "¬†": " ",   // NBSP → regular space
};

const TELLTALE = /[√¬]/;

export function fixMojibake(s: string | null | undefined): string {
  if (!s) return s ?? "";
  if (!TELLTALE.test(s)) return s;
  let out = s;
  for (const [bad, good] of Object.entries(FIXES)) {
    if (out.includes(bad)) {
      out = out.split(bad).join(good);
    }
  }
  return out;
}

const HEADER_ALIASES: Record<string, string> = {
  "caégorie": "Catégorie",  // missing 't' typo seen in some Sobrus exports
};

/** Apply mojibake fix + known header aliases to a CSV header cell. */
export function cleanHeader(h: string): string {
  const fixed = fixMojibake(h.trim().replace(/^"|"$/g, ""));
  const lower = fixed.toLowerCase();
  return HEADER_ALIASES[lower] ?? fixed;
}
