/** Tests for useAlertesPage — bundles 3 queries + derives client-side stock
 *  metrics + totals + dialog state. */
import { waitFor } from "@testing-library/react";
import { act } from "react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, test } from "vitest";

import { useAlertesPage } from "../useAlertesPage";
import { server } from "@/mocks/server";
import { renderHookWithProviders } from "@/test-utils";


const emptyMargin = {
  negative: { count: 0, total_amount: 0 },
  low:      { count: 0, total_amount: 0 },
  ok:       { count: 0, total_amount: 0 },
  good:     { count: 0, total_amount: 0 },
  excellent:{ count: 0, total_amount: 0 },
};

const emptyPeremptions = {
  expired: { count: 0, items: [] },
  near_2w: { count: 0, items: [] },
  near_1m: { count: 0, items: [] },
};

const emptyStock = {
  total_references: 0, classes: { A: 0, B: 0, C: 0, D: 0 },
  products: [], pagination: { total: 0, page: 1, limit: 50, page_count: 0 },
};

beforeEach(() => {
  server.use(
    http.get("*/v1/stats/margin-alerts", () => HttpResponse.json(emptyMargin)),
    http.get("*/v1/stats/peremptions",   () => HttpResponse.json(emptyPeremptions)),
    http.get("*/v1/stats/stock-abcd",    () => HttpResponse.json(emptyStock)),
  );
});


describe("useAlertesPage", () => {
  test("initial filters: category='all', empty dates", () => {
    const { result } = renderHookWithProviders(() => useAlertesPage());
    expect(result.current.category).toBe("all");
    expect(result.current.dateFrom).toBe("");
    expect(result.current.dateTo).toBe("");
    expect(result.current.dialog).toBeNull();
  });

  test("setCategory updates state", () => {
    const { result } = renderHookWithProviders(() => useAlertesPage());
    act(() => result.current.setCategory("pharmacie"));
    expect(result.current.category).toBe("pharmacie");
  });

  test("resetAll clears category + global dates", () => {
    const { result } = renderHookWithProviders(() => useAlertesPage());
    act(() => result.current.setCategory("parapharmacie"));
    act(() => result.current.setDateFrom("2026-01-01"));
    act(() => result.current.resetAll());
    expect(result.current.category).toBe("all");
    expect(result.current.dateFrom).toBe("");
  });

  test("dialog open/close round-trip", () => {
    const { result } = renderHookWithProviders(() => useAlertesPage());
    act(() => result.current.openDialog({
      title: "Test", products: [], columns: [], defaultSortKey: "x",
    }));
    expect(result.current.dialog?.title).toBe("Test");
    act(() => result.current.closeDialog());
    expect(result.current.dialog).toBeNull();
  });

  test("isEmpty=true when all 3 queries return zero", async () => {
    const { result } = renderHookWithProviders(() => useAlertesPage());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalAlerts).toBe(0);
    expect(result.current.isEmpty).toBe(true);
  });

  test("derives negatif/sousStock/surStock from stock query", async () => {
    server.use(http.get("*/v1/stats/stock-abcd", () => HttpResponse.json({
      ...emptyStock,
      products: [
        { product: "A", status: "negatif",    current_stock: -3, ppv: 0, stock_min: 0, stock_max: 0, units_sold_12m: 1, category: "A" },
        { product: "B", status: "sous-stock", current_stock: 1, ppv: 10, stock_min: 5, stock_max: 10, units_sold_12m: 1, category: "A" },
        { product: "C", status: "sur-stock",  current_stock: 20, ppv: 5, stock_min: 5, stock_max: 10, units_sold_12m: 1, category: "A" },
        { product: "D", status: "ideal",      current_stock: 5, ppv: 0, stock_min: 0, stock_max: 10, units_sold_12m: 1, category: "A" },
      ],
    })));
    const { result } = renderHookWithProviders(() => useAlertesPage());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.negatif).toHaveLength(1);
    expect(result.current.sousStock).toHaveLength(1);
    expect(result.current.surStock).toHaveLength(1);
    expect(result.current.negUnits).toBe(3);     // abs(-3)
    expect(result.current.sousPpv).toBe(10 * (5 - 1));  // (stock_min - current) * ppv
    expect(result.current.surPpv).toBe(5 * (20 - 10));   // (current - stock_max) * ppv
  });
});
