/** Comptabilité — TanStack Query wrappers around the /accounting/payments
 *  endpoints. Mutations invalidate the PAYMENTS_PREFIX so the page card grid
 *  refreshes without a manual refetch. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deletePayment, listPayments, savePayment } from "@/api/accounting";
import { QUERY_KEYS } from "@/types";
import type { PaymentEntry, PaymentEntryIn } from "@/types";


/** Payment entries for `month` (YYYY-MM). Omit `month` to load all entries. */
export function usePayments(month?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.PAYMENTS(month),
    queryFn:  () => listPayments(month),
    staleTime: 30_000,
  });
}


export function useSavePayment() {
  const qc = useQueryClient();
  return useMutation<PaymentEntry, Error, PaymentEntryIn>({
    mutationFn: savePayment,
    onSuccess:  () => { void qc.invalidateQueries({ queryKey: QUERY_KEYS.PAYMENTS_PREFIX }); },
  });
}


export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation<{ deleted: true }, Error, number>({
    mutationFn: deletePayment,
    onSuccess:  () => { void qc.invalidateQueries({ queryKey: QUERY_KEYS.PAYMENTS_PREFIX }); },
  });
}
