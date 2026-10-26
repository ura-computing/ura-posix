/** Numbers and dates on screen, French style in both languages (like the app's utils/format.tsx). */
const NUM = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** 3 565 000 bytes → « 3,4 Mo »; under 1 Mo → « 820 Ko ». */
export function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${NUM.format(bytes / 1024 / 1024)} Mo` : `${NUM.format(Math.round(bytes / 1024))} Ko`;
}

/** « 2025-01-31 » → « 31/01/2025 ». */
export const formatDate = (iso: string) => iso.split("-").reverse().join("/");

export const formatQty = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
