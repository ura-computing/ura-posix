/** Month name arrays per language for the date pickers (arrays don't fit the
 *  string-only t() path). Formatted display dates elsewhere stay French-style
 *  per the client's number/date-format decision. */
import { useI18n } from "./I18nProvider";
import type { Lang } from "./config";

const MONTHS: Record<Lang, string[]> = {
  fr: ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
       "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"],
  es: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
       "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
};

const MONTHS_SHORT: Record<Lang, string[]> = {
  fr: ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."],
  es: ["Ene.", "Feb.", "Mar.", "Abr.", "May.", "Jun.", "Jul.", "Ago.", "Sept.", "Oct.", "Nov.", "Dic."],
};

export function useMonths(): string[] {
  return MONTHS[useI18n().lang];
}
export function useMonthsShort(): string[] {
  return MONTHS_SHORT[useI18n().lang];
}
