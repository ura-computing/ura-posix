/** Short labels of the product sheet (header, « Mouvements »). */
import { formatPctStr } from "@/utils/format";

/** « Médicament (33.930%) » → « Médicament ». */
export const withoutRate = (label: string) => label.replace(/\s*\([^()]*\)\s*$/, "") || label;

/** « Exonéré (0.00%) » → « Exonéré »; « TVA (20.00%) » → « 20,00 % ». */
export function tvaShort(tva: string): string {
  const m = /^(.*?)\s*\((\d+(?:[.,]\d+)?)\s*%\)\s*$/.exec(tva);
  if (!m) return tva;
  return m[1].toLowerCase() === "tva" || !m[1] ? formatPctStr(Number(m[2].replace(",", "."))) : m[1];
}
