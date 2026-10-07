import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { api, ApiErr } from "@/api/client";
import { API } from "@/api/api";
import { useGlobalDateRange } from "@/hooks/useGlobalDateRange";
import { useListFilters } from "@/hooks/useListFilters";
import { useT } from "@/i18n/I18nProvider";
import type { MovementsFilters, ProductMovementsResponse, ProductSheet, ProductStats } from "@/types";
import { downloadXlsx, exportFilename } from "@/utils/table";

export const SHEET_TABS = ["general", "stats", "movements", "codes"] as const;
export type SheetTab = (typeof SHEET_TABS)[number];

/** One product's sheet, its statistics (« Ventes par mois » + Statistiques tab) and the
 *  tab in the URL (`?tab=codes`, kept on reload / back). */
export function useProduitPage(id: number) {
  const valid = Number.isInteger(id) && id > 0;
  const { data, isLoading, error } = useQuery({
    queryKey: API.products.sheet.key(id),
    queryFn: () => api.get<ProductSheet>(API.products.sheet.url(id)),
    enabled: valid,
  });
  const { data: stats } = useQuery({
    queryKey: API.products.stats.key(id),
    queryFn: () => api.get<ProductStats>(API.products.stats.url(id)),
    enabled: valid && !!data,
  });

  const [params, setParams] = useSearchParams();
  const asked = params.get("tab");
  const tab: SheetTab = SHEET_TABS.find((t) => t === asked) ?? "general";
  const setTab = (next: SheetTab) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === "general") p.delete("tab");
        else p.set("tab", next);
        return p;
      },
      { replace: true },
    );

  return {
    sheet: data ?? null,
    stats: stats ?? null,
    isLoading,
    // Not one of the pharmacy's products (or a wrong address): the 404 inside the layout.
    notFound: !valid || (error instanceof ApiErr && error.status === 404),
    tab,
    setTab,
  };
}

const DEFAULT_MOVES: Omit<MovementsFilters, "date_from" | "date_to"> = {
  page: 1,
  limit: 25,
  search: "",
  kind: "all",
  sort_by: null,
  sort_order: "desc",
};

/** Query string of the movements call (no sort: always newest first). */
const toParams = (f: MovementsFilters) => ({
  date_from: f.date_from,
  date_to: f.date_to,
  kind: f.kind,
  search: f.search,
  page: f.page,
  limit: f.limit,
});

/** « Mouvements »: one product's purchase / sale lines, filtered (period shared with the other
 *  pages, type, search), paged; Excel = every filtered line. */
export function useMovements(id: number, pid: string) {
  const t = useT();
  const { from, to, setRange } = useGlobalDateRange();
  const { filters: local, patch, setPage, setPageSize, reset: resetLocal } = useListFilters(DEFAULT_MOVES, "desc");
  const filters: MovementsFilters = useMemo(() => ({ ...local, date_from: from, date_to: to }), [local, from, to]);

  const { data, isLoading } = useQuery({
    queryKey: API.products.movements.key(id, filters),
    queryFn: () => api.get<ProductMovementsResponse>(API.products.movements.url(id), { params: toParams(filters) }),
  });

  // Every filter change goes back to page 1 (`patch`); the period is shared between pages.
  const setSearch = (search: string) => patch({ search });
  const setKind = (kind: MovementsFilters["kind"]) => patch({ kind });
  const reset = () => {
    resetLocal();
    setRange(null, null);
  };

  const handleExport = useCallback(async () => {
    try {
      const { data: lines } = await api.get<ProductMovementsResponse>(API.products.movements.url(id), {
        params: { ...toParams(filters), page: undefined, limit: undefined, export: true },
      });
      const header = [
        "Date",
        "Type",
        "Quantité",
        "Prix unitaire",
        "Total",
        "Document",
        "Fournisseur / client",
        "Fichier importé",
      ];
      const body = lines.map((m) => [
        m.date ?? "",
        m.kind === "achat" ? "Achat" : "Vente",
        m.quantity ?? "",
        m.unit_price ?? "",
        m.total ?? "",
        m.document ?? "",
        m.party ?? "",
        m.filename ?? "",
      ]);
      await downloadXlsx([header, ...body], exportFilename(`MOUVEMENTS ${pid}`, "xlsx", from, to));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("products.exportFailed"));
    }
  }, [id, pid, filters, from, to, t]);

  return {
    filters,
    setSearch,
    setKind,
    setDateRange: setRange,
    setPage,
    setPageSize,
    reset,
    handleExport,
    rows: data?.data ?? [],
    total: data?.pagination.total ?? 0,
    unitsBought: data?.units_bought ?? 0,
    unitsSold: data?.units_sold ?? 0,
    isLoading,
  };
}
