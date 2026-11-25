/** « Stock abîmé » (/owner/stock-abime, /employee/stock-abime): every declaration of damaged boxes, one page at a
 *  time (server side), search + state, Excel; a declaration's next state. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { API, refresh } from "@/api/api";
import { api } from "@/api/client";
import { useListFilters } from "@/hooks/useListFilters";
import { useT } from "@/i18n/I18nProvider";
import type { Damage, DamageFilters, DamageListResponse, DamageStatus } from "@/types/damaged";
import { downloadXlsx, exportFilename } from "@/utils/table";
import { formatDateTime } from "@/utils/format";

const DEFAULT_FILTERS: DamageFilters = {
  search: "",
  status: null,
  sort_by: null,
  sort_order: "desc",
  page: 1,
  limit: 25,
};

export const STATUS_LABEL: Record<DamageStatus, string> = {
  pending: "damaged.statusPending",
  returned: "damaged.statusReturned",
  destroyed: "damaged.statusDestroyed",
  back_on_sale: "damaged.statusBackOnSale",
};

/** Where a declaration may go next (same rule as the backend). */
export const NEXT: Record<DamageStatus, DamageStatus[]> = {
  pending: ["returned", "destroyed", "back_on_sale"],
  returned: ["back_on_sale"],
  destroyed: ["back_on_sale"],
  back_on_sale: [],
};

export function useStockAbimePage() {
  const t = useT();
  const qc = useQueryClient();
  const { filters, patch, setPage, setPageSize, reset } = useListFilters(DEFAULT_FILTERS, "desc");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.damaged.list.key(filters),
    queryFn: () => api.get<DamageListResponse>(API.damaged.list.url, { params: filters }),
  });

  const { mutateAsync, isPending: isMoving } = useMutation({
    mutationFn: ({ id, status }: { id: number; status: DamageStatus }) =>
      api.patch<Damage>(API.damaged.move.url(id), { status }),
    onSuccess: () => {
      toast.success(t("damaged.moved"));
      void refresh(qc, API.damaged.move);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Excel: every matching row (server side, no pagination), French headers.
  const handleExport = async () => {
    try {
      const { data: rows } = await api.get<DamageListResponse>(API.damaged.list.url, {
        params: { ...filters, page: undefined, limit: undefined, export: true },
      });
      const header = ["Date", "PID", "Produit", "Boîtes", "Raison", "Note", "État", "Déclaré par", "Changé le"];
      const body = rows.map((r) => [
        formatDateTime(r.created_at),
        r.pid,
        r.product,
        r.quantity,
        r.reason ?? "",
        r.note ?? "",
        t(STATUS_LABEL[r.status]),
        r.created_by_name,
        r.closed_at ? formatDateTime(r.closed_at) : "",
      ]);
      await downloadXlsx([header, ...body], exportFilename("STOCK_ABIME", "xlsx"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("damaged.exportFailed"));
    }
  };

  return {
    filters,
    setSearch: (search: string) => patch({ search }),
    setStatus: (status: DamageStatus | null) => patch({ status }),
    setPage,
    setPageSize,
    reset,
    rows: data?.data ?? [],
    total: data?.pagination.total ?? 0,
    boxesOff: data?.boxes_off ?? 0,
    isLoading,
    isError,
    reload: () => void refetch(),
    moveDamage: (id: number, status: DamageStatus) => mutateAsync({ id, status }).then(() => undefined),
    isMoving,
    handleExport,
  };
}
