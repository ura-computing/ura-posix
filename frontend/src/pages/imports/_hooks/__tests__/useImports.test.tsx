/** Tests for /imports page hooks (list + soft-delete). */
import { waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { server } from "@/mocks/server";
import { renderHookWithProviders } from "@/test-utils";

import { useDeleteImport, useImports } from "../useImports";


const sampleResponse = {
  data: [{
    id: 1, file_type: "achat", filename: "x.csv",
    rows_inserted: 10, rows_skipped: 0,
    status: "success", error_message: null,
    imported_at: "2026-06-25T10:00:00Z",
    created_by_full_name: "Owner", created_by_email: "o@example.com",
    deleted_at: null, deleted_by_full_name: null, deleted_by_email: null,
  }],
  pagination: { total: 1, page: 1, limit: 100, page_count: 1 },
};


describe("useImports", () => {
  test("happy returns flattened list", async () => {
    server.use(http.get("*/v1/data/imports", () => HttpResponse.json(sampleResponse)));
    const { result } = renderHookWithProviders(() => useImports());
    await waitFor(() => expect(result.current.imports).toHaveLength(1));
    expect(result.current.pagination?.total).toBe(1);
  });

  test("empty list is safe (default ?? [])", async () => {
    server.use(http.get("*/v1/data/imports", () =>
      HttpResponse.json({ data: [], pagination: { total: 0, page: 1, limit: 100, page_count: 0 }})));
    const { result } = renderHookWithProviders(() => useImports());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.imports).toEqual([]);
  });
});


describe("useDeleteImport", () => {
  test("happy invalidates list", async () => {
    server.use(http.delete("*/v1/data/imports/1", () =>
      HttpResponse.json({ id: 1, deleted_rows: 5, file_type: "achat" })));
    const { result, qc } = renderHookWithProviders(() => useDeleteImport());
    qc.setQueryData(["imports"], sampleResponse);
    await new Promise<void>((resolve) => {
      result.current.deleteImport(1, { onSuccess: () => resolve() });
    });
    expect(qc.getQueryState(["imports"])?.isInvalidated).toBe(true);
  });

  test("error swallowed via toast", async () => {
    server.use(http.delete("*/v1/data/imports/1", () =>
      HttpResponse.json({ detail: "boom" }, { status: 500 })));
    const { result } = renderHookWithProviders(() => useDeleteImport());
    await new Promise<void>((resolve) => {
      result.current.deleteImport(1, { onError: () => resolve() });
    });
    expect(result.current.isPending).toBe(false);
  });
});
