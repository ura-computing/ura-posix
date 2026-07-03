import { api } from "@/api/client";
import type { ChangePasswordRequest, MeResponse, UpdateProfileRequest } from "@/types";

export function updateProfile(input: UpdateProfileRequest): Promise<MeResponse> {
  return api<MeResponse>("/auth/me", { method: "PATCH", body: input });
}

export function changePassword(input: ChangePasswordRequest): Promise<void> {
  return api<void>("/auth/change-password", { method: "POST", body: input });
}