import { API_BASE, ApiErr, api } from "@/api/client";
import type {
  CatalogFilters,
  CatalogImportResponse,
  CatalogListResponse,
  Medicament,
  MedicamentInput,
} from "@/types";


function catalogQs(f: Partial<CatalogFilters>): string {
  const p = new URLSearchParams();
  if (f.search)               p.set("search",     f.search);
  if (f.type)                 p.set("type",       f.type);
  if (f.sort_by)              p.set("sort_by",    f.sort_by);
  if (f.sort_order)           p.set("sort_order", f.sort_order);
  if (f.page != null)         p.set("page",       String(f.page));
  if (f.limit != null)        p.set("limit",      String(f.limit));
  for (const c of f.category ?? []) p.append("category", c);
  return p.toString();
}


export function listCatalog(filters: Partial<CatalogFilters>): Promise<CatalogListResponse> {
  return api(`/admin/catalog?${catalogQs(filters)}`);
}

export function listCatalogCategories(): Promise<string[]> {
  return api(`/admin/catalog/categories`);
}

/** Count of Medicaments with product_type IS NULL. Drives the sidebar badge
 *  on "Catalogue" — admin's queue of products needing classification. */
export function getUnclassifiedCount(): Promise<{ count: number }> {
  return api(`/admin/catalog/unclassified-count`);
}

export function createMedicament(body: MedicamentInput): Promise<Medicament> {
  return api(`/admin/catalog`, { method: "POST", body });
}

export function updateMedicament(id: number, body: Partial<MedicamentInput>): Promise<Medicament> {
  return api(`/admin/catalog/${id}`, { method: "PUT", body });
}

export function deleteMedicament(id: number): Promise<void> {
  return api(`/admin/catalog/${id}`, { method: "DELETE" });
}


// Multipart CSV upload — same shape as the achat/vente/stock uploaders.
// EXEMPTION: bypasses api() because that helper JSON-encodes its body. Multipart
// needs raw FormData + the browser-supplied boundary header.
export async function importCatalogCsv(file: File): Promise<CatalogImportResponse> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/uploads/catalog`, {
    method: "POST",
    credentials: "include",
    headers: { "X-Requested-With": "XMLHttpRequest" },
    body: fd,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const detail = data?.detail ?? "L'import a échoué.";
    throw new ApiErr(res.status, typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data as CatalogImportResponse;
}
