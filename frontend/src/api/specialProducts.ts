import { api } from "@/api/client";
import type {
  MedicamentSuggestion,
  SpecialProduct,
  SpecialProductBulkResult,
  SpecialProductReintegrateResult,
} from "@/types";


export function listSpecialProducts(): Promise<SpecialProduct[]> {
  return api(`/special-products/`);
}

/** Bulk-exclude one or more medicaments. Atomic + idempotent — already-spécial
 *  ids count toward `already_special` rather than erroring. */
export function excludeProducts(medicamentIds: number[]): Promise<SpecialProductBulkResult> {
  return api(`/special-products/`, {
    method: "POST",
    body:   { medicament_ids: medicamentIds },
  });
}

/** Bulk-réintégrer one or more medicaments (drop the spécial flag). Idempotent —
 *  ids that aren't currently spécial are silently counted as `not_special`. */
export function reintegrateProducts(medicamentIds: number[]): Promise<SpecialProductReintegrateResult> {
  return api(`/special-products/reintegrate`, {
    method: "POST",
    body:   { medicament_ids: medicamentIds },
  });
}

export function suggestMedicaments(q: string): Promise<MedicamentSuggestion[]> {
  return api(`/special-products/suggestions?q=${encodeURIComponent(q)}`);
}
