import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as adminApi from "@/api/admin";

const QUERY_KEY = ["admin", "catalog-requests"] as const;

export function useAdminCatalogRequestsList(statusFilter?: string, requestType?: string) {
  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: [...QUERY_KEY, statusFilter, requestType],
    queryFn: () => adminApi.listCatalogRequests(
      statusFilter === "all" ? undefined : statusFilter,
      requestType,
    ),
  });
  return { requests, requestsLoading };
}

export function useApproveCatalogRequest() {
  const queryClient = useQueryClient();
  const { mutate: approveMutate, isPending: approving } = useMutation({
    mutationFn: (id: number) => adminApi.approveCatalogRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Produit marqué comme non déclaré");
    },
    onError: (err) => toast.error(err.message),
  });
  return { approve: approveMutate, approving };
}

export function useRejectCatalogRequest() {
  const queryClient = useQueryClient();
  const { mutate: rejectMutate, isPending: rejecting } = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      adminApi.rejectCatalogRequest(id, reason || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Demande rejetée");
    },
    onError: (err) => toast.error(err.message),
  });
  return { reject: rejectMutate, rejecting };
}
