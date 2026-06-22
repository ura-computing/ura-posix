import { api } from "@/api/client";
import type { MedicamentSuggestion, SpecialProduct } from "@/types";


export function listSpecialProducts(): Promise<SpecialProduct[]> {
  return api(`/special-products/`);
}

export function createSpecialProduct(medicamentId: number): Promise<SpecialProduct> {
  return api(`/special-products/`, {
    method: "POST",
    body:   { medicament_id: medicamentId },
  });
}

export function deleteSpecialProduct(medicamentId: number): Promise<{ deleted: boolean; medicament_id: number }> {
  return api(`/special-products/${medicamentId}`, { method: "DELETE" });
}

export function suggestMedicaments(q: string): Promise<MedicamentSuggestion[]> {
  return api(`/special-products/suggestions?q=${encodeURIComponent(q)}`);
}
