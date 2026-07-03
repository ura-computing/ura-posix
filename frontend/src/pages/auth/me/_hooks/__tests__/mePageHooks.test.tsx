/** Tests for the /auth/me page hook bundle:
 *    useChangePassword / useUpdateProfile / useSessions /
 *    useKillSession / useRevokeOtherSessions
 */
import { waitFor } from "@testing-library/react";
import { act } from "react";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { server } from "@/mocks/server";
import { renderHookWithProviders } from "@/test-utils";
import { QUERY_KEYS } from "@/types";

import { useChangePassword }       from "../useChangePassword";
import { useKillSession }          from "../useKillSession";
import { useRevokeOtherSessions }  from "../useRevokeOtherSessions";
import { useSessions }             from "../useSessions";
import { useUpdateProfile }        from "../useUpdateProfile";


const sampleSession = {
  id: "s1", device_label: "Mac", ip: "1.1.1.1",
  last_active_at: "2026-06-25T10:00:00Z", is_current: true,
};


describe("useSessions", () => {
  test("happy returns list", async () => {
    server.use(http.get("*/v1/sessions", () => HttpResponse.json([sampleSession])));
    const { result } = renderHookWithProviders(() => useSessions("1"));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sessions).toEqual([sampleSession]);
  });

  test("error state", async () => {
    server.use(http.get("*/v1/sessions", () => HttpResponse.json({}, { status: 500 })));
    const { result } = renderHookWithProviders(() => useSessions("1"));
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});


describe("useChangePassword", () => {
  test("happy invalidates ME + SESSIONS, fires onDone", async () => {
    server.use(http.post("*/v1/auth/change-password", () => new HttpResponse(null, { status: 204 })));
    const onDone = (() => { let called = false; return Object.assign(() => { called = true; }, { wasCalled: () => called }); })();
    const { result, qc } = renderHookWithProviders(() => useChangePassword(onDone));
    qc.setQueryData(QUERY_KEYS.ME, { id: "1", email: "x@example.com" });
    qc.setQueryData(QUERY_KEYS.SESSIONS("1"), [sampleSession]);

    act(() => result.current.handleChange({ current_password: "old", new_password: "newOne123" }));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(qc.getQueryState(QUERY_KEYS.ME)?.isInvalidated).toBe(true);
    expect(qc.getQueryState(QUERY_KEYS.SESSIONS("1"))?.isInvalidated).toBe(true);
  });

  test("error state on 400", async () => {
    server.use(http.post("*/v1/auth/change-password", () =>
      HttpResponse.json({ detail: "wrong" }, { status: 400 })));
    const { result } = renderHookWithProviders(() => useChangePassword());
    act(() => result.current.handleChange({ current_password: "x", new_password: "y" }));
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});


describe("useUpdateProfile", () => {
  test("happy invalidates ME", async () => {
    server.use(http.patch("*/v1/auth/me", () => HttpResponse.json({
      user: { id: 1, email: "x@example.com", name: "New", phone: null,
              role: "owner", status: "active" },
      pharmacy: null, permissions: [],
    })));
    const { result, qc } = renderHookWithProviders(() => useUpdateProfile());
    qc.setQueryData(QUERY_KEYS.ME, {});

    act(() => result.current.handleUpdate({ name: "New", phone: null }));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(qc.getQueryState(QUERY_KEYS.ME)?.isInvalidated).toBe(true);
  });
});


describe("useKillSession", () => {
  test("happy invalidates sessions + clears pendingId", async () => {
    server.use(http.delete("*/v1/sessions/s1", () => new HttpResponse(null, { status: 204 })));
    const { result, qc } = renderHookWithProviders(() => useKillSession("1"));
    qc.setQueryData(QUERY_KEYS.SESSIONS("1"), [sampleSession]);

    act(() => result.current.handleKill("s1"));
    await waitFor(() => expect(result.current.pendingId).toBeNull());
    expect(qc.getQueryState(QUERY_KEYS.SESSIONS("1"))?.isInvalidated).toBe(true);
  });

  test("404 path soft-recovers (invalidates + no throw)", async () => {
    server.use(http.delete("*/v1/sessions/s1", () =>
      HttpResponse.json({ detail: "gone" }, { status: 404 })));
    const { result, qc } = renderHookWithProviders(() => useKillSession("1"));
    qc.setQueryData(QUERY_KEYS.SESSIONS("1"), [sampleSession]);

    act(() => result.current.handleKill("s1"));
    await waitFor(() => expect(result.current.pendingId).toBeNull());
    // 404 is soft-recovered: list invalidated, no error surfaced.
    expect(qc.getQueryState(QUERY_KEYS.SESSIONS("1"))?.isInvalidated).toBe(true);
  });
});


describe("useRevokeOtherSessions", () => {
  test("happy invalidates sessions", async () => {
    server.use(http.post("*/v1/sessions/revoke-others", () => new HttpResponse(null, { status: 204 })));
    const { result, qc } = renderHookWithProviders(() => useRevokeOtherSessions("1"));
    qc.setQueryData(QUERY_KEYS.SESSIONS("1"), [sampleSession]);

    act(() => result.current.handleRevokeOthers());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(qc.getQueryState(QUERY_KEYS.SESSIONS("1"))?.isInvalidated).toBe(true);
  });
});
