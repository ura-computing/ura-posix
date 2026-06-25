/** Tests for useVentesPage — same shape as useAchatsPage tests with the
 *  surveillance + include_non_declared filter additions. */
import { act } from "react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, test } from "vitest";

import { useVentesPage } from "../useVentesPage";
import { server } from "@/mocks/server";
import { renderHookWithProviders } from "@/test-utils";


beforeEach(() => {
  server.use(
    http.get("*/v1/ventes",                       () => HttpResponse.json({ data: [], pagination: { total: 0, page: 1, limit: 20, page_count: 0 } })),
    http.get("*/v1/ventes/categories",            () => HttpResponse.json([])),
    http.get("*/v1/ventes/tva-rates",             () => HttpResponse.json([])),
    http.get("*/v1/ventes/suggestions",           () => HttpResponse.json({ items: [] })),
    http.get("*/v1/ventes/surveillance-counts",   () => HttpResponse.json({})),
  );
});


describe("useVentesPage", () => {
  test("initial state defaults", () => {
    const { result } = renderHookWithProviders(() => useVentesPage());
    expect(result.current.filters.page).toBe(1);
    expect(result.current.filters.include_non_declared).toBe(true);
    expect(result.current.filters.surveillance).toBeNull();
  });

  test("setSurveillance resets page to 1", () => {
    const { result } = renderHookWithProviders(() => useVentesPage());
    act(() => result.current.setPage(3));
    act(() => result.current.setSurveillance("psychotropes"));
    expect(result.current.filters.surveillance).toBe("psychotropes");
    expect(result.current.filters.page).toBe(1);
  });

  test("setIncludeND toggles + resets page", () => {
    const { result } = renderHookWithProviders(() => useVentesPage());
    act(() => result.current.setPage(2));
    act(() => result.current.setIncludeND(false));
    expect(result.current.filters.include_non_declared).toBe(false);
    expect(result.current.filters.page).toBe(1);
  });

  test("setSort toggles asc/desc", () => {
    const { result } = renderHookWithProviders(() => useVentesPage());
    act(() => result.current.setSort("ppv"));
    expect(result.current.filters.sort_order).toBe("desc");
    act(() => result.current.setSort("ppv"));
    expect(result.current.filters.sort_order).toBe("asc");
  });

  test("reset clears local + global date range", () => {
    const { result } = renderHookWithProviders(() => useVentesPage());
    act(() => result.current.setSearch("x"));
    act(() => result.current.setSurveillance("stupefiants"));
    act(() => result.current.setDateRange("2026-01-01", "2026-03-31"));
    act(() => result.current.reset());
    expect(result.current.filters.search).toBe("");
    expect(result.current.filters.surveillance).toBeNull();
    expect(result.current.filters.date_from).toBeNull();
  });
});
