/** TanStack Query wrappers for the admin permission-management pages.
 *
 *  Hooks:
 *    useAdminPharmaciesList()      — Screen 1 table data
 *    useAdminPharmacy(id)          — Screen 2 detail (info + features + members)
 *    useCreatePharmacy() / useUpdatePharmacy() / useArchivePharmacy()
 *    useSetPharmacyFeatures(id)    — Section A bulk save
 *    useCreateUser()               — returns CreateUserOut for the credentials reveal
 *    useSetUserPermissions(userId) — Screen 3 bulk save (owners only)
 *    useResetUserPassword() / useSetUserStatus() / useDeleteUser()
 *
 *  Every mutation invalidates the right keys: pharmacy mutations invalidate
 *  both the list AND the detail (member counts + features change). User
 *  mutations invalidate the detail of THEIR pharmacy (membership/permissions
 *  shifted). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { URLS } from "@/api/urls";
import { QUERIES } from "@/api/queries";

import type {
  AdminUserRow,
  CreateUserIn,
  CreateUserOut,
  MemberOut,
  MemberStatus,
  PharmacyDetail,
  PharmacyIn,
  PharmacyListRow,
  ResetPasswordOut,
} from "@/types";


// ── Queries ──────────────────────────────────────────────────────────────────

export function useAdminUsers() {
  return useQuery({
    queryKey:  QUERIES.admin.users,
    queryFn:   () => api.get<AdminUserRow[]>(URLS.admin.users),
    staleTime: 30_000,
  });
}

export function useAdminPharmaciesList() {
  return useQuery({
    queryKey:  QUERIES.admin.pharmacies,
    queryFn:   () => api.get<PharmacyListRow[]>(URLS.admin.pharmacies),
    staleTime: 30_000,
  });
}

export function useAdminPharmacy(id: number | null) {
  return useQuery({
    queryKey:  QUERIES.admin.pharmacy(id ?? 0),
    queryFn:   () => api.get<PharmacyDetail>(URLS.admin.pharmacy.one(id!)),
    enabled:   id != null && id > 0,
    staleTime: 30_000,
  });
}


// ── Pharmacy mutations ──────────────────────────────────────────────────────

export function useCreatePharmacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PharmacyIn) => api.post<PharmacyDetail>(URLS.admin.pharmacies, body),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: QUERIES.admin.pharmacies }); },
  });
}

export function useUpdatePharmacy(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PharmacyIn) => api.patch<PharmacyDetail>(URLS.admin.pharmacy.one(id), body),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: QUERIES.admin.pharmacies });
      qc.invalidateQueries({ queryKey: QUERIES.admin.pharmacy(id) });
    },
  });
}

export function useArchivePharmacy(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(URLS.admin.pharmacy.one(id)),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: QUERIES.admin.pharmacies });
      qc.invalidateQueries({ queryKey: QUERIES.admin.pharmacy(id) });
      qc.invalidateQueries({ queryKey: QUERIES.admin.users });
    },
  });
}

export function useSetPharmacyFeatures(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (features: Record<string, boolean>) =>
      api.put<PharmacyDetail>(URLS.admin.pharmacy.features(id), { features }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: QUERIES.admin.pharmacies });
      qc.invalidateQueries({ queryKey: QUERIES.admin.pharmacy(id) });
    },
  });
}


// ── User mutations ──────────────────────────────────────────────────────────

/** The pharmacy comes from the body (the dialog's picker), not from the page. */
export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUserIn) => api.post<CreateUserOut>(URLS.admin.pharmacy.users(body.pharmacy_id), body),
    onSuccess:  (_out, body) => {
      qc.invalidateQueries({ queryKey: QUERIES.admin.pharmacies });
      qc.invalidateQueries({ queryKey: QUERIES.admin.pharmacy(body.pharmacy_id) });
      qc.invalidateQueries({ queryKey: QUERIES.admin.users });
    },
  });
}

export function useSetUserPermissions(pharmacyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, permissions }: { userId: number; permissions: Record<string, boolean> }) =>
      api.put<MemberOut>(URLS.admin.user.permissions(userId), { permissions }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: QUERIES.admin.pharmacy(pharmacyId) });
      qc.invalidateQueries({ queryKey: QUERIES.admin.users });
    },
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ userId, password }: { userId: number; password: string }) =>
      api.post<ResetPasswordOut>(URLS.admin.user.resetPassword(userId), { password }),
  });
}

export function useSetUserStatus(pharmacyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status }: { userId: number; status: MemberStatus }) =>
      api.patch<MemberOut>(URLS.admin.user.status(userId), { status }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: QUERIES.admin.pharmacy(pharmacyId) });
      qc.invalidateQueries({ queryKey: QUERIES.admin.users });
    },
  });
}

export function useDeleteUser(pharmacyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => api.delete(URLS.admin.user.one(userId)),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: QUERIES.admin.pharmacies });
      qc.invalidateQueries({ queryKey: QUERIES.admin.pharmacy(pharmacyId) });
      qc.invalidateQueries({ queryKey: QUERIES.admin.users });
    },
  });
}

/** « Assigner une pharmacie » — the account moves; both pharmacies' pages change. */
export function useAssignPharmacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, pharmacyId }: { userId: number; pharmacyId: number }) =>
      api.patch<AdminUserRow>(URLS.admin.user.pharmacy(userId), { pharmacy_id: pharmacyId }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: QUERIES.admin.pharmacies });      // prefix: every pharmacy detail too
      qc.invalidateQueries({ queryKey: QUERIES.admin.users });
    },
  });
}
