/** TanStack Query wrappers for the admin permission-management pages.
 *
 *  Hooks:
 *    (Screen 1 table data: useAdminPharmaciesList in hooks/sharedQueries.ts, shared with Rapport)
 *    useAdminPharmacy(id)          — Screen 2 detail (info + features + members)
 *    useCreatePharmacy() / useUpdatePharmacy() / useArchivePharmacy()
 *    useSetPharmacyFeatures(id)    — Section A bulk save
 *    useCreateUser()               — returns CreateUserOut for the credentials reveal
 *    useSetUserPermissions()       — Screen 3 bulk save (owners only)
 *    useResetUserPassword() / useSetUserStatus() / useDeleteUser()
 *
 *  Every mutation refreshes what its `API.admin.*` entry lists (`refreshes`):
 *  the pharmacy list + every detail (member counts, features), the users tab. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { API, refresh } from "@/api/api";

import type {
  AdminUserRow,
  CreateUserIn,
  CreateUserOut,
  MemberOut,
  MemberStatus,
  PharmacyDetail,
  PharmacyIn,
  ResetPasswordOut,
} from "@/types";

// ── Queries ──────────────────────────────────────────────────────────────────

export function useAdminUsers() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.admin.users.key,
    queryFn: () => api.get<AdminUserRow[]>(API.admin.users.url),
    staleTime: 30_000,
  });
  return {
    users: data,
    isLoading,
    isError,
    reload: () => void refetch(),
  };
}

export function useAdminPharmacy(id: number | null) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.admin.pharmacy.key(id ?? 0),
    queryFn: () => api.get<PharmacyDetail>(API.admin.pharmacy.url(id!)),
    enabled: id != null && id > 0,
    staleTime: 30_000,
  });
  return {
    pharmacy: data,
    isLoading,
    isError,
    reload: () => void refetch(),
  };
}

// ── Pharmacy mutations ──────────────────────────────────────────────────────

export function useCreatePharmacy() {
  const qc = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: (body: PharmacyIn) => api.post<PharmacyDetail>(API.admin.createPharmacy.url, body),
    onSuccess: () => {
      void refresh(qc, API.admin.createPharmacy);
    },
  });
  return {
    createPharmacy: mutateAsync,
    isCreatingPharmacy: isPending,
  };
}

export function useUpdatePharmacy(id: number) {
  const qc = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: (body: PharmacyIn) => api.patch<PharmacyDetail>(API.admin.updatePharmacy.url(id), body),
    onSuccess: () => {
      void refresh(qc, API.admin.updatePharmacy);
    },
  });
  return {
    updatePharmacy: mutateAsync,
    isUpdatingPharmacy: isPending,
  };
}

export function useArchivePharmacy(id: number) {
  const qc = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: () => api.delete(API.admin.archivePharmacy.url(id)),
    onSuccess: () => {
      void refresh(qc, API.admin.archivePharmacy);
    },
  });
  return {
    archivePharmacy: mutateAsync,
    isArchiving: isPending,
  };
}

export function useSetPharmacyFeatures(id: number) {
  const qc = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: (features: Record<string, boolean>) =>
      api.put<PharmacyDetail>(API.admin.setPharmacyFeatures.url(id), {
        features,
      }),
    onSuccess: () => {
      void refresh(qc, API.admin.setPharmacyFeatures);
    },
  });
  return {
    setPharmacyFeatures: mutateAsync,
    isSavingFeatures: isPending,
  };
}

// ── User mutations ──────────────────────────────────────────────────────────

/** The pharmacy comes from the body (the dialog's picker), not from the page. */
export function useCreateUser() {
  const qc = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: (body: CreateUserIn) => api.post<CreateUserOut>(API.admin.createUser.url(body.pharmacy_id), body),
    onSuccess: () => {
      void refresh(qc, API.admin.createUser);
    },
  });
  return {
    createUser: mutateAsync,
    isCreatingUser: isPending,
  };
}

export function useSetUserPermissions() {
  const qc = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: ({ userId, permissions }: { userId: number; permissions: Record<string, boolean> }) =>
      api.put<MemberOut>(API.admin.setUserPermissions.url(userId), {
        permissions,
      }),
    onSuccess: () => {
      void refresh(qc, API.admin.setUserPermissions);
    },
  });
  return {
    setUserPermissions: mutateAsync,
    isSavingPermissions: isPending,
  };
}

export function useResetUserPassword() {
  const { mutateAsync, isPending } = useMutation({
    mutationFn: ({ userId, password }: { userId: number; password: string }) =>
      api.post<ResetPasswordOut>(API.admin.resetUserPassword.url(userId), {
        password,
      }),
  });
  return {
    resetUserPassword: mutateAsync,
    isResetting: isPending,
  };
}

export function useSetUserStatus() {
  const qc = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: ({ userId, status }: { userId: number; status: MemberStatus }) =>
      api.patch<MemberOut>(API.admin.setUserStatus.url(userId), { status }),
    onSuccess: () => {
      void refresh(qc, API.admin.setUserStatus);
    },
  });
  return {
    setUserStatus: mutateAsync,
    isSettingStatus: isPending,
  };
}

export function useDeleteUser() {
  const qc = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: (userId: number) => api.delete(API.admin.removeUser.url(userId)),
    onSuccess: () => {
      void refresh(qc, API.admin.removeUser);
    },
  });
  return {
    deleteUser: mutateAsync,
    isDeleting: isPending,
  };
}

/** « Assigner une pharmacie » — the account moves; both pharmacies' pages change. */
export function useAssignPharmacy() {
  const qc = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: ({ userId, pharmacyId }: { userId: number; pharmacyId: number }) =>
      api.patch<AdminUserRow>(API.admin.assignPharmacy.url(userId), {
        pharmacy_id: pharmacyId,
      }),
    onSuccess: () => {
      void refresh(qc, API.admin.assignPharmacy);
    },
  });
  return {
    assignPharmacy: mutateAsync,
    isAssigning: isPending,
  };
}
