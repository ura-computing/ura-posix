/** Tests for the /rapport hook bundle. Covers both owner-side
 *  (useStats / useMarginAlerts / useStockSummary) and admin-side
 *  (useAdminStats / useAdminPharmacies + the per-pharmacy queries).
 *
 *  Admin per-pharmacy hooks gate on `pharmacyId !== null` so we assert
 *  the enabled flag behavior too. */
import { waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { server } from "@/mocks/server";
import { renderHookWithProviders } from "@/test-utils";

import {
  useAdminPharmacies,
  useAdminPharmacyMarginAlerts,
  useAdminPharmacyStats,
  useAdminPharmacyStockSummary,
  useAdminStats,
  useMarginAlerts,
  useStats,
  useStockSummary,
} from "../useRapportData";
import { useAdminPharmacyAnalyseMarge } from "../useAdminAnalyseMarge";


const statsPayload = {
  kpis:          { ventes_total: 100, achats_total: 50, ventes_count: 3, achats_count: 2 },
  previous_kpis: { ventes_total: 80, achats_total: 40, marge_pct: 10 },
  advanced_kpis: {
    ticket_moyen: 30, vente_moyenne_par_jour: 20,
    best_day_dh: null, worst_day_dh: null,
    best_day_count: null, worst_day_count: null,
  },
  tva:            { tva_encaissee: 10, tva_payee: 5, tva_a_declarer: 5 },
  marge:          { marge_pct: 50, marge_brute_dh: 50, marge_nette_dh: 40 },
  type_breakdown: { pharmacie: { ventes_total: 0 }, parapharmacie: { ventes_total: 0 } },
  monthly_trend:  [],
  top_categories: [],
};
const F = { date_from: null, date_to: null, category_type: "all" as const, include_non_declared: false };


// ── Owner ──────────────────────────────────────────────────────────────────

describe("useStats", () => {
  test("happy returns payload", async () => {
    server.use(http.get("*/v1/stats", () => HttpResponse.json(statsPayload)));
    const { result } = renderHookWithProviders(() => useStats(F));
    await waitFor(() => expect(result.current.stats).toBeTruthy());
    expect(result.current.stats?.kpis.ventes_total).toBe(100);
  });

  test("error state", async () => {
    server.use(http.get("*/v1/stats", () => HttpResponse.json({}, { status: 500 })));
    const { result } = renderHookWithProviders(() => useStats(F));
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});


describe("useMarginAlerts", () => {
  test("happy returns alerts", async () => {
    server.use(http.get("*/v1/stats/margin-alerts", () => HttpResponse.json({
      negative: { count: 1, total_amount: 0 },
      low:      { count: 0, total_amount: 0 },
      ok:       { count: 0, total_amount: 0 },
      good:     { count: 0, total_amount: 0 },
      excellent:{ count: 0, total_amount: 0 },
    })));
    const { result } = renderHookWithProviders(() =>
      useMarginAlerts({ date_from: null, date_to: null, category_type: "all" }));
    await waitFor(() => expect(result.current.alerts).toBeTruthy());
  });
});


describe("useStockSummary", () => {
  test("happy returns summary", async () => {
    server.use(http.get("*/v1/stats/stock-summary", () => HttpResponse.json({
      total_units: 0, total_skus: 0, undeclared_units: 0, declared_units: 0, health_pct: 0,
    })));
    const { result } = renderHookWithProviders(() => useStockSummary());
    await waitFor(() => expect(result.current.stock).toBeTruthy());
  });
});


// ── Admin ──────────────────────────────────────────────────────────────────

describe("useAdminStats", () => {
  test("happy returns system tile payload", async () => {
    server.use(http.get("*/v1/admin/stats", () => HttpResponse.json({
      total_pharmacies: 1, total_active_users: 1,
      total_catalog_items: 17000, pending_catalog_requests: 0,
    })));
    const { result } = renderHookWithProviders(() => useAdminStats());
    await waitFor(() => expect(result.current.systemStats).toBeTruthy());
    expect(result.current.systemStats?.total_pharmacies).toBe(1);
  });
});


describe("useAdminPharmacies", () => {
  test("happy returns list", async () => {
    server.use(http.get("*/v1/admin/pharmacies", () => HttpResponse.json([
      { id: 1, name: "A", code: "BOU0001", city: "Bouskoura",
        archived_at: null, members_count: 1, member_initials: ["O"],
        enabled_features: [] },
    ])));
    const { result } = renderHookWithProviders(() => useAdminPharmacies());
    await waitFor(() => expect(result.current.pharmacies.length).toBe(1));
  });
});


describe("useAdminPharmacyStats", () => {
  test("disabled when pharmacyId is null", () => {
    const { result } = renderHookWithProviders(() => useAdminPharmacyStats(null, F));
    expect(result.current.stats).toBeUndefined();
  });

  test("happy when pharmacyId is set", async () => {
    server.use(http.get("*/v1/admin/pharmacy/1/stats", () => HttpResponse.json(statsPayload)));
    const { result } = renderHookWithProviders(() => useAdminPharmacyStats(1, F));
    await waitFor(() => expect(result.current.stats).toBeTruthy());
  });
});


describe("useAdminPharmacyMarginAlerts", () => {
  test("disabled when pharmacyId is null", () => {
    const { result } = renderHookWithProviders(() =>
      useAdminPharmacyMarginAlerts(null, { date_from: null, date_to: null, category_type: "all" }));
    expect(result.current.alerts).toBeUndefined();
  });

  test("happy when pharmacyId is set", async () => {
    server.use(http.get("*/v1/admin/pharmacy/1/stats/margin-alerts", () => HttpResponse.json({
      negative: { count: 0, total_amount: 0 },
      low:      { count: 0, total_amount: 0 },
      ok:       { count: 0, total_amount: 0 },
      good:     { count: 0, total_amount: 0 },
      excellent:{ count: 0, total_amount: 0 },
    })));
    const { result } = renderHookWithProviders(() =>
      useAdminPharmacyMarginAlerts(1, { date_from: null, date_to: null, category_type: "all" }));
    await waitFor(() => expect(result.current.alerts).toBeTruthy());
  });
});


describe("useAdminPharmacyStockSummary", () => {
  test("disabled when pharmacyId is null", () => {
    const { result } = renderHookWithProviders(() => useAdminPharmacyStockSummary(null));
    expect(result.current.stock).toBeUndefined();
  });

  test("happy when pharmacyId is set", async () => {
    server.use(http.get("*/v1/admin/pharmacy/1/stats/stock-summary", () => HttpResponse.json({
      total_units: 0, total_skus: 0, undeclared_units: 0, declared_units: 0, health_pct: 0,
    })));
    const { result } = renderHookWithProviders(() => useAdminPharmacyStockSummary(1));
    await waitFor(() => expect(result.current.stock).toBeTruthy());
  });
});


describe("useAdminPharmacyAnalyseMarge", () => {
  test("disabled when pharmacyId is null", () => {
    const { result } = renderHookWithProviders(() =>
      useAdminPharmacyAnalyseMarge(null, "produit", { date_from: null, date_to: null, category_type: "all" }));
    expect(result.current.data).toBeUndefined();
  });

  test("happy when pharmacyId is set", async () => {
    server.use(http.get("*/v1/admin/pharmacy/1/stats/analyse-marge", () =>
      HttpResponse.json({ mode: "produit", kpis: {
        total_ventes_dh: 0, total_ventes_unites: 0,
      }, rows: [] })));
    const { result } = renderHookWithProviders(() =>
      useAdminPharmacyAnalyseMarge(1, "produit", { date_from: null, date_to: null, category_type: "all" }));
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(result.current.data?.mode).toBe("produit");
  });
});
