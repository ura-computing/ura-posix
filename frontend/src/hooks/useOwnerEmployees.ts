import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as ownerApi from "@/api/owner";
import type { UserAdmin } from "@/types";

const QUERY_KEY = ["owner", "employees"] as const;

// ── For PermissionToggles component ──────────────────────────────────────────

export function useEmployeePermissions() {
  const queryClient = useQueryClient();
  const { mutate, isPending: permissionsPending } = useMutation({
    mutationFn: ({ id, permissions }: { id: number; permissions: Record<string, boolean> }) =>
      ownerApi.updateEmployeePermissions(id, permissions),
    onSuccess: (updated) => {
      queryClient.setQueryData<UserAdmin[]>(QUERY_KEY, (prev) =>
        prev?.map((e) => (e.id === updated.id ? updated : e)) ?? []
      );
    },
    onError: (err) => toast.error(err.message),
  });
  return { updatePermissions: mutate, permissionsPending };
}

// ── For main page ────────────────────────────────────────────────────────────

export function useOwnerEmployees(enabled: boolean) {
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: ownerApi.listEmployees,
    enabled,
  });

  const { mutate: approveMutate, isPending: approving } = useMutation({
    mutationFn: (id: number) => ownerApi.approveEmployee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Employé approuvé");
    },
    onError: (err) => toast.error(err.message),
  });

  const { mutate: rejectMutate, isPending: rejecting } = useMutation({
    mutationFn: (id: number) => ownerApi.rejectEmployee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Demande refusée");
    },
    onError: (err) => toast.error(err.message),
  });

  const { mutate: revokeMutate, isPending: revoking } = useMutation({
    mutationFn: (id: number) => ownerApi.revokeEmployee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Accès révoqué — l'employé est en attente");
    },
    onError: (err) => toast.error(err.message),
  });

  return {
    employees,
    isLoading,
    approve: approveMutate,
    approving,
    reject: rejectMutate,
    rejecting,
    revoke: revokeMutate,
    revoking,
  };
}
