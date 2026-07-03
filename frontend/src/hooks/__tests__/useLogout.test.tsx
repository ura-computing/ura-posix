/** Tests for useLogout — POST /v1/auth/logout + cache clear + navigate. */
import { waitFor } from "@testing-library/react";
import { act } from "react";
import { http, HttpResponse } from "msw";
import { describe, expect, test, vi } from "vitest";

import { useLogout } from "@/hooks/useLogout";
import { server } from "@/mocks/server";
import { renderHookWithProviders } from "@/test-utils";
import { QUERY_KEYS } from "@/types";


// react-router-dom's useNavigate — spy on it so we can assert the redirect.
const navigateSpy = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateSpy };
});


describe("useLogout", () => {
  test("happy path clears the cache + navigates to /login", async () => {
    server.use(http.post("*/v1/auth/logout", () => new HttpResponse(null, { status: 204 })));

    const { result, qc } = renderHookWithProviders(() => useLogout());
    // Seed a cache entry to prove it gets cleared.
    qc.setQueryData(QUERY_KEYS.ME, { user: { email: "x" }, pharmacy: null, permissions: [] });

    act(() => result.current.handleLogout());
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/login"));
    expect(qc.getQueryData(QUERY_KEYS.ME)).toBeUndefined();
  });

  test("error swallowed via toast — no navigate", async () => {
    server.use(http.post("*/v1/auth/logout", () => HttpResponse.json(
      { detail: "Erreur" }, { status: 500 },
    )));

    navigateSpy.mockClear();
    const { result } = renderHookWithProviders(() => useLogout());
    act(() => result.current.handleLogout());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
