/** TanStack Query wrappers for the admin permission-management pages.
 *
 *  Hooks:
 *    useAdminPharmaciesList()      — Screen 1 table data
 *    useAdminPharmacy(id)          — Screen 2 detail (info + features + members)
 *    useCreatePharmacy() / useUpdatePharmacy() / useArchivePharmacy()
 *    useSetPharmacyFeatures(id)    — Section A bulk save
 *    useCreateUser(pharmacyId)     — returns CreateUserOut for the credentials reveal
 *    useSetUserPermissions(userId) — Screen 3 bulk save (owners only)
 *    useResetUserPassword() / useSetUserStatus() / useDeleteUser()
 *
 *  Every mutation invalidates the right keys: pharmacy mutations invalidate
 *  both the list AND the detail (member counts + features change). User
 *  mutations invalidate the detail of THEIR pharmacy (membership/permissions
 *  shifted). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  archiveAdminPharmacy,
  createAdminPharmacy,
  createUser,
  deleteUser,
  getAdminPharmacy,
  listAdminPharmacies,
  resetUserPassword,
  setPharmacyFeatures,
  setUserPermissions,
  setUserStatus,
  updateAdminPharmacy,
} from "@/api/adminPharmacies";
import type {
  CreateUserIn,
  MemberStatus,
  PharmacyIn,
} from "@/types";


const KEYS = {
  list:   ["admin-pharmacies"] as const,
  detail: (id: number) => ["admin-pharmacies", id] as const,
};


// ── Queries ──────────────────────────────────────────────────────────────────

export function useAdminPharmaciesList() {
  return useQuery({
    queryKey:  KEYS.list,
    queryFn:   () => listAdminPharmacies(false),
    staleTime: 30_000,
  });
}

export function useAdminPharmacy(id: number | null) {
  return useQuery({
    queryKey:  KEYS.detail(id ?? 0),
    queryFn:   () => getAdminPharmacy(id!),
    enabled:   id != null && id > 0,
    staleTime: 30_000,
  });
}


// ── Pharmacy mutations ──────────────────────────────────────────────────────

export function useCreatePharmacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PharmacyIn) => createAdminPharmacy(body),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: KEYS.list }); },
  });
}

export function useUpdatePharmacy(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PharmacyIn) => updateAdminPharmacy(id, body),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
    },
  });
}

export function useArchivePharmacy(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => archiveAdminPharmacy(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
    },
  });
}

export function useSetPharmacyFeatures(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (features: Record<string, boolean>) => setPharmacyFeatures(id, features),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
    },
  });
}


// ── User mutations ──────────────────────────────────────────────────────────

export function useCreateUser(pharmacyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUserIn) => createUser(pharmacyId, body),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.invalidateQueries({ queryKey: KEYS.detail(pharmacyId) });
    },
  });
}

export function useSetUserPermissions(pharmacyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, permissions }: { userId: number; permissions: Record<string, boolean> }) =>
      setUserPermissions(userId, permissions),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: KEYS.detail(pharmacyId) }); },
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ userId, password }: { userId: number; password: string }) =>
      resetUserPassword(userId, password),
  });
}

export function useSetUserStatus(pharmacyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: number; status: MemberStatus }) =>
      setUserStatus(userId, status),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: KEYS.detail(pharmacyId) }); },
  });
}

export function useDeleteUser(pharmacyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => deleteUser(userId),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: KEYS.list });
      qc.invalidateQueries({ queryKey: KEYS.detail(pharmacyId) });
    },
  });
}
