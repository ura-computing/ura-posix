import { api } from "@/api/client";
import type {
  BlDetail,
  BlExclusion,
  BlExclusionResult,
  BlReintegrateResult,
  BlSummary,
} from "@/types";


/** BLs currently excluded for this pharmacy (newest first). */
export function listBlExclusions(): Promise<BlExclusion[]> {
  return api(`/bl-exclusions/`);
}

/** Search BLs to exclude — by reference (substring) OR by a product they contain. */
export function searchBls(q: string): Promise<BlSummary[]> {
  return api(`/bl-exclusions/search?q=${encodeURIComponent(q)}`);
}

/** Full product lines of one BL, for the confirmation step. */
export function getBlDetail(deliveryRef: string): Promise<BlDetail> {
  return api(`/bl-exclusions/detail?delivery_ref=${encodeURIComponent(deliveryRef)}`);
}

/** Exclude one BL by reference (+ optional note). Idempotent, reversible. */
export function excludeBl(deliveryRef: string, notes?: string): Promise<BlExclusionResult> {
  return api(`/bl-exclusions/`, {
    method: "POST",
    body:   { delivery_ref: deliveryRef, notes: notes || null },
  });
}

/** Un-exclude one or more BLs (restores their Achats to every aggregate). */
export function reintegrateBls(deliveryRefs: string[]): Promise<BlReintegrateResult> {
  return api(`/bl-exclusions/reintegrate`, {
    method: "POST",
    body:   { delivery_refs: deliveryRefs },
  });
}
