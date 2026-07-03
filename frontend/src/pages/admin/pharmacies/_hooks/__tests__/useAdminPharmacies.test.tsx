/** Tests for the admin-pharmacy hook bundle (11 hooks). Covers happy + error
 *  on queries, and happy + invalidation on mutations.
 *  msw mocks the entire /admin/* + /admin/users/* surface. */
import { waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { server } from "@/mocks/server";
import { renderHookWithProviders } from "@/test-utils";

import {
  useAdminPharmaciesList,
  useAdminPharmacy,
  useArchivePharmacy,
  useCreatePharmacy,
  useCreateUser,
  useDeleteUser,
  useResetUserPassword,
  useSetPharmacyFeatures,
  useSetUserPermissions,
  useSetUserStatus,
  useUpdatePharmacy,
} from "../useAdminPharmacies";


const samplePharm = {
  id: 1, name: "P A", code: "BOU0001", city: "Bouskoura",
  archived_at: null, members_count: 1, member_initials: ["O"],
  enabled_features: ["achats", "ventes"],
};

const sampleDetail = {
  id: 1, name: "P A", code: "BOU0001", city: "Bouskoura",
  address: null, phone: null, email: null, archived_at: null,
  enabled_features: ["achats", "ventes"],
  members: [],
  owners_union_permissions: [],
};


// ── Queries ────────────────────────────────────────────────────────────────

describe("useAdminPharmaciesList", () => {
  test("happy returns list", async () => {
    server.use(http.get("*/v1/admin/pharmacies", () => HttpResponse.json([samplePharm])));
    const { result } = renderHookWithProviders(() => useAdminPharmaciesList());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([samplePharm]);
  });

  test("error state on 500", async () => {
    server.use(http.get("*/v1/admin/pharmacies", () => HttpResponse.json({}, { status: 500 })));
    const { result } = renderHookWithProviders(() => useAdminPharmaciesList());
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});


describe("useAdminPharmacy", () => {
  test("happy returns detail when id set", async () => {
    server.use(http.get("*/v1/admin/pharmacies/1", () => HttpResponse.json(sampleDetail)));
    const { result } = renderHookWithProviders(() => useAdminPharmacy(1));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(1);
  });

  test("disabled when id is null — no fetch", async () => {
    const { result } = renderHookWithProviders(() => useAdminPharmacy(null));
    // The query should never enter fetching state; data stays undefined.
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });
});


// ── Pharmacy mutations ────────────────────────────────────────────────────

describe("useCreatePharmacy", () => {
  test("happy invalidates list", async () => {
    let listFetched = 0;
    server.use(
      http.get("*/v1/admin/pharmacies", () => { listFetched += 1; return HttpResponse.json([]); }),
      http.post("*/v1/admin/pharmacies", () => HttpResponse.json(sampleDetail)),
    );
    const { result, qc } = renderHookWithProviders(() => ({
      list:   useAdminPharmaciesList(),
      create: useCreatePharmacy(),
    }));
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    const before = listFetched;

    await result.current.create.mutateAsync({ name: "X", city: "Bouskoura" });
    // Invalidation refetches the list.
    await waitFor(() => expect(listFetched).toBeGreaterThan(before));
    expect(qc.getQueryState(["admin-pharmacies"])).toBeTruthy();
  });
});


describe("useUpdatePharmacy", () => {
  test("happy invalidates list AND detail", async () => {
    server.use(
      http.patch("*/v1/admin/pharmacies/1", () => HttpResponse.json(sampleDetail)),
    );
    const { result, qc } = renderHookWithProviders(() => useUpdatePharmacy(1));
    qc.setQueryData(["admin-pharmacies"], [samplePharm]);
    qc.setQueryData(["admin-pharmacies", 1], sampleDetail);

    await result.current.mutateAsync({ name: "X", city: "Casablanca" });
    expect(qc.getQueryState(["admin-pharmacies"])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(["admin-pharmacies", 1])?.isInvalidated).toBe(true);
  });
});


describe("useArchivePharmacy", () => {
  test("happy invalidates list AND detail", async () => {
    server.use(http.delete("*/v1/admin/pharmacies/1", () => HttpResponse.json({ ok: true })));
    const { result, qc } = renderHookWithProviders(() => useArchivePharmacy(1));
    qc.setQueryData(["admin-pharmacies"], [samplePharm]);
    qc.setQueryData(["admin-pharmacies", 1], sampleDetail);

    await result.current.mutateAsync();
    expect(qc.getQueryState(["admin-pharmacies"])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(["admin-pharmacies", 1])?.isInvalidated).toBe(true);
  });
});


describe("useSetPharmacyFeatures", () => {
  test("happy invalidates detail", async () => {
    server.use(http.put("*/v1/admin/pharmacies/1/features", () => HttpResponse.json(sampleDetail)));
    const { result, qc } = renderHookWithProviders(() => useSetPharmacyFeatures(1));
    qc.setQueryData(["admin-pharmacies", 1], sampleDetail);

    await result.current.mutateAsync({ achats: true });
    expect(qc.getQueryState(["admin-pharmacies", 1])?.isInvalidated).toBe(true);
  });
});


// ── User mutations ────────────────────────────────────────────────────────

describe("useCreateUser", () => {
  test("happy returns member + temp_password and invalidates detail", async () => {
    server.use(http.post("*/v1/admin/pharmacies/1/users", () => HttpResponse.json({
      member: { id: 9, email: "x@example.com", role: "owner", status: "active",
                granted_permissions: [] },
      temp_password: "abc123XYZ",
    })));
    const { result, qc } = renderHookWithProviders(() => useCreateUser(1));
    qc.setQueryData(["admin-pharmacies", 1], sampleDetail);

    const out = await result.current.mutateAsync({
      email: "x@example.com", full_name: "X", role: "owner", pharmacy_id: 1,
    });
    expect(out.temp_password).toBe("abc123XYZ");
    expect(qc.getQueryState(["admin-pharmacies", 1])?.isInvalidated).toBe(true);
  });
});


describe("useSetUserPermissions", () => {
  test("happy invalidates detail", async () => {
    server.use(http.put("*/v1/admin/users/9/permissions", () => HttpResponse.json({
      id: 9, email: "x@example.com", role: "owner", status: "active",
      granted_permissions: ["achats"],
    })));
    const { result, qc } = renderHookWithProviders(() => useSetUserPermissions(1));
    qc.setQueryData(["admin-pharmacies", 1], sampleDetail);

    await result.current.mutateAsync({ userId: 9, permissions: { achats: true } });
    expect(qc.getQueryState(["admin-pharmacies", 1])?.isInvalidated).toBe(true);
  });
});


describe("useResetUserPassword", () => {
  test("happy returns temp_password", async () => {
    server.use(http.post("*/v1/admin/users/9/reset-password", () =>
      HttpResponse.json({ temp_password: "new-temp-pw" })));
    const { result } = renderHookWithProviders(() => useResetUserPassword());
    const out = await result.current.mutateAsync(9);
    expect(out.temp_password).toBe("new-temp-pw");
  });
});


describe("useSetUserStatus", () => {
  test("happy invalidates detail", async () => {
    server.use(http.patch("*/v1/admin/users/9/status", () => HttpResponse.json({
      id: 9, email: "x@example.com", role: "owner", status: "inactive",
      granted_permissions: [],
    })));
    const { result, qc } = renderHookWithProviders(() => useSetUserStatus(1));
    qc.setQueryData(["admin-pharmacies", 1], sampleDetail);

    await result.current.mutateAsync({ userId: 9, status: "inactive" });
    expect(qc.getQueryState(["admin-pharmacies", 1])?.isInvalidated).toBe(true);
  });
});


describe("useDeleteUser", () => {
  test("happy invalidates list + detail", async () => {
    server.use(http.delete("*/v1/admin/users/9", () => HttpResponse.json({ ok: true })));
    const { result, qc } = renderHookWithProviders(() => useDeleteUser(1));
    qc.setQueryData(["admin-pharmacies"], [samplePharm]);
    qc.setQueryData(["admin-pharmacies", 1], sampleDetail);

    await result.current.mutateAsync(9);
    expect(qc.getQueryState(["admin-pharmacies"])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(["admin-pharmacies", 1])?.isInvalidated).toBe(true);
  });
});
