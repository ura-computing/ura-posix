/** Barcodes drawn from their number (product sheet): 13 digits = EAN-13, 12 = UPC-A (an EAN-13
 *  starting with 0), 8 = EAN-8; any other code = Code 128 (set B).
 *  `barcodeBars("3400930003917")` → { width: 95, bars: [{ x: 0, w: 1 }, { x: 2, w: 1 }, …] }. */

// EAN digit patterns, 7 modules each (1 = black). R = L inverted, G = R reversed.
const L = [
  "0001101",
  "0011001",
  "0010011",
  "0111101",
  "0100011",
  "0110001",
  "0101111",
  "0111011",
  "0110111",
  "0001011",
];
const R = L.map((p) => [...p].map((b) => (b === "0" ? "1" : "0")).join(""));
const G = R.map((p) => [...p].reverse().join(""));
// EAN-13: the first digit is not drawn, it picks L or G for each of the next 6.
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

// Code 128 symbols 0–105: bar / space widths (bar first, 11 modules each). 104 = start B.
const CODE128 = (
  "212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 " +
  "122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 " +
  "322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 " +
  "112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 " +
  "331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 " +
  "112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 " +
  "124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 " +
  "411311 113141 114131 311141 411131 211412 211214 211232"
).split(" ");
const CODE128_STOP = "2331112";

function ean(digits: string): string {
  const codes = (part: string, table: (i: number) => string[]) => [...part].map((d, i) => table(i)[Number(d)]).join("");
  if (digits.length === 8) return `101${codes(digits.slice(0, 4), () => L)}01010${codes(digits.slice(4), () => R)}101`;
  const parity = PARITY[Number(digits[0])];
  const left = codes(digits.slice(1, 7), (i) => (parity[i] === "L" ? L : G));
  return `101${left}01010${codes(digits.slice(7), () => R)}101`;
}

/** null when a character is outside Code 128 set B (accents…). */
function code128(text: string): string | null {
  const values = [...text].map((c) => c.charCodeAt(0) - 32);
  if (values.some((v) => v < 0 || v > 94)) return null;
  const check = values.reduce((sum, v, i) => sum + v * (i + 1), 104) % 103;
  const widths = [104, ...values, check].map((v) => CODE128[v]).join("") + CODE128_STOP;
  return [...widths].map((w, i) => (i % 2 === 0 ? "1" : "0").repeat(Number(w))).join("");
}

/** The black bars of a code, in modules (1 module = the thinnest bar); null = nothing to draw. */
export function barcodeBars(code: string): { width: number; bars: { x: number; w: number }[] } | null {
  const text = code.trim();
  if (!text) return null;
  const modules = /^\d{13}$/.test(text)
    ? ean(text)
    : /^\d{12}$/.test(text)
      ? ean(`0${text}`)
      : /^\d{8}$/.test(text)
        ? ean(text)
        : code128(text);
  if (!modules) return null;
  const bars = [...modules.matchAll(/1+/g)].map((m) => ({ x: m.index, w: m[0].length }));
  return { width: modules.length, bars };
}

/** « EAN-13 » / « UPC-A » / « EAN-8 » when the length and the check digit (last digit) fit;
 *  null = another kind of code (« Autre »). `barcodeFormat("3400930003917")` → "EAN-13". */
export function barcodeFormat(code: string): "EAN-13" | "UPC-A" | "EAN-8" | null {
  const text = code.trim();
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(text)) return null;
  const digits = [...text].map(Number);
  // From the right, before the check digit: × 3, × 1, × 3…
  const sum = digits
    .slice(0, -1)
    .reverse()
    .reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  if ((10 - (sum % 10)) % 10 !== digits[digits.length - 1]) return null;
  return text.length === 13 ? "EAN-13" : text.length === 12 ? "UPC-A" : "EAN-8";
}
