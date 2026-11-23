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
 *    useSignupRequests() / useAcceptSignup() / useRefuseSignup() — « Demandes » tab
 *    useSupportAccounts() / useCreateSupport() — « Support » tab (reset / status / delete: the user hooks)
 *
 *  Every mutation refreshes what its `API.admin.*` entry lists (`refreshes`):
 *  the pharmacy list + every detail (member counts, features), the users tab. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/api/client";
import { useT } from "@/i18n/I18nProvider";
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
  SignupAcceptOut,
  SignupRequestRow,
  SupportAccountRow,
  SupportCreateIn,
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

export function useSupportAccounts() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.admin.support.key,
    queryFn: () => api.get<SupportAccountRow[]>(API.admin.support.url),
    staleTime: 30_000,
  });
  return {
    accounts: data ?? [],
    isLoading,
    isError,
    reload: () => void refetch(),
  };
}

export function useCreateSupport() {
  const qc = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: (body: SupportCreateIn) => api.post<SupportAccountRow>(API.admin.createSupport.url, body),
    onSuccess: () => void refresh(qc, API.admin.createSupport),
  });
  return {
    createSupport: mutateAsync,
    isCreatingSupport: isPending,
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

/** « Changer l'email Sobrus »: its Sobrus connection stops, the years « déjà importés » are forgotten. */
export function useResetSobrusEmail(id: number) {
  const qc = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: () => api.delete(API.admin.resetSobrusEmail.url(id)),
    onSuccess: () => {
      void refresh(qc, API.admin.resetSobrusEmail);
    },
  });
  return {
    resetSobrusEmail: () => mutateAsync().then(() => undefined),
    isResettingSobrus: isPending,
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

export function useResetUserPin() {
  const t = useT();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: ({ userId, pin }: { userId: number; pin: string }) =>
      api.post<ResetPasswordOut>(API.admin.resetUserPin.url(userId), { pin }),
    onSuccess: () => toast.success(t("members.pinReset")),
  });
  return {
    resetUserPin: mutateAsync,
    isResettingPin: isPending,
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

// ── « Demandes » (Créer un compte) ────────────────────────────────────────────

export function useSignupRequests() {
  const { data, isLoading } = useQuery({
    queryKey: API.admin.signupRequests.key,
    queryFn: () => api.get<SignupRequestRow[]>(API.admin.signupRequests.url),
    staleTime: 30_000,
  });
  return {
    requests: data ?? [],
    isLoading,
  };
}

/** « Accepter »: account (+ maybe a new pharmacy) created, the person gets an email. */
export function useAcceptSignup() {
  const qc = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: (id: number) => api.post<SignupAcceptOut>(API.admin.acceptSignup.url(id)),
    onSuccess: () => {
      void refresh(qc, API.admin.acceptSignup);
    },
  });
  return {
    acceptSignup: mutateAsync,
    isAccepting: isPending,
  };
}

/** « Refuser »: nothing created, the person gets an email. */
export function useRefuseSignup() {
  const qc = useQueryClient();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: (id: number) => api.post(API.admin.refuseSignup.url(id)),
    onSuccess: () => {
      void refresh(qc, API.admin.refuseSignup);
    },
  });
  return {
    refuseSignup: mutateAsync,
    isRefusing: isPending,
  };
}
