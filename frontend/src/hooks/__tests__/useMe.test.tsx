/** Tests for useMe — wraps GET /v1/auth/me + flattens the payload. */
import { waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { useMe } from "@/hooks/useMe";
import { server } from "@/mocks/server";
import { renderHookWithProviders } from "@/test-utils";


const mePayload = {
  user: {
    id:     1,
    email:  "owner@example.com",
    name:   "Owner Test",
    phone:  null,
    role:   "owner",
    status: "active",
  },
  pharmacy:    { id: 7, name: "Pharm A", code: "BOU0001" },
  permissions: ["achats", "ventes"],
};


describe("useMe", () => {
  test("loading state then flattened me", async () => {
    server.use(http.get("*/v1/auth/me", () => HttpResponse.json(mePayload)));

    const { result } = renderHookWithProviders(() => useMe());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.me).toBeNull();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.me).toEqual({
      id:          "1",
      email:       "owner@example.com",
      name:        "Owner Test",
      phone:       undefined,
      role:        "owner",
      status:      "active",
      pharmacy:    { id: 7, name: "Pharm A", code: "BOU0001" },
      permissions: ["achats", "ventes"],
    });
  });

  test("error state on 401", async () => {
    server.use(http.get("*/v1/auth/me", () => HttpResponse.json(
      { detail: "Session expirée" }, { status: 401 },
    )));

    const { result } = renderHookWithProviders(() => useMe());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.me).toBeNull();
  });

  test("name falls back to email when null", async () => {
    server.use(http.get("*/v1/auth/me", () => HttpResponse.json({
      ...mePayload,
      user: { ...mePayload.user, name: null },
    })));

    const { result } = renderHookWithProviders(() => useMe());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.me?.name).toBe("owner@example.com");
  });

  test("pharmacy=null when payload has no pharmacy (admin)", async () => {
    server.use(http.get("*/v1/auth/me", () => HttpResponse.json({
      ...mePayload,
      user: { ...mePayload.user, role: "admin" },
      pharmacy: null,
    })));

    const { result } = renderHookWithProviders(() => useMe());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.me?.pharmacy).toBeUndefined();
  });
});
