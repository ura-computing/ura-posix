export type UserRole = "admin" | "owner" | "employee";

export type UserStatus = "pending" | "active" | "rejected";

export type User = {
  id: number;
  email: string;
  name?: string;
  image_url?: string;
  phone?: string;
  pharmacy_name?: string;
  profile_complete: boolean;
  role: UserRole;
  status: UserStatus;
  pharmacy_id?: number;
};

export type Pharmacy = {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  created_at?: string;
  user_count: number;
};

export type UserAdmin = {
  id: number;
  email: string;
  name?: string;
  image_url?: string;
  phone?: string;
  pharmacy_name?: string;
  profile_complete: boolean;
  role: UserRole;
  status: UserStatus;
  pharmacy_id?: number;
  created_at?: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role?: "owner" | "employee";
  pharmacy_name?: string;
  pharmacy_id?: number;
};

export type ProfileUpdatePayload = {
  name?: string;
  phone?: string;
  pharmacy_name?: string;
  image_url?: string;
};

export type AuthToken = {
  access_token: string;
  token_type: string;
  user: User;
};

export type ListResponse<T = unknown> = {
  data?: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type CreateResponse<T = unknown> = {
  data?: T;
};

export type GetOneResponse<T = unknown> = {
  data?: T;
};

export interface UploadWidgetValue {
  url: string;
  publicId: string;
}

export interface UploadWidgetProps {
  value?: UploadWidgetValue | null;
  onChange?: (value: UploadWidgetValue | null) => void;
  disabled?: boolean;
}

declare global {
  interface CloudinaryUploadWidgetResults {
    event: string;
    info: {
      secure_url: string;
      public_id: string;
      delete_token?: string;
      resource_type: string;
      original_filename: string;
    };
  }

  interface CloudinaryWidget {
    open: () => void;
  }

  interface Window {
    cloudinary?: {
      createUploadWidget: (
        options: Record<string, unknown>,
        callback: (
          error: unknown,
          result: CloudinaryUploadWidgetResults
        ) => void
      ) => CloudinaryWidget;
    };
  }
}
