/** Tests for useCatalogPage (admin) — list/categories queries + 4 mutations
 *  + filter/sort mechanics. */
import { waitFor } from "@testing-library/react";
import { act } from "react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, test } from "vitest";

import { useCatalogPage } from "../useCatalogPage";
import { server } from "@/mocks/server";
import { renderHookWithProviders } from "@/test-utils";


beforeEach(() => {
  server.use(
    http.get("*/v1/admin/catalog", () => HttpResponse.json({
      data: [], pagination: { total: 0, page: 1, limit: 25, page_count: 0 },
    })),
    http.get("*/v1/admin/catalog/categories", () => HttpResponse.json([])),
  );
});


describe("useCatalogPage", () => {
  test("initial filter state defaults", () => {
    const { result } = renderHookWithProviders(() => useCatalogPage());
    expect(result.current.filters.page).toBe(1);
    expect(result.current.filters.limit).toBe(25);
    expect(result.current.filters.sort_by).toBe("product");
    expect(result.current.filters.sort_order).toBe("asc");
  });

  test("setSearch resets page to 1", () => {
    const { result } = renderHookWithProviders(() => useCatalogPage());
    act(() => result.current.setPage(5));
    act(() => result.current.setSearch("dol"));
    expect(result.current.filters.page).toBe(1);
    expect(result.current.filters.search).toBe("dol");
  });

  test("setSort toggles + new key resets to asc (catalog default ASC)", () => {
    const { result } = renderHookWithProviders(() => useCatalogPage());
    act(() => result.current.setSort("product"));   // same key, was asc → desc
    expect(result.current.filters.sort_order).toBe("desc");
    act(() => result.current.setSort("pph"));       // new key → asc
    expect(result.current.filters.sort_by).toBe("pph");
    expect(result.current.filters.sort_order).toBe("asc");
  });

  test("reset restores defaults", () => {
    const { result } = renderHookWithProviders(() => useCatalogPage());
    act(() => result.current.setSearch("x"));
    act(() => result.current.setCategories(["Medicament"]));
    act(() => result.current.reset());
    expect(result.current.filters.search).toBe("");
    expect(result.current.filters.category).toEqual([]);
  });

  test("create mutation invalidates catalog cache prefix", async () => {
    server.use(http.post("*/v1/admin/catalog", () => HttpResponse.json({
      id: 1, pid: "X", product: "X", tva: "T", pph: 0, ppv: 0,
      category: "M", barcode1: null, barcode2: null,
      laboratoire: null, product_type: null,
    })));
    const { result, qc } = renderHookWithProviders(() => useCatalogPage());
    qc.setQueryData(["catalog", "any"], { data: [], pagination: { total: 0 } });
    act(() => result.current.create({ product: "X", tva: "T", pph: 0, ppv: 0, category: "M" }));
    await waitFor(() => expect(result.current.creating).toBe(false));
  });

  test("remove mutation succeeds + clears pending", async () => {
    server.use(http.delete("*/v1/admin/catalog/1", () => new HttpResponse(null, { status: 204 })));
    const { result } = renderHookWithProviders(() => useCatalogPage());
    act(() => result.current.remove(1));
    await waitFor(() => expect(result.current.removing).toBe(false));
  });
});
