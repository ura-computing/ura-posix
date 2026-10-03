/** Helpers shared across /store-website tabs. The MAD/relative-date
 *  helpers are intentionally local to the boutique feature so we don't
 *  retroactively reshape the global `utils/format` API. */

/** MAD with French formatting: 1 234,56 MAD. */
export function formatMAD(n: number): string {
  return (
    n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ | /g, " ") + " MAD"
  );
}

/** Discount percentage badge value, e.g. -25 %. Empty when invalid. */
export function discountPct(ppv: number, solde: number): string {
  if (!ppv || solde >= ppv) return "";
  return `-${Math.round((1 - solde / ppv) * 100)} %`;
}

/** Relative French date, e.g. "il y a 3 j". */
export function formatRelative(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} j`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem`;
  return `il y a ${Math.floor(days / 30)} mois`;
}

/** wa.me deep link used by every "Commander" CTA in the public templates. */
export function whatsappOrderLink(pharmacyPhone: string, productName: string): string {
  const digits = pharmacyPhone.replace(/[^\d]/g, "");
  const text = `Bonjour, je suis intéressé par ${productName}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
