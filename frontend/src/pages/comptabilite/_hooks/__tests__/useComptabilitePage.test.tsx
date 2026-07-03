/** Tests for useComptabilitePage — bundles 3 queries + ledger pagination/sort. */
import { act } from "react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, test } from "vitest";

import { useComptabilitePage } from "../useComptabilitePage";
import { server } from "@/mocks/server";
import { renderHookWithProviders } from "@/test-utils";


beforeEach(() => {
  server.use(
    http.get("*/v1/stats", () => HttpResponse.json({
      kpis: { ventes_total: 0, achats_total: 0, ventes_count: 0, achats_count: 0 },
      previous_kpis: { ventes_total: 0, achats_total: 0, marge_pct: 0 },
      advanced_kpis: {
        ticket_moyen: 0, vente_moyenne_par_jour: 0,
        best_day_dh: null, worst_day_dh: null,
        best_day_count: null, worst_day_count: null,
      },
      tva: { tva_encaissee: 0, tva_payee: 0, tva_a_declarer: 0 },
      marge: { marge_pct: 0, marge_brute_dh: 0, marge_nette_dh: 0 },
      type_breakdown: { pharmacie: { ventes_total: 0 }, parapharmacie: { ventes_total: 0 } },
      monthly_trend: [], top_categories: [],
    })),
    http.get("*/v1/ventes", () => HttpResponse.json({
      data: [], pagination: { total: 0, page: 1, limit: 25, page_count: 0 },
    })),
    http.get("*/v1/accounting/payments", () => HttpResponse.json([])),
  );
});


describe("useComptabilitePage", () => {
  test("initial state defaults", () => {
    const { result } = renderHookWithProviders(() => useComptabilitePage());
    expect(result.current.filters.category_type).toBe("all");
    expect(result.current.filters.include_non_declared).toBe(false);
    expect(result.current.ventesPage).toBe(1);
    expect(result.current.ventesPageSize).toBe(25);
    expect(result.current.openMethod).toBeNull();
  });

  test("activeMonth defaults to current YYYY-MM", () => {
    const { result } = renderHookWithProviders(() => useComptabilitePage());
    expect(result.current.activeMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  test("setVentesSort toggles asc/desc on same key", () => {
    const { result } = renderHookWithProviders(() => useComptabilitePage());
    act(() => result.current.setVentesSort("ppv"));
    expect(result.current.ventesSortBy).toBe("ppv");
    expect(result.current.ventesSortOrder).toBe("desc");
    act(() => result.current.setVentesSort("ppv"));
    expect(result.current.ventesSortOrder).toBe("asc");
  });

  test("setVentesSort resets to desc on different key", () => {
    const { result } = renderHookWithProviders(() => useComptabilitePage());
    act(() => result.current.setVentesSort("ppv"));
    act(() => result.current.setVentesSort("ppv"));     // → asc
    act(() => result.current.setVentesSort("total"));   // different → desc
    expect(result.current.ventesSortBy).toBe("total");
    expect(result.current.ventesSortOrder).toBe("desc");
  });

  test("setFilters routes date fields to global context", () => {
    const { result } = renderHookWithProviders(() => useComptabilitePage());
    act(() => result.current.setFilters({
      category_type: "pharmacie", include_non_declared: true,
      date_from: "2026-01-01", date_to: "2026-03-31",
    }));
    expect(result.current.filters.category_type).toBe("pharmacie");
    expect(result.current.filters.include_non_declared).toBe(true);
    expect(result.current.filters.date_from).toBe("2026-01-01");
  });

  test("openMethod state round-trip", () => {
    const { result } = renderHookWithProviders(() => useComptabilitePage());
    act(() => result.current.setOpenMethod("tpe"));
    expect(result.current.openMethod).toBe("tpe");
    act(() => result.current.setOpenMethod(null));
    expect(result.current.openMethod).toBeNull();
  });
});
