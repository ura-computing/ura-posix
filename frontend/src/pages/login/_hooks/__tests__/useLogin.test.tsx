/** Tests for useLogin — POST /v1/auth/login + ME cache prime + navigate. */
import { waitFor } from "@testing-library/react";
import { act } from "react";
import { http, HttpResponse } from "msw";
import { describe, expect, test, vi } from "vitest";

import { useLogin } from "@/pages/login/_hooks/useLogin";
import { server } from "@/mocks/server";
import { renderHookWithProviders } from "@/test-utils";
import { QUERY_KEYS } from "@/types";


const navigateSpy = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateSpy };
});


const meBody = {
  user: { id: 1, email: "owner@example.com", name: "Owner", phone: null,
          role: "owner", status: "active" },
  pharmacy: null,
  permissions: [],
};


describe("useLogin", () => {
  test("happy primes ME cache + navigates home", async () => {
    server.use(http.post("*/v1/auth/login", () => HttpResponse.json(meBody)));
    navigateSpy.mockClear();

    const { result, qc } = renderHookWithProviders(() => useLogin());
    act(() => result.current.handleLogin({ email: "x@example.com", password: "p" }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(qc.getQueryData(QUERY_KEYS.ME)).toEqual(meBody);
    expect(navigateSpy).toHaveBeenCalledWith("/");
  });

  test("error path surfaces isError + does not navigate", async () => {
    server.use(http.post("*/v1/auth/login", () =>
      HttpResponse.json({ detail: "Bad creds" }, { status: 401 })));
    navigateSpy.mockClear();

    const { result } = renderHookWithProviders(() => useLogin());
    act(() => result.current.handleLogin({ email: "x@example.com", password: "p" }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
