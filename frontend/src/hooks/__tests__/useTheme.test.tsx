/** Tests for useTheme — reads/writes localStorage + toggles `.dark` on <html>. */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { useTheme, THEME_MODES } from "@/hooks/useTheme";


beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");

  // jsdom doesn't ship matchMedia; stub it deterministically for the
  // SYSTEM-mode branch tests.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  localStorage.clear();
});


describe("useTheme", () => {
  test("defaults to system when nothing in storage", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe(THEME_MODES.SYSTEM);
  });

  test("hydrates from localStorage", () => {
    localStorage.setItem("pg-theme", "dark");
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe(THEME_MODES.DARK);
  });

  test("setMode persists to localStorage + flips state", () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setMode(THEME_MODES.DARK));
    expect(result.current.mode).toBe(THEME_MODES.DARK);
    expect(localStorage.getItem("pg-theme")).toBe("dark");
  });

  test("dark mode applies .dark class on <html>", () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setMode(THEME_MODES.DARK));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  test("light mode removes .dark class", () => {
    document.documentElement.classList.add("dark");
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setMode(THEME_MODES.LIGHT));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
