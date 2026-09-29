/** API client for /v1/owner/employees endpoints (Gérer mon équipe).
 *  Mirrors backend/routers/owner_employees.py. */
import { api } from "@/api/client";
import type {
  CreateUserIn,
  CreateUserOut,
  MemberOut,
  MemberStatus,
  OwnerEmployeesResponse,
  ResetPasswordOut,
} from "@/types";


export function listOwnerEmployees(): Promise<OwnerEmployeesResponse> {
  return api(`/owner/employees`);
}

/** Owner creates an employee for their own pharmacy. The role is HARDCODED
 *  to "employee" server-side — `body.role` is ignored. */
export function createEmployee(body: CreateUserIn): Promise<CreateUserOut> {
  return api(`/owner/employees`, { method: "POST", body });
}

/** Bulk-set the employee's 9 permissions (intersection at read time gives
 *  effective access). */
export function setEmployeePermissions(
  employeeId: number,
  permissions: Record<string, boolean>,
): Promise<MemberOut> {
  return api(`/owner/employees/${employeeId}/permissions`, {
    method: "PUT",
    body:   { permissions },
  });
}

export function setEmployeeStatus(employeeId: number, status: MemberStatus): Promise<MemberOut> {
  return api(`/owner/employees/${employeeId}/status`, { method: "PATCH", body: { status } });
}

export function resetEmployeePassword(employeeId: number, password: string): Promise<ResetPasswordOut> {
  return api(`/owner/employees/${employeeId}/reset-password`, { method: "POST", body: { password } });
}

export function deleteEmployee(employeeId: number): Promise<{ deleted: boolean }> {
  return api(`/owner/employees/${employeeId}`, { method: "DELETE" });
}
