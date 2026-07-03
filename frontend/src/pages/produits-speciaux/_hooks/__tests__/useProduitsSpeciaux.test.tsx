/** Tests for useProduitsSpeciaux — list + exclude/reintegrate mutations +
 *  accent-insensitive client search. */
import { waitFor } from "@testing-library/react";
import { act } from "react";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, test } from "vitest";

import { useProduitsSpeciaux } from "../useProduitsSpeciaux";
import { server } from "@/mocks/server";
import { renderHookWithProviders } from "@/test-utils";


const sample = [
  { id: 1, pid: "DOLI1", product: "Doliprane", category: "Medicament" },
  { id: 2, pid: "ASPI1", product: "Aspégic",   category: "Medicament" },
  { id: 3, pid: "VITAM", product: "Vitamine C", category: "Para" },
];

beforeEach(() => {
  server.use(
    http.get("*/v1/special-products/", () => HttpResponse.json(sample)),
  );
});


describe("useProduitsSpeciaux", () => {
  test("happy returns flattened list", async () => {
    const { result } = renderHookWithProviders(() => useProduitsSpeciaux());
    await waitFor(() => expect(result.current.specialProducts).toHaveLength(3));
  });

  test("filter is case + accent insensitive", async () => {
    const { result } = renderHookWithProviders(() => useProduitsSpeciaux());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setSearch("aspegic"));
    // Aspégic matches "aspegic" once accents normalized.
    expect(result.current.filteredProducts.map(p => p.id)).toContain(2);
  });

  test("empty search shows all", async () => {
    const { result } = renderHookWithProviders(() => useProduitsSpeciaux());
    await waitFor(() => expect(result.current.specialProducts).toHaveLength(3));
    expect(result.current.filteredProducts).toHaveLength(3);
  });

  test("handleExclude triggers + clears suggestQ on success", async () => {
    server.use(http.post("*/v1/special-products/", () =>
      HttpResponse.json({ inserted: 1, already_special: 0 })));
    const { result } = renderHookWithProviders(() => useProduitsSpeciaux());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setSuggestQ("dol"));
    act(() => result.current.handleExclude([1]));
    // Wait for the success-side effects (toast + setSuggestQ("") + invalidate).
    await waitFor(() => {
      expect(result.current.excluding).toBe(false);
      expect(result.current.suggestQ).toBe("");
    });
  });

  test("handleReintegrate fires", async () => {
    server.use(http.post("*/v1/special-products/reintegrate", () =>
      HttpResponse.json({ reintegrated: 1 })));
    const { result } = renderHookWithProviders(() => useProduitsSpeciaux());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.handleReintegrate([1]));
    await waitFor(() => expect(result.current.reintegrating).toBe(false));
  });
});
