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

/** Who a create / reset dialog talks about: a pharmacy member or a Support person. */
export type AccountRole = MemberRole | "support";
export interface AccountRef {
  id: number;
  full_name: string | null;
  email: string;
  role: AccountRole;
}

/** GET /admin/support — one Support person (« Support » tab). `open_requests` = online-store requests they took. */
export interface SupportAccountRow {
  id: number;
  full_name: string | null;
  email: string;
  status: MemberStatus;
  open_requests: number;
  last_login_at: string | null;
}

export interface SupportCreateIn {
  full_name: string;
  email: string;
  password: string;
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
  /** Its Sobrus account, set once by the first connection; only the admin changes it. */
  sobrus_email: string | null;
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

/** One pending « Créer un compte » (admin « Demandes » tab, mirrors SignupRequestRow).
 *  `pharmacy_code` set = join; else `new_pharmacy_*` = a new pharmacy. */
export interface SignupRequestRow {
  id: number;
  created_at: string;
  role: MemberRole;
  full_name: string;
  email: string;
  phone: string;
  pharmacy_code: string | null;
  pharmacy: { id: number; name: string; code: string; city: string | null } | null;
  new_pharmacy_name: string | null;
  new_pharmacy_city: string | null;
  new_pharmacy_address: string | null;
  email_taken: boolean;
  code_unknown: boolean;
}

export interface SignupAcceptOut {
  user_id: number;
  pharmacy_id: number;
  pharmacy_code: string;
}
