import { request } from "./client";
import type { UserAdmin } from "@/types";

export type OwnerNotifications = {
  pending_employees: { id: number; name: string; email: string; created_at?: string }[];
};

export const getNotifications = () => request<OwnerNotifications>("/owner/notifications");

export const listEmployees = () => request<UserAdmin[]>("/owner/employees");

export const approveEmployee = (id: number) =>
  request<UserAdmin>(`/owner/employees/${id}/approve`, { method: "PUT" });

export const rejectEmployee = (id: number) =>
  request<UserAdmin>(`/owner/employees/${id}/reject`, { method: "PUT" });

export const revokeEmployee = (id: number) =>
  request<UserAdmin>(`/owner/employees/${id}/revoke`, { method: "PUT" });

export const updateEmployeePermissions = (id: number, permissions: Record<string, boolean>) =>
  request<UserAdmin>(`/owner/employees/${id}/permissions`, { method: "PUT", body: JSON.stringify({ permissions }) });

export type InviteEmployeePayload = {
  email: string;
  name?: string;
  phone?: string;
  permissions?: Record<string, boolean>;
};

export const inviteEmployee = (payload: InviteEmployeePayload) =>
  request<UserAdmin>("/owner/employees/invite", {
    method: "POST",
    body: JSON.stringify(payload),
  });
