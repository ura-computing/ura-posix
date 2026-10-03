/** Pharmacies + members, admin and owner pages (mirrors backend/app/identity/members/schemas.py). */

// ── Admin · permission management (/admin/pharmacies) ───────────────────────

export type MemberRole = "owner" | "employee";
export type MemberStatus = "active" | "inactive";

/** Subset of UserPermission rows + denormalized member info, returned in
 *  PharmacyDetail.members and on user-mutation responses. */
export interface MemberOut {
  id: number;
  full_name: string | null;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  granted_permissions: string[];
}

export interface PharmacyListRow {
  id: number;
  name: string;
  code: string | null;
  city: string | null;
  members_count: number;
  member_initials: string[];
  enabled_features: string[];
  archived_at: string | null;
}

export interface PharmacyDetail {
  id: number;
  name: string;
  code: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  archived_at: string | null;
  enabled_features: string[];
  members: MemberOut[];
  /** Union of active owners' enabled permissions. Used as the second
   *  ceiling in the admin's permission dialog when editing an employee. */
  owners_union_permissions: string[];
}

/** GET /admin/users — every account (« Utilisateurs » tab). `role` / `status`
 *  are the raw stored strings: legacy rows may hold other values. */
export interface AdminUserRow {
  id: number;
  full_name: string | null;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  pharmacy: { id: number; name: string; code: string | null; archived_at: string | null } | null;
  last_login_at: string | null;
  granted_permissions: string[];
}

export interface PharmacyIn {
  name: string;
  code?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

/** `password` is typed by the admin / owner (min 8 chars — same rule as the
 *  backend's CreateUserIn). */
export interface CreateUserIn {
  full_name?: string | null;
  email: string;
  password: string;
  role: MemberRole;
  pharmacy_id: number;
}

export interface CreateUserOut {
  member: MemberOut;
}

export interface ResetPasswordOut {
  user_id: number;
}

/** Owner-side /owner/employees one-shot fetch. Includes the contextual ceiling
 *  info the EmployeePermissionsDialog needs (pharmacy features + owner's own
 *  permissions) so it can render the 2-layer ceiling without a second call. */
export interface OwnerEmployeesResponse {
  employees: MemberOut[];
  pharmacy_features: string[];
  my_permissions: string[];
}
