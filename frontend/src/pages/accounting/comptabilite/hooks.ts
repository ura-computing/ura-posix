/** Page state for /comptabilité — wraps existing useStats + new usePayments
 *  + /ventes ledger wiring. Also exposes a handleExport that builds an xlsx
 *  client-side from the loaded stats payload via the shared downloadXlsx. */
import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { URLS } from "@/api/urls";
import { QUERIES } from "@/api/queries";
import { useGlobalDateRange } from "@/hooks/useGlobalDateRange";

import type {
  PaymentMethod,
  StatsFilters,
  VentesFilters,
  PaymentEntry,
  PaymentEntryIn,
  StatsResponse,
  VentesListResponse,
} from "@/types";
import { downloadXlsx, exportFilename } from "@/utils/table";


// Local filter shape — date_from + date_to live in the cross-route global
// context. Consumers still see the merged StatsFilters via the `filters`
// + `setFilters` returned below (unchanged external API).
type LocalFilters = Omit<StatsFilters, "date_from" | "date_to">;

const DEFAULT_LOCAL: LocalFilters = {
  category_type:        "all",
  include_non_declared: false,
};

/** Pick the current YYYY-MM bucket the payment cards should display. Defaults
 *  to "today" so the cards always show the most recently-entered month at
 *  page load; user can change it via the dialog's month picker. */
function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}


export function useComptabilitePage() {
  // Date range comes from the cross-route context (preserved when user
  // navigates to /achats, /ventes, etc.). All other filter fields stay
  // page-local.
  const { from: dateFrom, to: dateTo, setRange } = useGlobalDateRange();
  const [local, setLocal] = useState<LocalFilters>(DEFAULT_LOCAL);

  const filters: StatsFilters = useMemo(
    () => ({ ...local, date_from: dateFrom, date_to: dateTo }),
    [local, dateFrom, dateTo],
  );

  // Backwards-compatible wrapper: consumers still call
  // `setFilters({ ...filters, date_from, date_to, category_type, ... })`.
  // We split the write so the dates flow to the global context.
  const setFilters = (next: StatsFilters) => {
    const { date_from, date_to, ...rest } = next;
    setLocal(rest);
    setRange(date_from, date_to);
  };

  const [activeMonth,  setActiveMonth]  = useState<string>(currentYearMonth());
  const [openMethod,   setOpenMethod]   = useState<PaymentMethod | null>(null);   // dialog state

  // Ledger pagination + sort — mirror the shape /ventes uses so the shared
  // DataTable footer + ColumnDef sortable behavior plug in unchanged.
  const [ventesPage,     setVentesPage]     = useState(1);
  const [ventesPageSize, setVentesPageSize] = useState(25);
  const [ventesSortBy,   setVentesSortBy]   = useState<string | null>(null);
  const [ventesSortOrder, setVentesSortOrder] = useState<"asc" | "desc">("desc");

  // KPIs (existing /stats endpoint)
  const statsQ = useQuery({
    queryKey: QUERIES.stats.main(filters.date_from, filters.date_to, filters.category_type, filters.include_non_declared),
    queryFn:  () => api.get<StatsResponse>(URLS.stats.main, { params: filters }),
    staleTime: 60_000,
  });
  const stats        = statsQ.data;
  const statsLoading = statsQ.isLoading;

  // Payment entries for the active month (drives the 4 cards)
  const paymentsQ = usePayments(activeMonth);
  const payments  = paymentsQ.data ?? [];

  // Ventes ledger — independent query so changing the page's filters refetches
  // just the ledger (TanStack cache keyed via QUERIES.ventes.list).
  const ventesFilters: VentesFilters = useMemo(() => ({
    page:                 ventesPage,
    limit:                ventesPageSize,
    date_from:            filters.date_from,
    date_to:              filters.date_to,
    search:               "",
    category:             [],
    tva:                  [],
    surveillance:         null,
    include_non_declared: filters.include_non_declared,
    sort_by:              ventesSortBy,
    sort_order:           ventesSortOrder,
  }), [filters, ventesPage, ventesPageSize, ventesSortBy, ventesSortOrder]);

  const ventesQ = useQuery({
    queryKey: QUERIES.ventes.list(ventesFilters),
    queryFn:  () => api.get<VentesListResponse>(URLS.ventes.list, { params: ventesFilters }),
  });

  /** Toggle order on same key; reset to "desc" on different key.
   *  Same UX as the /ventes page's setSort. */
  const setVentesSort = (key: string) => {
    if (key === ventesSortBy) {
      setVentesSortOrder(ventesSortOrder === "desc" ? "asc" : "desc");
    } else {
      setVentesSortBy(key);
      setVentesSortOrder("desc");
    }
  };

  // ── Excel export — KPI snapshot, client-side from the stats payload ────────
  const handleExport = useCallback(() => {
    if (!stats) return;
    const fmt = (n: number | null | undefined) => (n ?? 0);
    const rows: (string | number)[][] = [
      ["Comptabilité — résumé KPI"],
      [],
      ["Période", `${filters.date_from ?? "—"} → ${filters.date_to ?? "—"}`],
      ["Type",    filters.category_type],
      ["Avec produits spéciaux", filters.include_non_declared ? "Oui" : "Non"],
      [],
      ["Indicateur", "Valeur (MAD)"],
      ["Chiffre d'Affaires",   fmt(stats.kpis.ventes_total)],
      ["Achats",                fmt(stats.kpis.achats_total)],
      [],
      ["Marge", ""],
      ["Marge %",              fmt(stats.marge.marge_pct)],
      ["Marge brute (DH)",     fmt(stats.marge.marge_brute_dh)],
      ["Marge nette (DH)",     fmt(stats.marge.marge_nette_dh)],
      [],
      ["TVA", ""],
      ["TVA encaissée",        fmt(stats.tva.tva_encaissee)],
      ["TVA payée",            fmt(stats.tva.tva_payee)],
      ["TVA à déclarer",       fmt(stats.tva.tva_a_declarer)],
      [],
      ["Type breakdown", "Ventes (MAD)"],
      ["Pharmacie",            fmt(stats.type_breakdown.pharmacie.ventes_total)],
      ["Parapharmacie",        fmt(stats.type_breakdown.parapharmacie.ventes_total)],
    ];
    void downloadXlsx(rows, exportFilename("COMPTABILITE", "xlsx", filters.date_from, filters.date_to));
  }, [stats, filters]);

  return {
    filters, setFilters,
    activeMonth, setActiveMonth,
    openMethod, setOpenMethod,

    stats, statsLoading,
    payments, paymentsLoading: paymentsQ.isLoading,

    // Ventes ledger — full pagination/sort surface so the DataTable footer +
    // sortable headers behave the same as /achats and /ventes.
    ventes:          ventesQ.data?.data ?? [],
    ventesTotal:     ventesQ.data?.pagination.total ?? 0,
    ventesLoading:   ventesQ.isLoading,
    ventesPage,      setVentesPage,
    ventesPageSize,  setVentesPageSize,
    ventesSortBy,    ventesSortOrder, setVentesSort,

    handleExport,
  };
}

/** Comptabilité — TanStack Query wrappers around the /accounting/payments
 *  endpoints. Mutations invalidate the PAYMENTS_PREFIX so the page card grid
 *  refreshes without a manual refetch. */

/** Payment entries for `month` (YYYY-MM). Omit `month` to load all entries. */
export function usePayments(month?: string) {
  return useQuery({
    queryKey: QUERIES.payments.list(month),
    queryFn:  () => api.get<PaymentEntry[]>(URLS.payments.list, { params: { month } }),
    staleTime: 30_000,
  });
}

export function useSavePayment() {
  const qc = useQueryClient();
  return useMutation<PaymentEntry, Error, PaymentEntryIn>({
    mutationFn: (body) => api.post<PaymentEntry>(URLS.payments.list, body),
    onSuccess:  () => { void qc.invalidateQueries({ queryKey: QUERIES.payments.all }); },
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (id) => api.delete(URLS.payments.one(id)),
    onSuccess:  () => { void qc.invalidateQueries({ queryKey: QUERIES.payments.all }); },
  });
}
