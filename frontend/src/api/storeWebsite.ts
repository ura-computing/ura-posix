/** API client for `/v1/store-website/*`.
 *
 *  Split into owner / developer / public. Types mirror
 *  backend/schemas/store_website.py — the ONLY source of truth is the backend,
 *  so we keep this file thin and re-export types from `@/types/storeWebsiteApi`. */
import { api, API_BASE } from "./client";
import type {
  CustomizationOut,
  CustomizationPatch,
  PublicPreviewOut,
  StateTransition,
  WebsiteRequestCreate,
  WebsiteRequestOut,
  WebsiteRequestPatch,
  WebsiteRequestWithCustomizationOut,
} from "@/types/storeWebsiteApi";


// ── Owner ───────────────────────────────────────────────────────────────────

export function getMyRequest(): Promise<WebsiteRequestOut | null> {
  return api<WebsiteRequestOut | null>("/store-website/my-request");
}

export function createRequest(body: WebsiteRequestCreate): Promise<WebsiteRequestOut> {
  return api<WebsiteRequestOut>("/store-website/requests", { method: "POST", body });
}

export function patchRequest(id: string, body: WebsiteRequestPatch): Promise<WebsiteRequestOut> {
  return api<WebsiteRequestOut>(`/store-website/requests/${id}`, { method: "PATCH", body });
}

export function patchFeaturedCategories(id: string, ids: string[]): Promise<CustomizationOut> {
  return api<CustomizationOut>(
    `/store-website/requests/${id}/featured-categories`,
    { method: "PATCH", body: { featured_category_ids: ids } },
  );
}


// ── Developer ──────────────────────────────────────────────────────────────

export function listRequests(): Promise<WebsiteRequestOut[]> {
  return api<WebsiteRequestOut[]>("/store-website/requests");
}

export function getRequest(id: string): Promise<WebsiteRequestWithCustomizationOut> {
  return api<WebsiteRequestWithCustomizationOut>(`/store-website/requests/${id}`);
}

export function claimRequest(id: string): Promise<WebsiteRequestOut> {
  return api<WebsiteRequestOut>(`/store-website/requests/${id}/claim`, { method: "POST" });
}

export function releaseRequest(id: string): Promise<WebsiteRequestOut> {
  return api<WebsiteRequestOut>(`/store-website/requests/${id}/release`, { method: "POST" });
}

export function transitionState(id: string, body: StateTransition): Promise<WebsiteRequestOut> {
  return api<WebsiteRequestOut>(`/store-website/requests/${id}/state`, { method: "PATCH", body });
}

export function patchCustomization(id: string, body: CustomizationPatch): Promise<CustomizationOut> {
  return api<CustomizationOut>(
    `/store-website/requests/${id}/customization`,
    { method: "PATCH", body },
  );
}

export function resetCustomization(id: string): Promise<CustomizationOut> {
  return api<CustomizationOut>(
    `/store-website/requests/${id}/customization/reset`,
    { method: "POST" },
  );
}

/** Multipart logo upload — bypasses the JSON `api()` helper since we need
 *  multipart/form-data and NO Content-Type header (browser sets the boundary). */
export async function uploadLogo(id: string, file: File): Promise<CustomizationOut> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/store-website/requests/${id}/logo`, {
    method:      "POST",
    credentials: "include",
    body:        fd,
    headers:     { "X-Requested-With": "XMLHttpRequest" },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.detail ?? "Échec du téléversement du logo.");
  return data as CustomizationOut;
}


// ── Public (no auth) ────────────────────────────────────────────────────────

export function getPublicPreview(id: string): Promise<PublicPreviewOut> {
  return api<PublicPreviewOut>(`/store-website/public/preview/${id}`);
}


// ── Admin ───────────────────────────────────────────────────────────────────

export interface DeveloperAccountOut {
  id:              string;
  name:            string;
  email:           string;
  status:          "actif" | "en_attente" | "desactive";
  active_requests: number;
  last_active_at:  string | null;
}

export function listDevelopers(): Promise<DeveloperAccountOut[]> {
  return api<DeveloperAccountOut[]>("/store-website/admin/developers");
}
