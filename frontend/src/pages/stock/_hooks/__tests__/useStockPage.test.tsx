/** Tests for useStockPage — dual-fetch + filter mechanics + healthScore. */
import { waitFor } from "@testing-library/react";
import { act } from "react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, test } from "vitest";

import { useStockPage } from "../useStockPage";
import { server } from "@/mocks/server";
import { renderHookWithProviders } from "@/test-utils";


beforeEach(() => {
  server.use(
    http.get("*/v1/stats/stock-abcd", () => HttpResponse.json({
      total_references: 0, classes: { A: 0, B: 0, C: 0, D: 0 },
      products: [], pagination: { total: 0, page: 1, limit: 25, page_count: 0 },
    })),
    http.get("*/v1/stats/peremptions", () => HttpResponse.json({ count: 0, items: [] })),
  );
});


describe("useStockPage", () => {
  test("initial state: classFilter='A' by default", () => {
    const { result } = renderHookWithProviders(() => useStockPage());
    expect(result.current.classFilter).toBe("A");
    expect(result.current.status).toBe("");
    expect(result.current.search).toBe("");
    expect(result.current.sortBy).toBe("units_sold_12m");
    expect(result.current.sortOrder).toBe("desc");
  });

  test("hasTableFilter true when classFilter is set", () => {
    const { result } = renderHookWithProviders(() => useStockPage());
    expect(result.current.hasTableFilter).toBe(true);
  });

  test("selectClass toggles off when clicking same class", () => {
    const { result } = renderHookWithProviders(() => useStockPage());
    act(() => result.current.selectClass("A"));   // toggles A → null
    expect(result.current.classFilter).toBeNull();
    expect(result.current.hasTableFilter).toBe(false);
  });

  test("selectClass switches between different classes", () => {
    const { result } = renderHookWithProviders(() => useStockPage());
    act(() => result.current.selectClass("B"));
    expect(result.current.classFilter).toBe("B");
  });

  test("toggleSort: same key flips asc/desc, new key resets to asc", () => {
    const { result } = renderHookWithProviders(() => useStockPage());
    act(() => result.current.toggleSort("units_sold_12m"));  // same key, was desc → asc
    expect(result.current.sortOrder).toBe("asc");
    act(() => result.current.toggleSort("product"));         // new key
    expect(result.current.sortBy).toBe("product");
    expect(result.current.sortOrder).toBe("asc");
  });

  test("clearAll resets every filter + page", () => {
    const { result } = renderHookWithProviders(() => useStockPage());
    act(() => result.current.setSearch("dol"));
    act(() => result.current.setStatus("rupture"));
    act(() => result.current.setPage(3));
    act(() => result.current.setDateFrom("2026-01-01"));
    act(() => result.current.clearAll());
    expect(result.current.search).toBe("");
    expect(result.current.status).toBe("");
    expect(result.current.page).toBe(1);
    expect(result.current.classFilter).toBeNull();
    expect(result.current.dateFrom).toBe("");
  });

  test("closeTable clears the table-driving filters but leaves dates", () => {
    const { result } = renderHookWithProviders(() => useStockPage());
    act(() => result.current.setDateFrom("2026-01-01"));
    act(() => result.current.setSearch("x"));
    act(() => result.current.closeTable());
    expect(result.current.search).toBe("");
    expect(result.current.classFilter).toBeNull();
    expect(result.current.dateFrom).toBe("2026-01-01");  // dates preserved
  });

  test("healthScore = 0 when no products", async () => {
    const { result } = renderHookWithProviders(() => useStockPage());
    await waitFor(() => expect(result.current.fullQuery.isSuccess).toBe(true));
    expect(result.current.healthScore).toBe(0);
  });

  test("healthScore reflects ideal/(total-inconnu) * 10", async () => {
    server.use(http.get("*/v1/stats/stock-abcd", () => HttpResponse.json({
      total_references: 4,
      classes: { A: 0, B: 0, C: 0, D: 0 },
      products: [
        { status: "ideal", product: "A", category: "A", units_sold_12m: 1, current_stock: 1, stock_min: 0, stock_max: 0, ppv: 0, avg_pu: 0 },
        { status: "ideal", product: "B", category: "A", units_sold_12m: 1, current_stock: 1, stock_min: 0, stock_max: 0, ppv: 0, avg_pu: 0 },
        { status: "rupture", product: "C", category: "A", units_sold_12m: 1, current_stock: 0, stock_min: 0, stock_max: 0, ppv: 0, avg_pu: 0 },
        { status: "inconnu", product: "D", category: "A", units_sold_12m: 1, current_stock: 0, stock_min: 0, stock_max: 0, ppv: 0, avg_pu: 0 },
      ],
      pagination: { total: 4, page: 1, limit: 25, page_count: 1 },
    })));
    const { result } = renderHookWithProviders(() => useStockPage());
    await waitFor(() => expect(result.current.fullQuery.isSuccess).toBe(true));
    // 2 ideal / 3 with status (excluding "inconnu") × 10 = 6.66…
    expect(result.current.healthScore).toBeCloseTo((2 / 3) * 10);
  });
});
