/** Tests for useAnalysePage — analyse-marge query + liste mutation + client-side
 *  pagination + search filter + reset-page-on-change. */
import { waitFor } from "@testing-library/react";
import { act } from "react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, test } from "vitest";

import { useAnalysePage } from "../useAnalysePage";
import { server } from "@/mocks/server";
import { renderHookWithProviders } from "@/test-utils";


const samplePayload = {
  mode: "produit",
  kpis: { total_ventes_dh: 0, total_ventes_unites: 0 },
  rows: Array.from({ length: 30 }, (_, i) => ({
    product: `P${i}`, category: "Med", laboratoire: "Lab",
    grossiste: "Gr", client: "C", mois: "06", annee: "2026",
    quantite: 1, prix_unitaire: 10, total: 10,
  })),
};

beforeEach(() => {
  server.use(
    http.get("*/v1/stats/analyse-marge", () => HttpResponse.json(samplePayload)),
  );
});


describe("useAnalysePage", () => {
  test("initial state defaults", () => {
    const { result } = renderHookWithProviders(() => useAnalysePage());
    expect(result.current.mode).toBe("produit");
    expect(result.current.search).toBe("");
    expect(result.current.pagination.page).toBe(1);
    expect(result.current.pagination.pageSize).toBe(25);
  });

  test("rows are paginated client-side to 25 per page", async () => {
    const { result } = renderHookWithProviders(() => useAnalysePage());
    await waitFor(() => expect(result.current.totalRows).toBe(30));
    expect(result.current.rows).toHaveLength(25);
  });

  test("page 2 returns the remaining slice", async () => {
    const { result } = renderHookWithProviders(() => useAnalysePage());
    await waitFor(() => expect(result.current.totalRows).toBe(30));
    act(() => result.current.pagination.onPage(2));
    expect(result.current.rows).toHaveLength(5);
  });

  test("search filter narrows result + resets to page 1", async () => {
    const { result } = renderHookWithProviders(() => useAnalysePage());
    await waitFor(() => expect(result.current.totalRows).toBe(30));
    act(() => result.current.pagination.onPage(2));
    act(() => result.current.setSearch("P1"));
    expect(result.current.pagination.page).toBe(1);    // reset
    // Matches P1, P10..P19 (11 rows).
    expect(result.current.pagination.total).toBe(11);
  });

  test("setMode resets to page 1", async () => {
    const { result } = renderHookWithProviders(() => useAnalysePage());
    await waitFor(() => expect(result.current.totalRows).toBe(30));
    act(() => result.current.pagination.onPage(2));
    act(() => result.current.setMode("categorie"));
    expect(result.current.pagination.page).toBe(1);
    expect(result.current.mode).toBe("categorie");
  });

  test("clearAll resets filters + search", () => {
    const { result } = renderHookWithProviders(() => useAnalysePage());
    act(() => result.current.setSearch("xyz"));
    act(() => result.current.setFilters({
      date_from: "2026-01-01", date_to: "2026-03-31", category_type: "pharmacie",
    }));
    act(() => result.current.clearAll());
    expect(result.current.search).toBe("");
    expect(result.current.filters.date_from).toBeNull();
    expect(result.current.filters.category_type).toBe("all");
  });
});
