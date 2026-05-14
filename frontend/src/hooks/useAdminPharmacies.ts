import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as adminApi from "@/api/admin";
import { QUERY_KEYS } from "@/constants";
import type { UserAdmin, UserRole } from "@/types";
import type { NonDeclaredProduct } from "@/api/admin";

// ── PharmacyFormDialog ───────────────────────────────────────────────────────

export function usePharmacyFormMutation(onSuccess: () => void) {
  const queryClient = useQueryClient();

  const { mutate: savePharmacy, isPending: savingPharmacy } = useMutation({
    mutationFn: ({
      isEdit,
      pharmacyId,
      data,
    }: {
      isEdit: boolean;
      pharmacyId?: number;
      data: { name: string; address?: string; phone?: string; email?: string };
    }) =>
      isEdit
        ? adminApi.updatePharmacy(pharmacyId!, data)
        : adminApi.createPharmacy(data),
    onSuccess: (_, { isEdit }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pharmacies });
      toast.success(isEdit ? "Pharmacie mise à jour" : "Pharmacie créée");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  return { savePharmacy, savingPharmacy };
}

// ── UsersPanel (users for a specific pharmacy) ──────────────────────────────

export function usePharmacyUsersList(pharmacyId: number) {
  const queryClient = useQueryClient();
  const panelQueryKey = [...QUERY_KEYS.adminUsers, pharmacyId];

  const { data: users = [], isLoading } = useQuery({
    queryKey: panelQueryKey,
    queryFn: () => adminApi.listUsers(pharmacyId),
  });

  const { mutate: updateRole } = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: UserRole }) =>
      adminApi.updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: panelQueryKey });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pharmacies });
      toast.success("Rôle mis à jour");
    },
    onError: (err) => toast.error(err.message),
  });

  const { mutate: updatePharmacy } = useMutation({
    mutationFn: ({
      userId,
      pharmacyId,
    }: {
      userId: number;
      pharmacyId: number | null;
    }) => adminApi.updateUserPharmacy(userId, pharmacyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: panelQueryKey });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pharmacies });
      toast.success("Pharmacie mise à jour");
    },
    onError: (err) => toast.error(err.message),
  });

  const { mutate: updatePermissions, isPending: updatingPerms } = useMutation({
    mutationFn: ({
      userId,
      permissions,
    }: {
      userId: number;
      permissions: Record<string, boolean>;
    }) => adminApi.updateUserPermissions(userId, permissions),
    onSuccess: (updated) => {
      queryClient.setQueryData<UserAdmin[]>(panelQueryKey, (prev) =>
        prev?.map((u) => (u.id === updated.id ? updated : u)) ?? []
      );
    },
    onError: (err) => toast.error(err.message),
  });

  return { users, isLoading, updateRole, updatePharmacy, updatePermissions, updatingPerms };
}

// ── Invite a member ─────────────────────────────────────────────────────────

export function useAdminInviteUser(pharmacyId: number, onDone?: () => void) {
  const queryClient = useQueryClient();
  const panelQueryKey = [...QUERY_KEYS.adminUsers, pharmacyId];
  const { mutate, isPending } = useMutation({
    mutationFn: (payload: adminApi.InviteUserPayload) => adminApi.inviteUser(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: panelQueryKey });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminUsers });
      toast.success("Invitation envoyée par email");
      onDone?.();
    },
    onError: (err) => toast.error(err.message),
  });
  return { invite: mutate, inviting: isPending };
}

// ── Resend password reset link ──────────────────────────────────────────────

export function useAdminResendReset() {
  const { mutate, isPending } = useMutation({
    mutationFn: (userId: number) => adminApi.resendReset(userId),
    onSuccess: (user) => toast.success(`Lien envoyé à ${user.email}`),
    onError: (err) => toast.error(err.message),
  });
  return { resendReset: mutate, resending: isPending };
}

// ── PharmacyList (main page) ────────────────────────────────────────────────

export function usePharmacyList() {
  const queryClient = useQueryClient();

  const { data: pharmacies = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.pharmacies,
    queryFn: adminApi.listPharmacies,
  });

  const { mutate: deletePharmacy, isPending: deleting } = useMutation({
    mutationFn: (id: number) => adminApi.deletePharmacy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pharmacies });
      toast.success("Pharmacie supprimée");
    },
    onError: (err) => toast.error(err.message),
  });

  return { pharmacies, isLoading, deletePharmacy, deleting };
}

// ── PendingOwnersSection ────────────────────────────────────────────────────

const PENDING_OWNERS_KEY = ["pendingOwners"] as const;

export function usePendingOwners() {
  const queryClient = useQueryClient();

  const { data: pendingOwners = [], isLoading } = useQuery({
    queryKey: PENDING_OWNERS_KEY,
    queryFn: adminApi.listPendingOwners,
  });

  const { mutate: approve, isPending: approving } = useMutation({
    mutationFn: (userId: number) => adminApi.approveUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PENDING_OWNERS_KEY });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pharmacies });
      toast.success("Propriétaire approuvé — pharmacie créée");
    },
    onError: (err) => toast.error(err.message),
  });

  const { mutate: reject, isPending: rejecting } = useMutation({
    mutationFn: (userId: number) => adminApi.rejectUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PENDING_OWNERS_KEY });
      toast.success("Demande refusée");
    },
    onError: (err) => toast.error(err.message),
  });

  return { pendingOwners, isLoading, approve, approving, reject, rejecting };
}

// ── AllUsersSection ─────────────────────────────────────────────────────────

export function useAllUsers() {
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.adminUsers,
    queryFn: () => adminApi.listUsers(),
  });

  const { mutate: updateRole } = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: UserRole }) =>
      adminApi.updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminUsers });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pharmacies });
      toast.success("Rôle mis à jour");
    },
    onError: (err) => toast.error(err.message),
  });

  const { mutate: updatePharmacy } = useMutation({
    mutationFn: ({
      userId,
      pharmacyId,
    }: {
      userId: number;
      pharmacyId: number | null;
    }) => adminApi.updateUserPharmacy(userId, pharmacyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminUsers });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pharmacies });
      toast.success("Pharmacie mise à jour");
    },
    onError: (err) => toast.error(err.message),
  });

  const { mutate: revoke, isPending: revoking } = useMutation({
    mutationFn: (userId: number) => adminApi.revokeUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminUsers });
      queryClient.invalidateQueries({ queryKey: PENDING_OWNERS_KEY });
      toast.success("Accès retiré — compte repassé en attente");
    },
    onError: (err) => toast.error(err.message),
  });

  return { users, isLoading, updateRole, updatePharmacy, revoke, revoking };
}

// ── Non-declared products ──────────────────────────────────────────────────

export function useNonDeclaredProducts(pharmacyId: number) {
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-non-declared", pharmacyId],
    queryFn: () => adminApi.listNonDeclaredProducts(pharmacyId),
  });
  return { products, isLoading };
}

// ── Pharmacy options ───────────────────────────────────────────────────────

export function usePharmacyOptions(pharmacyId: number) {
  const queryClient = useQueryClient();

  const { data: options = {}, isLoading } = useQuery({
    queryKey: ["admin-pharmacy-options", pharmacyId],
    queryFn: () => adminApi.getPharmacyOptions(pharmacyId),
  });

  const { mutate: updateOptions, isPending: updatingOptions } = useMutation({
    mutationFn: (opts: Record<string, boolean>) =>
      adminApi.updatePharmacyOptions(pharmacyId, opts),
    onSuccess: (data) => {
      queryClient.setQueryData(["admin-pharmacy-options", pharmacyId], data);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pharmacies });
      toast.success("Options mises à jour");
    },
    onError: (err) => toast.error(err.message),
  });

  return { options, isLoading, updateOptions, updatingOptions };
}
