/** « Commandes du jour » (/owner/commandes, /employee/commandes): the drafts, « Recalculer », a line's quantity,
 *  « Enlever », « Valider la commande ». */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { API } from "@/api/api";
import { api } from "@/api/client";
import { useT } from "@/i18n/I18nProvider";
import type { DailyOrders } from "@/types/orders";

export function useDailyOrders() {
  const t = useT();
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.orders.daily.key,
    queryFn: () => api.get<DailyOrders>(API.orders.daily.url),
  });
  // Every write answers the drafts: put them in the cache at once (no second request).
  const put = (next: DailyOrders) => qc.setQueryData(API.orders.daily.key, next);
  const fail = (e: Error) => toast.error(e.message);
  const { mutate: recalc, isPending: isRefreshing } = useMutation({
    mutationFn: () => api.post<DailyOrders>(API.orders.refresh.url, {}),
    onSuccess: (next) => {
      put(next);
      toast.success(t("orders.refreshed"));
    },
    onError: fail,
  });
  const { mutate: setQty } = useMutation({
    mutationFn: ({ id, quantity }: { id: number; quantity: number }) =>
      api.patch<DailyOrders>(API.orders.line.url(id), { quantity }),
    onSuccess: put,
    onError: fail,
  });
  const { mutate: remove } = useMutation({
    mutationFn: (id: number) => api.delete<DailyOrders>(API.orders.line.url(id)),
    onSuccess: put,
    onError: fail,
  });
  const { mutateAsync: validate, isPending: isValidating } = useMutation({
    mutationFn: (id: number) => api.post<DailyOrders>(API.orders.validate.url(id), {}),
    onSuccess: (next) => {
      put(next);
      toast.success(t("orders.validated"));
    },
    onError: fail,
  });
  return {
    orders: data?.orders ?? [],
    counts: data?.counts ?? {},
    isLoading,
    isError,
    reload: () => void refetch(),
    refresh: () => recalc(),
    isRefreshing,
    setQuantity: (id: number, quantity: number) => setQty({ id, quantity }),
    removeLine: (id: number) => remove(id),
    validateOrder: (id: number) => validate(id).then(() => undefined),
    isValidating,
  };
}
