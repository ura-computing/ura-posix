/** Tests for the auth-flow page hooks:
 *    useForgotPassword (mutation)
 *    useSetPassword    (mutation → toast + navigate)
 *    useValidateToken  (query, gated on non-empty token)
 */
import { waitFor } from "@testing-library/react";
import { act } from "react";
import { http, HttpResponse } from "msw";
import { describe, expect, test, vi } from "vitest";

import { useForgotPassword } from "@/pages/auth/forgotPassword/_hooks/useForgotPassword";
import { useSetPassword }    from "@/pages/auth/setPassword/_hooks/useSetPassword";
import { useValidateToken }  from "@/pages/auth/setPassword/_hooks/useValidateToken";
import { server } from "@/mocks/server";
import { renderHookWithProviders } from "@/test-utils";


const navigateSpy = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateSpy };
});


describe("useForgotPassword", () => {
  test("happy success state", async () => {
    server.use(http.post("*/v1/auth/forgot-password", () =>
      HttpResponse.json({ detail: "envoyé" })));
    const { result } = renderHookWithProviders(() => useForgotPassword());
    act(() => result.current.handleForgot({ email: "x@example.com" }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  test("error state on 500", async () => {
    server.use(http.post("*/v1/auth/forgot-password", () =>
      HttpResponse.json({ detail: "oops" }, { status: 500 })));
    const { result } = renderHookWithProviders(() => useForgotPassword());
    act(() => result.current.handleForgot({ email: "x@example.com" }));
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});


describe("useSetPassword", () => {
  test("happy navigates to /login", async () => {
    server.use(http.post("*/v1/auth/set-password", () => new HttpResponse(null, { status: 204 })));
    navigateSpy.mockClear();
    const { result } = renderHookWithProviders(() => useSetPassword("tok-1"));
    act(() => result.current.handleSetPassword({ password: "newPasswordABC" }));
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/login", { replace: true }));
  });

  test("error path keeps user on page", async () => {
    server.use(http.post("*/v1/auth/set-password", () =>
      HttpResponse.json({ detail: "expired" }, { status: 400 })));
    navigateSpy.mockClear();
    const { result } = renderHookWithProviders(() => useSetPassword("expired-tok"));
    act(() => result.current.handleSetPassword({ password: "x" }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});


describe("useValidateToken", () => {
  test("disabled when token is empty", () => {
    const { result } = renderHookWithProviders(() => useValidateToken(""));
    expect(result.current.isValidating).toBe(false);
    expect(result.current.isValid).toBe(false);
  });

  test("happy returns is_setup + full_name", async () => {
    server.use(http.get("*/v1/auth/validate-token", () =>
      HttpResponse.json({ is_setup: true, full_name: "User One" })));
    const { result } = renderHookWithProviders(() => useValidateToken("good-tok"));
    await waitFor(() => expect(result.current.isValid).toBe(true));
    expect(result.current.isSetup).toBe(true);
    expect(result.current.fullName).toBe("User One");
  });

  test("invalid token never flips isValid", async () => {
    server.use(http.get("*/v1/auth/validate-token", () =>
      HttpResponse.json({ detail: "bad" }, { status: 400 })));
    const { result } = renderHookWithProviders(() => useValidateToken("bad-tok"));
    await waitFor(() => expect(result.current.isValidating).toBe(false));
    expect(result.current.isValid).toBe(false);
  });
});
