import { api } from "@/api/client";
import type {
  AchatsFilters, AchatsListResponse, AchatsSuggestions, AchatsSupplierSummary,
  VentesDiscountSummary,
  VentesFilters, VentesListResponse, VentesSuggestions, VentesSurveillanceCounts,
} from "@/types";


/** Serialize filters into a query string. Skips empty + nulls. Used by listVentes + counts. */
function ventesQs(f: Partial<VentesFilters>): string {
  const p = new URLSearchParams();
  if (f.page != null)                     p.set("page",   String(f.page));
  if (f.limit != null)                    p.set("limit",  String(f.limit));
  if (f.date_from)                        p.set("date_from", f.date_from);
  if (f.date_to)                          p.set("date_to",   f.date_to);
  if (f.search)                           p.set("search", f.search);
  if (f.surveillance)                     p.set("surveillance", f.surveillance);
  if (f.include_non_declared === false)   p.set("include_non_declared", "false");
  if (f.sort_by)                          p.set("sort_by",    f.sort_by);
  if (f.sort_order)                       p.set("sort_order", f.sort_order);
  for (const c of f.category ?? []) p.append("category", c);
  for (const t of f.tva ?? [])      p.append("tva",      t);
  return p.toString();
}


export function listVentes(filters: Partial<VentesFilters>): Promise<VentesListResponse> {
  return api(`/ventes?${ventesQs(filters)}`);
}


export function listVentesCategories(): Promise<string[]> {
  return api(`/ventes/categories`);
}


export function listVentesTvaRates(): Promise<string[]> {
  return api(`/ventes/tva-rates`);
}


/** Full filtered set for Excel export. Honors every filter EXCEPT pagination.
 *  Backend caps at MAX_EXPORT_ROWS (50k) → throws ApiErr 413 if exceeded. */
export function exportVentes(filters: Partial<VentesFilters>): Promise<VentesListResponse> {
  const { page: _p, limit: _l, ...rest } = filters;
  const qs = ventesQs(rest);
  return api(`/ventes?${qs}${qs ? "&" : ""}export=true`);
}


export function listVentesSurveillanceCounts(filters: Partial<VentesFilters>): Promise<VentesSurveillanceCounts> {
  // Counts share the same filter shape but ignore surveillance/sort/pagination
  const { surveillance: _s, sort_by: _sb, sort_order: _so, page: _p, limit: _l, ...rest } = filters;
  return api(`/ventes/surveillance-counts?${ventesQs(rest)}`);
}


/** Discount-vs-full-price split for the /ventes remise-discipline gauge.
 *  Same filter axes as surveillance-counts: ignores pagination/sort AND
 *  the active surveillance tab so the gauge always reflects the full set. */
export function listVentesDiscountSummary(filters: Partial<VentesFilters>): Promise<VentesDiscountSummary> {
  const { surveillance: _s, sort_by: _sb, sort_order: _so, page: _p, limit: _l, ...rest } = filters;
  return api(`/ventes/discount-summary?${ventesQs(rest)}`);
}


export function listVentesSuggestions(q: string): Promise<VentesSuggestions> {
  return api(`/ventes/suggestions?q=${encodeURIComponent(q)}`);
}

// ── Achats (Page 4) ─────────────────────────────────────────────────────────

function achatsQs(f: Partial<AchatsFilters>): string {
  const p = new URLSearchParams();
  if (f.page != null)               p.set("page",   String(f.page));
  if (f.limit != null)              p.set("limit",  String(f.limit));
  if (f.date_from)                  p.set("date_from", f.date_from);
  if (f.date_to)                    p.set("date_to",   f.date_to);
  if (f.search)                     p.set("search", f.search);
  if (f.sort_by)                    p.set("sort_by",    f.sort_by);
  if (f.sort_order)                 p.set("sort_order", f.sort_order);
  for (const c of f.category ?? []) p.append("category", c);
  for (const t of f.tva ?? [])      p.append("tva",      t);
  return p.toString();
}


export function listAchats(filters: Partial<AchatsFilters>): Promise<AchatsListResponse> {
  return api(`/achats?${achatsQs(filters)}`);
}

/** Full filtered set for Excel export. Same contract as exportVentes. */
export function exportAchats(filters: Partial<AchatsFilters>): Promise<AchatsListResponse> {
  const { page: _p, limit: _l, ...rest } = filters;
  const qs = achatsQs(rest);
  return api(`/achats?${qs}${qs ? "&" : ""}export=true`);
}


export function listAchatsCategories(): Promise<string[]> {
  return api(`/achats/categories`);
}

export function listAchatsTvaRates(): Promise<string[]> {
  return api(`/achats/tva-rates`);
}

export function listAchatsSuggestions(q: string): Promise<AchatsSuggestions> {
  return api(`/achats/suggestions?q=${encodeURIComponent(q)}`);
}

export function listAchatsSupplierSummary(filters: Partial<AchatsFilters>): Promise<AchatsSupplierSummary> {
  // supplier-summary ignores pagination + sort — strip them
  const { page: _p, limit: _l, sort_by: _sb, sort_order: _so, ...rest } = filters;
  return api(`/achats/supplier-summary?${achatsQs(rest)}`);
}
