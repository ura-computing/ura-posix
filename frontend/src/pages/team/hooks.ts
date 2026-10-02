/** TanStack Query wrappers for /owner/employees (Gérer mon équipe).
 *  Mirrors the admin's useAdminPharmacies pattern. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { URLS } from "@/api/urls";
import { QUERY_KEYS } from "@/types";
import type {
  CreateUserIn, CreateUserOut, MemberOut, MemberStatus, OwnerEmployeesResponse, ResetPasswordOut,
} from "@/types";




export function useOwnerEmployees() {
  return useQuery({
    queryKey:  QUERY_KEYS.OWNER_EMPLOYEES,
    queryFn:   () => api.get<OwnerEmployeesResponse>(URLS.employees.list),
    staleTime: 30_000,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUserIn) => api.post<CreateUserOut>(URLS.employees.list, body),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: QUERY_KEYS.OWNER_EMPLOYEES }); },
  });
}

export function useSetEmployeePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, permissions }: { employeeId: number; permissions: Record<string, boolean> }) =>
      api.put<MemberOut>(URLS.employees.permissions(employeeId), { permissions }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: QUERY_KEYS.OWNER_EMPLOYEES }); },
  });
}

export function useSetEmployeeStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, status }: { employeeId: number; status: MemberStatus }) =>
      api.patch<MemberOut>(URLS.employees.status(employeeId), { status }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: QUERY_KEYS.OWNER_EMPLOYEES }); },
  });
}

export function useResetEmployeePassword() {
  return useMutation({
    mutationFn: ({ employeeId, password }: { employeeId: number; password: string }) =>
      api.post<ResetPasswordOut>(URLS.employees.resetPassword(employeeId), { password }),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (employeeId: number) => api.delete(URLS.employees.one(employeeId)),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: QUERY_KEYS.OWNER_EMPLOYEES }); },
  });
}
