import { api } from "@/api/client";
import type {
  ForgotPasswordRequest,
  LoginRequest,
  MeResponse,
  SetPasswordRequest,
  ValidateTokenResponse,
} from "@/types";

export function login(input: LoginRequest): Promise<MeResponse> {
  return api<MeResponse>("/auth/login", { method: "POST", body: input });
}

export function logout(): Promise<void> {
  return api<void>("/auth/logout", { method: "POST" });
}

export function getMe(): Promise<MeResponse> {
  return api<MeResponse>("/auth/me", { method: "GET" });
}

export function forgotPassword(input: ForgotPasswordRequest): Promise<{ detail: string }> {
  return api<{ detail: string }>("/auth/forgot-password", { method: "POST", body: input });
}

export function validateToken(token: string): Promise<ValidateTokenResponse> {
  const q = new URLSearchParams({ token }).toString();
  return api<ValidateTokenResponse>(`/auth/validate-token?${q}`, { method: "GET" });
}

export function setPassword(input: SetPasswordRequest): Promise<void> {
  return api<void>("/auth/set-password", { method: "POST", body: input });
}

// Legacy alias kept for compatibility with existing imports. Prefer LoginRequest.
export type LoginInput = LoginRequest;