/** TanStack Query wrappers for /owner/employees (Gérer mon équipe). Each hook
 *  returns named data / actions (never the raw query or mutation); actions
 *  return a Promise so the page can await them. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { URLS } from "@/api/urls";
import { QUERIES } from "@/api/queries";

import type {
  CreateUserIn, CreateUserOut, MemberOut, MemberStatus, OwnerEmployeesResponse, ResetPasswordOut,
} from "@/types";


export function useOwnerEmployees() {
  const {
    data,
    isLoading,
  } = useQuery({
    queryKey:  QUERIES.employees.list,
    queryFn:   () => api.get<OwnerEmployeesResponse>(URLS.employees.list),
    staleTime: 30_000,
  });
  return {
    team: data,
    isLoading,
  };
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  const {
    mutateAsync,
    isPending,
  } = useMutation({
    mutationFn: (body: CreateUserIn) => api.post<CreateUserOut>(URLS.employees.list, body),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: QUERIES.employees.list }); },
  });
  return {
    createEmployee: mutateAsync,
    isCreating: isPending,
  };
}

export function useSetEmployeePermissions() {
  const qc = useQueryClient();
  const {
    mutateAsync,
    isPending,
  } = useMutation({
    mutationFn: ({ employeeId, permissions }: { employeeId: number; permissions: Record<string, boolean> }) =>
      api.put<MemberOut>(URLS.employees.permissions(employeeId), { permissions }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: QUERIES.employees.list }); },
  });
  return {
    setEmployeePermissions: mutateAsync,
    isSavingPermissions: isPending,
  };
}

export function useSetEmployeeStatus() {
  const qc = useQueryClient();
  const {
    mutateAsync,
    isPending,
  } = useMutation({
    mutationFn: ({ employeeId, status }: { employeeId: number; status: MemberStatus }) =>
      api.patch<MemberOut>(URLS.employees.status(employeeId), { status }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: QUERIES.employees.list }); },
  });
  return {
    setEmployeeStatus: mutateAsync,
    isSettingStatus: isPending,
  };
}

export function useResetEmployeePassword() {
  const {
    mutateAsync,
    isPending,
  } = useMutation({
    mutationFn: ({ employeeId, password }: { employeeId: number; password: string }) =>
      api.post<ResetPasswordOut>(URLS.employees.resetPassword(employeeId), { password }),
  });
  return {
    resetEmployeePassword: mutateAsync,
    isResetting: isPending,
  };
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  const {
    mutateAsync,
    isPending,
  } = useMutation({
    mutationFn: (employeeId: number) => api.delete(URLS.employees.one(employeeId)),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: QUERIES.employees.list }); },
  });
  return {
    deleteEmployee: mutateAsync,
    isDeleting: isPending,
  };
}
