export enum eUserRole {
  ADMIN = "admin",
  OWNER = "owner",
  EMPLOYEE = "employee",
}

export enum eUserStatus {
  PENDING = "pending",
  ACTIVE = "active",
  REJECTED = "rejected",
}

export enum eRequestType {
  NEW_PRODUCT = "new_product",
  NON_DECLARE = "non_declare",
  ANNULATION = "annulation",
}

export enum eRequestStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

export enum eCategoryType {
  ALL = "all",
  PHARMACIE = "pharmacie",
  PARAPHARMACIE = "parapharmacie",
}

export type UserRole = `${eUserRole}`;

export type UserStatus = `${eUserStatus}`;

export type User = {
  id: number;
  email: string;
  name?: string;
  phone?: string;
  pharmacy_name?: string;
  profile_complete: boolean;
  role: UserRole;
  status: UserStatus;
  permissions?: Record<string, boolean>;
  pharmacy_id?: number;
  pharmacy_address?: string;
};

export type PharmacyOwner = {
  id: number;
  name?: string;
  email: string;
  phone?: string;
};

export type Pharmacy = {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  options?: Record<string, boolean>;
  created_at?: string;
  user_count: number;
  owners?: PharmacyOwner[];
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  owner_pharmacy_name?: string;
};

export type UserAdmin = {
  id: number;
  email: string;
  name?: string;
  phone?: string;
  pharmacy_name?: string;
  profile_complete: boolean;
  role: UserRole;
  status: UserStatus;
  permissions?: Record<string, boolean>;
  pharmacy_id?: number;
  created_at?: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type SignupPayload = {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role?: eUserRole.OWNER | eUserRole.EMPLOYEE;
  pharmacy_name?: string;
  pharmacy_id?: number;
};

export type ProfileUpdatePayload = {
  name?: string;
  phone?: string;
  email?: string;
  pharmacy_name?: string;
  pharmacy_address?: string;
};

export type AuthToken = {
  access_token: string;
  token_type: string;
  user: User;
};

