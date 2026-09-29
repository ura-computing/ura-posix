/** API client for the admin permission-management pages. Mirrors the
 *  /v1/admin/pharmacies + /v1/admin/users endpoints in
 *  backend/routers/admin_pharmacies.py. */
import { api } from "@/api/client";
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


// ── Pharmacies ───────────────────────────────────────────────────────────────

export function listAdminPharmacies(includeArchived = false): Promise<PharmacyListRow[]> {
  const qs = includeArchived ? "?include_archived=true" : "";
  return api(`/admin/pharmacies${qs}`);
}

export function getAdminPharmacy(id: number): Promise<PharmacyDetail> {
  return api(`/admin/pharmacies/${id}`);
}

export function createAdminPharmacy(body: PharmacyIn): Promise<PharmacyDetail> {
  return api(`/admin/pharmacies`, { method: "POST", body });
}

export function updateAdminPharmacy(id: number, body: PharmacyIn): Promise<PharmacyDetail> {
  return api(`/admin/pharmacies/${id}`, { method: "PATCH", body });
}

export function archiveAdminPharmacy(id: number): Promise<{ archived: boolean }> {
  return api(`/admin/pharmacies/${id}`, { method: "DELETE" });
}

/** Bulk-set the 9 PharmacyFeature toggles in one request (matches the batched-
 *  save UX in Section A's dirty action bar). */
export function setPharmacyFeatures(
  id: number,
  features: Record<string, boolean>,
): Promise<PharmacyDetail> {
  return api(`/admin/pharmacies/${id}/features`, { method: "PUT", body: { features } });
}


// ── Members ──────────────────────────────────────────────────────────────────

export function createUser(
  pharmacyId: number,
  body: CreateUserIn,
): Promise<CreateUserOut> {
  return api(`/admin/pharmacies/${pharmacyId}/users`, { method: "POST", body });
}

/** Bulk-set the 9 UserPermission toggles for ONE user. Backend rejects
 *  employees (owner-managed per 3-layer model). */
export function setUserPermissions(
  userId: number,
  permissions: Record<string, boolean>,
): Promise<MemberOut> {
  return api(`/admin/users/${userId}/permissions`, { method: "PUT", body: { permissions } });
}

export function resetUserPassword(userId: number, password: string): Promise<ResetPasswordOut> {
  return api(`/admin/users/${userId}/reset-password`, { method: "POST", body: { password } });
}

export function setUserStatus(userId: number, status: MemberStatus): Promise<MemberOut> {
  return api(`/admin/users/${userId}/status`, { method: "PATCH", body: { status } });
}

export function deleteUser(userId: number): Promise<{ deleted: boolean }> {
  return api(`/admin/users/${userId}`, { method: "DELETE" });
}


// ── Every account (« Utilisateurs » tab) ─────────────────────────────────────

export function listAdminUsers(): Promise<AdminUserRow[]> {
  return api(`/admin/users`);
}

/** Attach an owner / employee to an active pharmacy. */
export function assignUserPharmacy(userId: number, pharmacyId: number): Promise<AdminUserRow> {
  return api(`/admin/users/${userId}/pharmacy`, { method: "PATCH", body: { pharmacy_id: pharmacyId } });
}
