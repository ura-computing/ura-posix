import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as catalogRequestsApi from "@/api/catalogRequests";
import { eRequestStatus, eRequestType } from "@/types";

const REQUESTS_KEY = ["catalog-requests", "owner"] as const;
const PRODUCTS_KEY = ["my-products"] as const;

export function useCatalogRequestsList(enabled: boolean) {
  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: REQUESTS_KEY,
    queryFn: () => catalogRequestsApi.list(),
    enabled,
    select: (data) => {
      // Collect medicament IDs where annulation was approved (exclusion reversed)
      const reversedMedIds = new Set(
        data
          .filter((r) => r.request_type === eRequestType.ANNULATION && r.status === eRequestStatus.APPROVED && r.medicament_id)
          .map((r) => r.medicament_id!)
      );
      return data.filter((r) => {
        if (r.request_type === eRequestType.ANNULATION) return r.status === eRequestStatus.PENDING || r.status === eRequestStatus.REJECTED;
        if (r.request_type === eRequestType.NON_DECLARE) {
          // Hide approved exclusions that were later reversed
          if (r.status === eRequestStatus.APPROVED && r.medicament_id && reversedMedIds.has(r.medicament_id)) return false;
          return true;
        }
        return false;
      });
    },
  });

  return { requests, requestsLoading };
}

export function useSubmitAnnulation() {
  const queryClient = useQueryClient();

  const { mutate: submitAnnulation, isPending: submittingAnnulation } = useMutation({
    mutationFn: (params: { medicament_id: number; notes?: string }) =>
      catalogRequestsApi.submitAnnulation(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REQUESTS_KEY });
      queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
      toast.success("Produit réintégré dans vos rapports");
    },
    onError: (err) => toast.error(err.message),
  });

  return { submitAnnulation, submittingAnnulation };
}

export function useMyProducts(debouncedSearch: string, dialogOpen: boolean) {
  const hasSearch = debouncedSearch.trim().length > 0;

  const { data: products = [], isFetching: productsLoading } = useQuery({
    queryKey: [...PRODUCTS_KEY, debouncedSearch],
    queryFn: () => catalogRequestsApi.myProducts(debouncedSearch),
    enabled: dialogOpen && hasSearch,
    select: (data) => data.filter((p) => p.declared),
  });

  return { products, productsLoading };
}

export function useSubmitNonDeclareRequests(
  selectedIds: Set<number>,
  resetDialog: () => void,
) {
  const queryClient = useQueryClient();

  const { mutate: submitRequests, isPending: submitting } = useMutation({
    mutationFn: async (notes: string) => {
      const ids = Array.from(selectedIds);
      await Promise.all(
        ids.map((id) =>
          catalogRequestsApi.submitNonDeclare({
            medicament_id: id,
            notes: notes.trim() || undefined,
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REQUESTS_KEY });
      queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY });
      const count = selectedIds.size;
      toast.success(
        count === 1
          ? "Produit marqué comme spécial"
          : `${count} produits marqués comme spéciaux`
      );
      resetDialog();
    },
    onError: (err) => toast.error(err.message),
  });

  return { submitRequests, submitting };
}
