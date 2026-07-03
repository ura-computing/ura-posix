/** Tests for the category-suffix CRUD hook bundle. */
import { waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { server } from "@/mocks/server";
import { renderHookWithProviders } from "@/test-utils";

import {
  useCategorySuffixes,
  useCreateCategorySuffix,
  useDeleteCategorySuffix,
  useUpdateCategorySuffix,
} from "../useCategorySuffixes";


const sample = { id: 1, category: "Medicament", suffix: "-1", color: "teal" };


describe("useCategorySuffixes", () => {
  test("happy returns list", async () => {
    server.use(http.get("*/v1/category-suffixes", () => HttpResponse.json([sample])));
    const { result } = renderHookWithProviders(() => useCategorySuffixes());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sample]);
  });

  test("error state on 401", async () => {
    server.use(http.get("*/v1/category-suffixes", () =>
      HttpResponse.json({ detail: "x" }, { status: 401 })));
    const { result } = renderHookWithProviders(() => useCategorySuffixes());
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});


describe("useCreateCategorySuffix", () => {
  test("happy invalidates the list", async () => {
    server.use(http.post("*/v1/category-suffixes", () => HttpResponse.json(sample, { status: 201 })));
    const { result, qc } = renderHookWithProviders(() => useCreateCategorySuffix());
    qc.setQueryData(["category-suffixes"], [sample]);
    await result.current.mutateAsync({ category: "X", suffix: "-X", color: "rose" });
    expect(qc.getQueryState(["category-suffixes"])?.isInvalidated).toBe(true);
  });

  test("propagates server error", async () => {
    server.use(http.post("*/v1/category-suffixes", () =>
      HttpResponse.json({ detail: "duplicate" }, { status: 409 })));
    const { result } = renderHookWithProviders(() => useCreateCategorySuffix());
    await expect(
      result.current.mutateAsync({ category: "X", suffix: "-X", color: "teal" })
    ).rejects.toThrow();
  });
});


describe("useUpdateCategorySuffix", () => {
  test("happy invalidates the list", async () => {
    server.use(http.put("*/v1/category-suffixes/1", () => HttpResponse.json(sample)));
    const { result, qc } = renderHookWithProviders(() => useUpdateCategorySuffix());
    qc.setQueryData(["category-suffixes"], [sample]);
    await result.current.mutateAsync({ id: 1, body: { category: "M", suffix: "-2", color: "blue" } });
    expect(qc.getQueryState(["category-suffixes"])?.isInvalidated).toBe(true);
  });
});


describe("useDeleteCategorySuffix", () => {
  test("happy invalidates the list", async () => {
    server.use(http.delete("*/v1/category-suffixes/1", () => new HttpResponse(null, { status: 204 })));
    const { result, qc } = renderHookWithProviders(() => useDeleteCategorySuffix());
    qc.setQueryData(["category-suffixes"], [sample]);
    await result.current.mutateAsync(1);
    expect(qc.getQueryState(["category-suffixes"])?.isInvalidated).toBe(true);
  });
});
