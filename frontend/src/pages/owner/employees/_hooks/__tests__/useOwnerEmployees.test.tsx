/** Tests for the owner-employee CRUD hook bundle. */
import { waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { server } from "@/mocks/server";
import { renderHookWithProviders } from "@/test-utils";

import {
  useCreateEmployee,
  useDeleteEmployee,
  useOwnerEmployees,
  useResetEmployeePassword,
  useSetEmployeePermissions,
  useSetEmployeeStatus,
} from "../useOwnerEmployees";


const samplePayload = {
  employees: [
    { id: 1, email: "e@example.com", role: "employee", status: "active",
      full_name: "Emp", granted_permissions: [] },
  ],
  pharmacy_features: ["achats", "ventes"],
  my_permissions:    ["achats", "ventes"],
};


describe("useOwnerEmployees", () => {
  test("happy returns the bundle", async () => {
    server.use(http.get("*/v1/owner/employees", () => HttpResponse.json(samplePayload)));
    const { result } = renderHookWithProviders(() => useOwnerEmployees());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.employees).toHaveLength(1);
  });

  test("error state", async () => {
    server.use(http.get("*/v1/owner/employees", () => HttpResponse.json({}, { status: 500 })));
    const { result } = renderHookWithProviders(() => useOwnerEmployees());
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});


describe("useCreateEmployee", () => {
  test("happy invalidates list", async () => {
    server.use(http.post("*/v1/owner/employees", () => HttpResponse.json({
      member: { id: 2, email: "n@example.com", role: "employee", status: "active",
                granted_permissions: [] },
      temp_password: "tmp",
    })));
    const { result, qc } = renderHookWithProviders(() => useCreateEmployee());
    qc.setQueryData(["owner-employees"], samplePayload);
    await result.current.mutateAsync({
      email: "n@example.com", full_name: "N", role: "employee", pharmacy_id: 1,
    });
    expect(qc.getQueryState(["owner-employees"])?.isInvalidated).toBe(true);
  });
});


describe("useSetEmployeePermissions", () => {
  test("happy invalidates list", async () => {
    server.use(http.put("*/v1/owner/employees/1/permissions", () => HttpResponse.json({
      id: 1, email: "e@example.com", role: "employee", status: "active",
      granted_permissions: ["achats"],
    })));
    const { result, qc } = renderHookWithProviders(() => useSetEmployeePermissions());
    qc.setQueryData(["owner-employees"], samplePayload);
    await result.current.mutateAsync({ employeeId: 1, permissions: { achats: true } });
    expect(qc.getQueryState(["owner-employees"])?.isInvalidated).toBe(true);
  });
});


describe("useSetEmployeeStatus", () => {
  test("happy invalidates list", async () => {
    server.use(http.patch("*/v1/owner/employees/1/status", () => HttpResponse.json({
      id: 1, email: "e@example.com", role: "employee", status: "inactive",
      granted_permissions: [],
    })));
    const { result, qc } = renderHookWithProviders(() => useSetEmployeeStatus());
    qc.setQueryData(["owner-employees"], samplePayload);
    await result.current.mutateAsync({ employeeId: 1, status: "inactive" });
    expect(qc.getQueryState(["owner-employees"])?.isInvalidated).toBe(true);
  });
});


describe("useResetEmployeePassword", () => {
  test("happy returns temp_password", async () => {
    server.use(http.post("*/v1/owner/employees/1/reset-password", () =>
      HttpResponse.json({ temp_password: "x" })));
    const { result } = renderHookWithProviders(() => useResetEmployeePassword());
    const out = await result.current.mutateAsync(1);
    expect(out.temp_password).toBe("x");
  });
});


describe("useDeleteEmployee", () => {
  test("happy invalidates list", async () => {
    server.use(http.delete("*/v1/owner/employees/1", () => HttpResponse.json({ ok: true })));
    const { result, qc } = renderHookWithProviders(() => useDeleteEmployee());
    qc.setQueryData(["owner-employees"], samplePayload);
    await result.current.mutateAsync(1);
    expect(qc.getQueryState(["owner-employees"])?.isInvalidated).toBe(true);
  });
});
