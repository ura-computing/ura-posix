import type { SegmentOption } from "@/_components/molecules/Segmented";
import { useT } from "@/i18n/I18nProvider";

/** Standard 3-option set for "Catégorie" filter — Mixte / Pharmacie / Parapharmacie.
 *  Locked palette: primary teal for Mixte, indigo for Pharmacie, orange for
 *  Parapharmacie (matches the tokens.css category trio). */
const CATEGORY_TYPE_STYLES = {
  all: "bg-primary text-primary-foreground shadow-sm",
  pharmacie: "bg-pharmacie-bg text-pharmacie-fg border border-pharmacie-border",
  parapharmacie: "bg-parapharmacie-bg text-parapharmacie-fg border border-parapharmacie-border",
} as const;

/** Translated Mixte / Pharmacie / Parapharmacie options for the category filter. */
export function useCategoryTypeOptions(): SegmentOption<"all" | "pharmacie" | "parapharmacie">[] {
  const t = useT();
  return [
    { value: "all", label: t("category.mixte"), activeBg: CATEGORY_TYPE_STYLES.all },
    { value: "pharmacie", label: t("category.pharmacie"), activeBg: CATEGORY_TYPE_STYLES.pharmacie },
    { value: "parapharmacie", label: t("category.parapharmacie"), activeBg: CATEGORY_TYPE_STYLES.parapharmacie },
  ];
}
