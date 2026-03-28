import { request } from "./client";
import { ENDPOINTS } from "@/constants";
import type { AuthToken, LoginPayload, ProfileUpdatePayload, RegisterPayload, User } from "@/types";

export const login = (payload: LoginPayload) =>
  request<AuthToken>(ENDPOINTS.auth.login, { method: "POST", body: JSON.stringify(payload) });

export const register = (payload: RegisterPayload) =>
  request<AuthToken>(ENDPOINTS.auth.register, { method: "POST", body: JSON.stringify(payload) });

export const me = () => request<User>(ENDPOINTS.auth.me);

export const updateMe = (payload: ProfileUpdatePayload) =>
  request<User>(ENDPOINTS.auth.me, { method: "PUT", body: JSON.stringify(payload) });

export const forgotPassword = (email: string) =>
  request<void>(ENDPOINTS.auth.forgotPassword, { method: "POST", body: JSON.stringify({ email }) });

export const resetPassword = (token: string, new_password: string) =>
  request<void>(ENDPOINTS.auth.resetPassword, { method: "POST", body: JSON.stringify({ token, new_password }) });
