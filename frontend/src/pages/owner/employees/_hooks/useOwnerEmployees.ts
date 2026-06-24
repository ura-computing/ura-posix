/** TanStack Query wrappers for /owner/employees (Gérer mon équipe).
 *  Mirrors the admin's useAdminPharmacies pattern. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createEmployee,
  deleteEmployee,
  listOwnerEmployees,
  resetEmployeePassword,
  setEmployeePermissions,
  setEmployeeStatus,
} from "@/api/ownerEmployees";
import type { CreateUserIn, MemberStatus } from "@/types";


const KEYS = {
  list: ["owner-employees"] as const,
};


export function useOwnerEmployees() {
  return useQuery({
    queryKey:  KEYS.list,
    queryFn:   listOwnerEmployees,
    staleTime: 30_000,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUserIn) => createEmployee(body),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: KEYS.list }); },
  });
}

export function useSetEmployeePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, permissions }: { employeeId: number; permissions: Record<string, boolean> }) =>
      setEmployeePermissions(employeeId, permissions),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: KEYS.list }); },
  });
}

export function useSetEmployeeStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, status }: { employeeId: number; status: MemberStatus }) =>
      setEmployeeStatus(employeeId, status),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: KEYS.list }); },
  });
}

export function useResetEmployeePassword() {
  return useMutation({ mutationFn: (employeeId: number) => resetEmployeePassword(employeeId) });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (employeeId: number) => deleteEmployee(employeeId),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: KEYS.list }); },
  });
}
