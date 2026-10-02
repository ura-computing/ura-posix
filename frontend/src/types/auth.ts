/** Login, account, sessions (mirrors backend/schemas/auth.py). */

import type { Feature, Role, Status } from "./index";

// ── Domain objects ─────────────────────────────────────────────────────────

export interface User {
  id:            number;
  email:         string;
  name:          string | null;
  phone:         string | null;
  role:          Role;
  status:        Status;
  pharmacy_id:   number | null;
  last_login_at: string | null;
}

export interface Pharmacy {
  id:   number;
  name: string;
  code: string | null;
}

/** Backend response shape from GET /v1/auth/me. */
export interface MeResponse {
  user:        User;
  pharmacy:    Pharmacy | null;
  permissions: Feature[];
}

/**
 * Flat shape exposed by useMe() to pages and components. Derived from
 * MeResponse by collapsing user.* one level so pages can do me.name / me.role
 * directly without the .user indirection.
 */
export interface Me {
  id:          string;          // stringified user.id for stable cache keys
  email:       string;
  name:        string;          // never null in the flat shape (falls back to email)
  phone?:      string;
  role:        Role;
  status:      Status;
  pharmacy?:   { id: number; name: string; code: string | null };
  permissions: Feature[];
}

export interface Session {
  id:             string;
  device_label:   string;
  ip:             string;
  last_active_at: string;       // ISO timestamp
  is_current:     boolean;
}

// ── Request/response shapes for the API layer ──────────────────────────────

export interface LoginRequest {
  email:    string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ValidateTokenResponse {
  is_setup:  boolean;
  full_name: string;
}

export interface SetPasswordRequest {
  token:    string;
  password: string;
}

export interface UpdateProfileRequest {
  name:  string;
  phone: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password:     string;
}
