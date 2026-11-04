import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/api/client";
import { API } from "@/api/api";
import { useListFilters } from "@/hooks/useListFilters";
import { useT } from "@/i18n/I18nProvider";
import type { HistoryFilters, HistoryKind, HistoryResponse } from "@/types";
import { formatDateTime } from "@/utils/format";
import { historyKind, historyText } from "@/utils/history";
import { downloadXlsx, exportFilename } from "@/utils/table";

const DEFAULT: HistoryFilters = {
  page: 1,
  limit: 20,
  search: "",
  kind: "all",
  person: null,
  date_from: null,
  date_to: null,
  sort_by: null,
  sort_order: "desc",
};

/** The owner's « Historique » page: every change of the pharmacy, newest first; filters by person,
 *  type, dates (its own, not the Ventes ones) and text; Excel = every matching line. */
export function useHistoryPage() {
  const t = useT();
  const { filters, patch, setPage, setPageSize, reset } = useListFilters(DEFAULT, "desc");
  const params = {
    person: filters.person,
    kind: filters.kind,
    date_from: filters.date_from,
    date_to: filters.date_to,
    search: filters.search,
  };
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.history.list.key(filters),
    queryFn: () =>
      api.get<HistoryResponse>(API.history.list.url, {
        params: { ...params, page: filters.page, limit: filters.limit },
      }),
    placeholderData: keepPreviousData,
  });

  // Every filter change goes back to page 1 (`patch`).
  const setSearch = (search: string) => patch({ search });
  const setKind = (kind: HistoryKind) => patch({ kind });
  const setPerson = (person: string | null) => patch({ person });
  const setDateRange = (date_from: string | null, date_to: string | null) => patch({ date_from, date_to });

  const handleExport = async () => {
    try {
      const { data: rows } = await api.get<HistoryResponse>(API.history.list.url, {
        params: { ...params, export: true },
      });
      const header = ["Date", "Personne", "Type", "Produit", "Détail"];
      const body = rows.map((r) => [
        formatDateTime(r.created_at),
        r.user_name,
        historyKind(t, r),
        r.product ?? "",
        historyText(t, r),
      ]);
      await downloadXlsx([header, ...body], exportFilename("HISTORIQUE", "xlsx", filters.date_from, filters.date_to));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("history.exportFailed"));
    }
  };

  return {
    filters,
    setSearch,
    setKind,
    setPerson,
    setDateRange,
    setPage,
    setPageSize,
    reset,
    handleExport,
    rows: data?.data ?? [],
    people: data?.people ?? [],
    total: data?.pagination.total ?? 0,
    isLoading,
    isError,
    reload: () => void refetch(),
  };
}
