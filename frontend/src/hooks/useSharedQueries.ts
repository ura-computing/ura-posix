/** Reads used by several pages: one hook per query, so two pages never build the same
 *  cache slot twice (same key = same data type, same staleTime, same names). A read
 *  used by one page only stays in that page's `hooks.ts`. */
import { useQuery } from "@tanstack/react-query";

import { API } from "@/api/api";
import { api } from "@/api/client";
import type { PharmacyListRow } from "@/types/members";
import type { AdminSobrusImport, SobrusConnection } from "@/types/sobrus";
import type {
  AnalyseFilters,
  AnalyseMargeResponse,
  MargeMode,
  MarginAlertsResponse,
  StatsFilters,
  StatsResponse,
} from "@/types/stats";
import type { VentesFilters, VentesListResponse } from "@/types/transactions";

export type MarginAlertsFilters = Omit<StatsFilters, "include_non_declared">;

/** /stats — Rapport, Comptabilité. */
export function useStats(filters: StatsFilters) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: API.stats.main.key(
      filters.date_from,
      filters.date_to,
      filters.category_type,
      filters.include_non_declared,
    ),
    queryFn: () => api.get<StatsResponse>(API.stats.main.url, { params: filters }),
    staleTime: 60_000,
  });
  return {
    stats: data,
    isLoading,
    isError,
    error,
    reload: () => void refetch(),
  };
}

/** The 5 margin brackets — Rapport, Alertes. */
export function useMarginAlerts(filters: MarginAlertsFilters) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.stats.marginAlerts.key(
      filters.date_from ?? null,
      filters.date_to ?? null,
      filters.category_type ?? "all",
    ),
    queryFn: () => api.get<MarginAlertsResponse>(API.stats.marginAlerts.url, { params: filters }),
    staleTime: 60_000,
  });
  return {
    marginAlerts: data,
    isLoading,
    isError,
    reload: () => void refetch(),
  };
}

/** /stats/analyse-marge per mode — Analyses, Rapport « Optimisation » tile (mode
 *  produit, same slot). Liste mode is a POST (`useAnalyseListe`), not cached. */
export function useAnalyseMarge(filters: AnalyseFilters, mode: MargeMode) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: API.stats.analyseMarge.key(
      mode,
      filters.date_from,
      filters.date_to,
      filters.category_type,
      filters.product,
    ),
    queryFn: () =>
      api.get<AnalyseMargeResponse>(API.stats.analyseMarge.url, {
        params: {
          mode,
          date_from: filters.date_from,
          date_to: filters.date_to,
          category_type: filters.category_type,
          product: filters.product,
        },
      }),
    staleTime: 60_000,
    enabled: mode !== "liste",
  });
  return {
    analyse: data,
    isLoading,
    error: isError ? error : null,
    reload: () => void refetch(),
  };
}

/** One page of the ventes ledger — Ventes, Comptabilité. */
export function useVentesList(filters: VentesFilters) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.ventes.list.key(filters),
    queryFn: () => api.get<VentesListResponse>(API.ventes.list.url, { params: filters }),
  });
  return {
    ventesList: data,
    isLoading,
    isError,
    reload: () => void refetch(),
  };
}

/** Every active pharmacy — admin Pharmacies page, admin Rapport picker. */
export function useAdminPharmaciesList() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.admin.pharmacies.key,
    queryFn: () => api.get<PharmacyListRow[]>(API.admin.pharmacies.url),
    staleTime: 30_000,
  });
  return {
    pharmacies: data,
    isLoading,
    isError,
    reload: () => void refetch(),
  };
}

/** « Connexion Sobrus » — its page and the banner shown on every page when it stops working
 *  (owners with Import). While a run goes on, asked again every 2 s (its live progress). */
export function useSobrusConnection(enabled = true) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.sobrus.connection.key,
    queryFn: () => api.get<SobrusConnection>(API.sobrus.connection.url),
    enabled,
    staleTime: 60_000,
    refetchInterval: (query) => (query.state.data?.active_run ? 2000 : false),
  });
  return {
    connection: data ?? null,
    isLoading,
    isError,
    reload: () => void refetch(),
  };
}

const importActive = (s: AdminSobrusImport | undefined) =>
  !!s?.runs.some(({ run }) => run.status === "queued" || run.status === "running");

/** The admin's Sobrus runs: Catalogue « Importer les produits depuis Sobrus », « Fournisseurs » « Importer depuis
 *  Sobrus ». */
export const ADMIN_SOBRUS = {
  products: {
    read: API.admin.sobrusProducts,
    start: API.admin.startSobrusProducts,
    cancel: API.admin.cancelSobrusProducts,
    ended: API.admin.catalog.importCsv,
    texts: "catalogue",
    page: "catalogue",
  },
  suppliers: {
    read: API.admin.sobrusSuppliers,
    start: API.admin.startSobrusSuppliers,
    cancel: API.admin.cancelSobrusSuppliers,
    ended: API.admin.sobrusSuppliersEnded,
    texts: "suppliers",
    page: "fournisseurs",
  },
} as const;
export type AdminSobrusKind = keyof typeof ADMIN_SOBRUS;

/** One admin Sobrus run's last click: its tries (the page's card; products: also the corner card on every admin
 *  page). Polled every 2 s while one runs. */
export function useAdminSobrusImport(kind: AdminSobrusKind = "products", enabled = true) {
  const { read } = ADMIN_SOBRUS[kind];
  const { data, isLoading, refetch } = useQuery({
    queryKey: read.key,
    queryFn: () => api.get<AdminSobrusImport>(read.url),
    enabled,
    refetchInterval: (query) => (importActive(query.state.data) ? 2000 : false),
  });
  return {
    sobrusImport: data ?? null,
    isLoading,
    isRunning: importActive(data),
    reload: () => void refetch(),
  };
}
