import { api } from "@/api/client";
import type {
  SupplierExclusion,
  SupplierExclusionResult,
  SupplierReintegrateResult,
  SupplierSummary,
} from "@/types";


/** Suppliers currently excluded for this pharmacy (newest first). */
export function listSupplierExclusions(): Promise<SupplierExclusion[]> {
  return api(`/supplier-exclusions/`);
}

/** Search suppliers to exclude — by name (accent/case-insensitive, `*` wildcard). */
export function searchSuppliers(q: string): Promise<SupplierSummary[]> {
  return api(`/supplier-exclusions/search?q=${encodeURIComponent(q)}`);
}

/** Exclude one supplier by name (+ optional note). Idempotent, reversible. */
export function excludeSupplier(supplier: string, notes?: string): Promise<SupplierExclusionResult> {
  return api(`/supplier-exclusions/`, {
    method: "POST",
    body:   { supplier, notes: notes || null },
  });
}

/** Un-exclude one or more suppliers (restores their Achats to every aggregate). */
export function reintegrateSuppliers(suppliers: string[]): Promise<SupplierReintegrateResult> {
  return api(`/supplier-exclusions/reintegrate`, {
    method: "POST",
    body:   { suppliers },
  });
}
