/** Sanity test for the infra + the simplest hook. If this passes, vitest +
 *  the provider stack + msw are wired correctly. */
import { act } from "react";
import { describe, expect, test } from "vitest";

import { useGlobalDateRange } from "@/hooks/useGlobalDateRange";
import { renderHookWithProviders } from "@/test-utils";


describe("useGlobalDateRange", () => {
  test("starts with from + to = null", () => {
    const { result } = renderHookWithProviders(() => useGlobalDateRange());
    expect(result.current.from).toBeNull();
    expect(result.current.to).toBeNull();
  });

  test("setRange updates both values", () => {
    const { result } = renderHookWithProviders(() => useGlobalDateRange());
    act(() => result.current.setRange("2026-01-01", "2026-03-01"));
    expect(result.current.from).toBe("2026-01-01");
    expect(result.current.to).toBe("2026-03-01");
  });

  test("setRange(null, null) clears", () => {
    const { result } = renderHookWithProviders(() => useGlobalDateRange());
    act(() => result.current.setRange("2026-01-01", "2026-06-01"));
    act(() => result.current.setRange(null, null));
    expect(result.current.from).toBeNull();
    expect(result.current.to).toBeNull();
  });
});
