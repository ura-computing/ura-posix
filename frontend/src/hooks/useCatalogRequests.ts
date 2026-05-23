import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as catalogRequestsApi from "@/api/catalogRequests";

const SPECIAL_KEY = ["owner", "special-products"] as const;
const PRODUCTS_KEY = ["my-products"] as const;

export function useOwnerSpecialProducts(enabled: boolean) {
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: SPECIAL_KEY,
    queryFn: () => catalogRequestsApi.myExclusions(),
    enabled,
  });

  return { products, productsLoading };
}

export function useSubmitAnnulation() {
  const queryClient = useQueryClient();

  const { mutate: submitAnnulation, isPending: submittingAnnulation } = useMutation({
    mutationFn: (params: { medicament_id: number; notes?: string }) =>
      catalogRequestsApi.submitAnnulation(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SPECIAL_KEY });
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
      queryClient.invalidateQueries({ queryKey: SPECIAL_KEY });
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
