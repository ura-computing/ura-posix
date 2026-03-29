import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as catalogRequestsApi from "@/api/catalogRequests";

const REQUESTS_KEY = ["catalog-requests", "owner"] as const;
const PRODUCTS_KEY = ["my-products"] as const;

export function useCatalogRequestsList(enabled: boolean) {
  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: REQUESTS_KEY,
    queryFn: () => catalogRequestsApi.list(),
    enabled,
    select: (data) => data.filter((r) => r.request_type === "non_declare"),
  });

  return { requests, requestsLoading };
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
      const count = selectedIds.size;
      toast.success(
        count === 1
          ? "Demande envoyée à l'administrateur"
          : `${count} demandes envoyées à l'administrateur`
      );
      resetDialog();
    },
    onError: (err) => toast.error(err.message),
  });

  return { submitRequests, submitting };
}
