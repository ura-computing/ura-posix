/** TanStack Query wrappers for /owner/employees (Gérer mon équipe). Each hook
 *  returns named data / actions (never the raw query or mutation); actions
 *  return a Promise so the page can await them. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { API, refresh } from "@/api/api";

import type {
  CreateUserIn,
  CreateUserOut,
  MemberOut,
  MemberStatus,
  OwnerEmployeesResponse,
  ResetPasswordOut,
} from "@/types";

export function useOwnerEmployees() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.employees.list.key,
    queryFn: () => api.get<OwnerEmployeesResponse>(API.employees.list.url),
    staleTime: 30_000,
  });
  return {
    team: data,
    isLoading,
    isError,
    reload: () => void refetch(),
  };
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: (body: CreateUserIn) => api.post<CreateUserOut>(API.employees.create.url, body),
    onSuccess: () => {
      void refresh(qc, API.employees.create);
    },
  });
  return {
    createEmployee: mutateAsync,
    isCreating: isPending,
  };
}

export function useSetEmployeePermissions() {
  const qc = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: ({ employeeId, permissions }: { employeeId: number; permissions: Record<string, boolean> }) =>
      api.put<MemberOut>(API.employees.setPermissions.url(employeeId), { permissions }),
    onSuccess: () => {
      void refresh(qc, API.employees.setPermissions);
    },
  });
  return {
    setEmployeePermissions: mutateAsync,
    isSavingPermissions: isPending,
  };
}

export function useSetEmployeeStatus() {
  const qc = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: ({ employeeId, status }: { employeeId: number; status: MemberStatus }) =>
      api.patch<MemberOut>(API.employees.setStatus.url(employeeId), { status }),
    onSuccess: () => {
      void refresh(qc, API.employees.setStatus);
    },
  });
  return {
    setEmployeeStatus: mutateAsync,
    isSettingStatus: isPending,
  };
}

export function useResetEmployeePassword() {
  const { mutateAsync, isPending } = useMutation({
    mutationFn: ({ employeeId, password }: { employeeId: number; password: string }) =>
      api.post<ResetPasswordOut>(API.employees.resetPassword.url(employeeId), { password }),
  });
  return {
    resetEmployeePassword: mutateAsync,
    isResetting: isPending,
  };
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: (employeeId: number) => api.delete(API.employees.remove.url(employeeId)),
    onSuccess: () => {
      void refresh(qc, API.employees.remove);
    },
  });
  return {
    deleteEmployee: mutateAsync,
    isDeleting: isPending,
  };
}
