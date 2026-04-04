import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as accountingApi from "@/api/accounting";
import type { PaymentEntryCreate } from "@/api/accounting";

const PAYMENTS_KEY = ["payments"] as const;

export function usePayments(month?: string) {
  const { data: payments = [], isLoading } = useQuery({
    queryKey: [...PAYMENTS_KEY, month],
    queryFn: () => accountingApi.listPayments(month),
  });
  return { payments, isLoading };
}

export function useSavePayment() {
  const queryClient = useQueryClient();
  const { mutate: savePayment, isPending: saving } = useMutation({
    mutationFn: (body: PaymentEntryCreate) => accountingApi.savePayment(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENTS_KEY });
      toast.success("Paiement enregistré");
    },
    onError: (err) => toast.error(err.message),
  });
  return { savePayment, saving };
}

export function useDeletePayment() {
  const queryClient = useQueryClient();
  const { mutate: deletePayment, isPending: deleting } = useMutation({
    mutationFn: (id: number) => accountingApi.deletePayment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENTS_KEY });
      toast.success("Entrée supprimée");
    },
    onError: (err) => toast.error(err.message),
  });
  return { deletePayment, deleting };
}
