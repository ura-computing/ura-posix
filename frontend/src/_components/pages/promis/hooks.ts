/** « Promis » list (/owner/promis, /employee/promis): the dashboard (counts, « À faire aujourd'hui »), then one page
 *  at a time (server side), search + state + pickup deadline, Excel. */
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { API } from "@/api/api";
import { api } from "@/api/client";
import { useListFilters } from "@/hooks/useListFilters";
import { useT } from "@/i18n/I18nProvider";
import type { PromisDeadline, PromisFilters, PromisListResponse, PromisState, PromisSummary } from "@/types/promis";
import { formatDateTime } from "@/utils/format";
import { downloadXlsx, exportFilename } from "@/utils/table";

const DEFAULT_FILTERS: PromisFilters = {
  search: "",
  state: null,
  deadline: null,
  sort_by: null,
  sort_order: "desc",
  page: 1,
  limit: 25,
};

export function usePromisPage() {
  const t = useT();
  const { filters, patch, setPage, setPageSize, reset } = useListFilters(DEFAULT_FILTERS, "desc");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.promis.list.key(filters),
    queryFn: () => api.get<PromisListResponse>(API.promis.list.url, { params: filters }),
  });
  const { data: summary } = useQuery({
    queryKey: API.promis.summary.key,
    queryFn: () => api.get<PromisSummary>(API.promis.summary.url),
  });

  // Excel: every matching row (server side, no pagination), French headers.
  const handleExport = async () => {
    try {
      const { data: rows } = await api.get<PromisListResponse>(API.promis.list.url, {
        params: { ...filters, page: undefined, limit: undefined, export: true },
      });
      const header = ["N°", "Date", "Client", "Téléphone", "Produits", "État", "Note", "Créé par"];
      const body = rows.map((r) => [
        r.number,
        formatDateTime(r.created_at),
        r.customer_name,
        r.customer_phone ?? "",
        r.lines.map((l) => `${l.quantity} × ${l.name}`).join(", "),
        t(`promis.state_${r.state}`),
        r.note ?? "",
        r.created_by_name,
      ]);
      await downloadXlsx([header, ...body], exportFilename("PROMIS", "xlsx"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("promis.exportFailed"));
    }
  };

  return {
    filters,
    setSearch: (search: string) => patch({ search }),
    setState: (state: PromisState | null) => patch({ state }),
    setDeadline: (deadline: PromisDeadline | null) => patch({ deadline }),
    summary: summary ?? null,
    setPage,
    setPageSize,
    reset,
    rows: data?.data ?? [],
    total: data?.pagination.total ?? 0,
    isLoading,
    isError,
    reload: () => void refetch(),
    handleExport,
  };
}
