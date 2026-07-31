/** Tests for useStockPage — dual-fetch + filter mechanics + healthScore. */
import { waitFor } from "@testing-library/react";
import { act } from "react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useStockPage } from "../useStockPage";
import { server } from "@/mocks/server";
import { renderHookWithProviders } from "@/test-utils";
import { downloadXlsx } from "@/utils/table";

// Mock the xlsx exporter so tests can assert which rows were passed.
vi.mock("@/utils/table", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/table")>();
  return {
    ...actual,
    downloadXlsx: vi.fn().mockResolvedValue(undefined),
  };
});


const stockRows = [
  { status: "ideal",       product: "Doliprane",  category: "A", units_sold_12m: 5, current_stock: 10, stock_min: 2, stock_max: 8, ppv: 3, avg_pu: 1 },
  { status: "a-surveiller", product: "Efferalgan", category: "B", units_sold_12m: 3, current_stock: 4,  stock_min: 2, stock_max: 8, ppv: 4, avg_pu: 2 },
  { status: "inconnu",     product: "Aspirine",   category: "C", units_sold_12m: 1, current_stock: null, stock_min: 1, stock_max: 5, ppv: 5, avg_pu: 3 },
  { status: "sur-stock",   product: "Smecta",     category: "A", units_sold_12m: 2, current_stock: 30, stock_min: 3, stock_max: 9, ppv: 6, avg_pu: 4 },
];

/** Serve the product set, honouring the `status` query param like the real
 *  backend does. Keeps full + filtered fetch slots in sync with the request. */
function stockResponse({ request }: { request: Request }) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const products = status
    ? stockRows.filter((p) => p.status === status)
    : stockRows;
  return HttpResponse.json({
    total_references: products.length,
    classes: { A: products.filter((p) => p.category === "A").length, B: 0, C: 0, D: 0 },
    products,
    pagination: { total: products.length, page: 1, limit: 25, page_count: 1 },
  });
}

beforeEach(() => {
  vi.mocked(downloadXlsx).mockClear();
  server.use(
    http.get("*/v1/stats/stock-abcd", stockResponse),
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
    act(() => result.current.setStatus("a-surveiller"));
    act(() => result.current.setPage(3));
    act(() => result.current.setDateFrom("2026-01-01"));
    act(() => result.current.clearAll());
    expect(result.current.search).toBe("");
    expect(result.current.status).toBe("");
    expect(result.current.page).toBe(1);
    expect(result.current.classFilter).toBeNull();
    // clearAll drops the explicit range → back to the stock 2-month default.
    expect(result.current.isDateDefault).toBe(true);
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
    server.use(
      http.get("*/v1/stats/stock-abcd", () => HttpResponse.json({
        total_references: 0,
        classes: { A: 0, B: 0, C: 0, D: 0 },
        products: [],
        pagination: { total: 0, page: 1, limit: 25, page_count: 0 },
      })),
    );
    const { result } = renderHookWithProviders(() => useStockPage());
    await waitFor(() => expect(result.current.fullQuery.isSuccess).toBe(true));
    expect(result.current.healthScore).toBe(0);
  });

  test("healthScore reflects ideal/(total-inconnu) * 10", async () => {
    // Ignore the default 4-row set; serve only ideal + inconnu for a fixed score.
    server.use(
      http.get("*/v1/stats/stock-abcd", () => HttpResponse.json({
        total_references: 2,
        classes: { A: 0, B: 0, C: 0, D: 0 },
        products: [
          { status: "ideal", product: "A", category: "A", units_sold_12m: 1, current_stock: 1, stock_min: 0, stock_max: 0, ppv: 0, avg_pu: 0 },
          { status: "inconnu", product: "B", category: "A", units_sold_12m: 1, current_stock: 0, stock_min: 0, stock_max: 0, ppv: 0, avg_pu: 0 },
        ],
        pagination: { total: 2, page: 1, limit: 25, page_count: 1 },
      })),
    );
    const { result } = renderHookWithProviders(() => useStockPage());
    await waitFor(() => expect(result.current.fullQuery.isSuccess).toBe(true));
    // 1 ideal / 1 with status (excluding "inconnu") × 10 = 10
    expect(result.current.healthScore).toBe(10);
  });

  test("openDialog stores the descriptor", () => {
    const { result } = renderHookWithProviders(() => useStockPage());
    act(() => result.current.openDialog({
      title: "Périmés", products: [], columns: [], defaultSortKey: "expiry_date",
    }));
    expect(result.current.dialog?.title).toBe("Périmés");
  });

  test("closeDialog resets the descriptor to null", () => {
    const { result } = renderHookWithProviders(() => useStockPage());
    act(() => result.current.openDialog({
      title: "X", products: [], columns: [], defaultSortKey: "expiry_date",
    }));
    act(() => result.current.closeDialog());
    expect(result.current.dialog).toBeNull();
  });

  // ── Excel export respects the Status filter ────────────────────────────────

  test("export with no table filter exports the full product set", async () => {
    const { result } = renderHookWithProviders(() => useStockPage());
    await waitFor(() => expect(result.current.fullQuery.isSuccess).toBe(true));
    await act(async () => { await result.current.handleExport(); });

    const [headers, ...body] = vi.mocked(downloadXlsx).mock.calls[0][0] as (string | number)[][];
    expect(headers).toEqual([
      "Produit", "Classe", "Ventes 12m", "Stock actuel",
      "Stock min", "Stock max", "PPV", "PU moyen", "Statut",
    ]);
    // No status filter → all 4 products exported, each with its status column.
    expect(body.map((r) => r[0])).toEqual(["Doliprane", "Efferalgan", "Aspirine", "Smecta"]);
    expect(body.map((r) => r[8])).toEqual(["ideal", "a-surveiller", "inconnu", "sur-stock"]);
  });

  test("export with an active Status filter exports only matching rows", async () => {
    const { result } = renderHookWithProviders(() => useStockPage());
    await waitFor(() => expect(result.current.fullQuery.isSuccess).toBe(true));

    // Apply the Status filter the same way StockTable's select does.
    act(() => result.current.setStatus("sur-stock"));
    await waitFor(() => expect(result.current.filteredQuery.isSuccess).toBe(true));

    await act(async () => { await result.current.handleExport(); });

    const [, ...body] = vi.mocked(downloadXlsx).mock.calls[0][0] as (string | number)[][];
    // Only the "sur-stock" row should be exported.
    expect(body.map((r) => r[0])).toEqual(["Smecta"]);
    expect(body).toHaveLength(1);
  });

  test("export with any Status filter exports only that status", async () => {
    const { result } = renderHookWithProviders(() => useStockPage());
    await waitFor(() => expect(result.current.fullQuery.isSuccess).toBe(true));

    act(() => result.current.setStatus("ideal"));
    await waitFor(() => expect(result.current.filteredQuery.isSuccess).toBe(true));

    await act(async () => { await result.current.handleExport(); });

    const [, ...body] = vi.mocked(downloadXlsx).mock.calls[0][0] as (string | number)[][];
    expect(body.map((r) => r[0])).toEqual(["Doliprane"]);
  });
});