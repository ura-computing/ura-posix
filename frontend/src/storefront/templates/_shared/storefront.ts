/** Helpers every store model uses. A store is a showcase: no cart, no payment; « Commander » opens WhatsApp. */
import { formatMADStr } from "@/utils/format";

/** WhatsApp wants the international number: "06 12 34 56 78" → "212612345678", "+212 6…" → "2126…". */
export function whatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `212${digits.slice(1)}`;
  return digits;
}

/** « Commander » / « Nous écrire »: WhatsApp with a ready message. */
export function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/${whatsappNumber(phone)}?text=${encodeURIComponent(text)}`;
}

export const orderText = (productName: string) => `Bonjour, je suis intéressé(e) par : ${productName}`;
export const contactText = "Bonjour, j'ai une question.";

/** "189 MAD" style price, or "" when the pharmacy has none. */
export const price = (ppv: number | null): string => (ppv == null ? "" : formatMADStr(ppv));
