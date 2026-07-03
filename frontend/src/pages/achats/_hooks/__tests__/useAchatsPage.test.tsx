/** Tests for useAchatsPage — page-orchestrator hook.
 *  Validates local-state mechanics (the data fetching is already exercised
 *  through api/transactions in the per-endpoint backend suite). */
import { act } from "react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, test } from "vitest";

import { useAchatsPage } from "../useAchatsPage";
import { server } from "@/mocks/server";
import { renderHookWithProviders } from "@/test-utils";


// Mock every endpoint the hook fans out to so msw doesn't error on unhandled.
beforeEach(() => {
  server.use(
    http.get("*/v1/achats",                  () => HttpResponse.json({ data: [], pagination: { total: 0, page: 1, limit: 20, page_count: 0 } })),
    http.get("*/v1/achats/categories",       () => HttpResponse.json([])),
    http.get("*/v1/achats/tva-rates",        () => HttpResponse.json([])),
    http.get("*/v1/achats/suggestions",      () => HttpResponse.json({ items: [] })),
    http.get("*/v1/achats/supplier-summary", () => HttpResponse.json({ data: [] })),
  );
});


describe("useAchatsPage", () => {
  test("initial filter state has page=1, sort_order=desc, date range from global context", () => {
    const { result } = renderHookWithProviders(() => useAchatsPage());
    expect(result.current.filters.page).toBe(1);
    expect(result.current.filters.limit).toBe(20);
    expect(result.current.filters.sort_order).toBe("desc");
    expect(result.current.filters.date_from).toBeNull();
    expect(result.current.filters.date_to).toBeNull();
  });

  test("setSearch resets page to 1", () => {
    const { result } = renderHookWithProviders(() => useAchatsPage());
    act(() => result.current.setPage(5));
    expect(result.current.filters.page).toBe(5);
    act(() => result.current.setSearch("doliprane"));
    expect(result.current.filters.search).toBe("doliprane");
    expect(result.current.filters.page).toBe(1);
  });

  test("setSort toggles asc/desc on same key", () => {
    const { result } = renderHookWithProviders(() => useAchatsPage());
    act(() => result.current.setSort("product"));
    expect(result.current.filters.sort_by).toBe("product");
    expect(result.current.filters.sort_order).toBe("desc");
    act(() => result.current.setSort("product"));
    expect(result.current.filters.sort_order).toBe("asc");
    act(() => result.current.setSort("product"));
    expect(result.current.filters.sort_order).toBe("desc");
  });

  test("setSort resets to desc on different key", () => {
    const { result } = renderHookWithProviders(() => useAchatsPage());
    act(() => result.current.setSort("product"));
    act(() => result.current.setSort("product"));          // → asc
    act(() => result.current.setSort("total"));            // diff key resets
    expect(result.current.filters.sort_by).toBe("total");
    expect(result.current.filters.sort_order).toBe("desc");
  });

  test("setPage does NOT reset to 1 (unlike filter setters)", () => {
    const { result } = renderHookWithProviders(() => useAchatsPage());
    act(() => result.current.setPage(7));
    expect(result.current.filters.page).toBe(7);
  });

  test("setPageSize resets page to 1", () => {
    const { result } = renderHookWithProviders(() => useAchatsPage());
    act(() => result.current.setPage(5));
    act(() => result.current.setPageSize(50));
    expect(result.current.filters.limit).toBe(50);
    expect(result.current.filters.page).toBe(1);
  });

  test("setDateRange syncs to global context (visible in filters.date_*)", () => {
    const { result } = renderHookWithProviders(() => useAchatsPage());
    act(() => result.current.setDateRange("2026-01-01", "2026-03-31"));
    expect(result.current.filters.date_from).toBe("2026-01-01");
    expect(result.current.filters.date_to).toBe("2026-03-31");
  });

  test("reset clears all filters AND global date range", () => {
    const { result } = renderHookWithProviders(() => useAchatsPage());
    act(() => result.current.setSearch("x"));
    act(() => result.current.setSort("product"));
    act(() => result.current.setDateRange("2026-01-01", "2026-03-31"));
    act(() => result.current.reset());
    expect(result.current.filters.search).toBe("");
    expect(result.current.filters.sort_by).toBeNull();
    expect(result.current.filters.date_from).toBeNull();
  });

  test("setSuggestQ controls the suggestQ state", () => {
    const { result } = renderHookWithProviders(() => useAchatsPage());
    act(() => result.current.setSuggestQ("dol"));
    expect(result.current.suggestQ).toBe("dol");
  });
});
