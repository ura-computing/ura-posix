// src/pages/rapport/_hooks/useCategoryTint.ts
// Category-tint helper for the Rapport page. Threads `filters.category_type`
// into a class + var accent that non-KpiTile wrappers (CategoriesDonut,
// TrendChart, SanteFinanciere, TopCategoriesList, AnalyseMarge gauge/cta)
// can pick up so the whole page adopts the current CategorySegment value.
//
// KpiTile has its own `tint` prop wired to the same tokens; this helper is
// specifically for non-KpiTile blocks that render their own `border/bg` shell.
import type { CategoryType } from "@/types";


export interface CategoryTint {
  /** Replaces `border border-border bg-card` on the outer wrapper. */
  cardClass: string;
  /** CSS custom-property value (`var(--color-*)`) for accent bits. */
  accentVar: string;
}


export function useCategoryTint(category: CategoryType): CategoryTint {
  if (category === "pharmacie") {
    return {
      cardClass: "border border-pharmacie-border bg-pharmacie-bg/30",
      accentVar: "var(--color-pharmacie)",
    };
  }
  if (category === "parapharmacie") {
    return {
      cardClass: "border border-parapharmacie-border bg-parapharmacie-bg/30",
      accentVar: "var(--color-parapharmacie)",
    };
  }
  return {
    cardClass: "border border-border bg-card",
    accentVar: "var(--color-total)",
  };
}
