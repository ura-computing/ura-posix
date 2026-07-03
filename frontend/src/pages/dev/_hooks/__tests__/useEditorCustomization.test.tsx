/** Tests for useEditorCustomization — the developer editor's server-state hook.
 *
 *  Covers the pieces that fixed the "1st color snaps back to default" bug + the
 *  auto-save toggle + the reset flow:
 *
 *  - Buffer overlay: after `patch()`, the returned `customization` reflects the
 *    pending edit BEFORE the round-trip (so a controlled <input value=…> stays
 *    on the new value).
 *  - `hasUnsaved` flips true after `patch()` and false after `save()`.
 *  - Auto-save OFF: `patch()` does NOT trigger a network call.
 *  - Auto-save ON:  `patch()` DOES trigger a network call (after the 500 ms
 *    debounce).
 *  - `save()` flushes the buffer regardless of mode.
 *  - `reset()` posts to /reset, drops the pending buffer, and replaces the
 *    cached customization with the server's fresh state.
 *  - `setAutoSave` persists to localStorage. */
import { act, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { server } from "@/mocks/server";
import { useEditorCustomization } from "@/pages/dev/_hooks/useEditorCustomization";
import { renderHookWithProviders } from "@/test-utils";
import type {
  CustomizationOut,
  CustomizationPatch,
  WebsiteRequestWithCustomizationOut,
} from "@/types/storeWebsiteApi";


const REQUEST_ID = "abcd1234-abcd-1234-abcd-1234abcd1234";

const INITIAL_CUSTOMIZATION: CustomizationOut = {
  template:              "lumiere",
  sections:              { hero: { visible: true }, brands: { visible: true } },
  brand_colors:          { primary: "#0E9E8C", secondary: "#34CBB7", accent: "#E9C887" },
  logo_url:              null,
  font_pairing:          "moderne",
  featured_category_ids: [],
  updated_at:            "2026-07-03T00:00:00Z",
};

const INITIAL_REQUEST: WebsiteRequestWithCustomizationOut = {
  id:            REQUEST_ID,
  pharmacy_id:   1,
  owner_id:      "1",
  store_name:    "Pharm Test",
  slogan:        null,
  brand_palette: ["#0E9E8C", "#34CBB7"],
  phone:         "0600000000",
  custom_domain: null,
  urgency:       "ce_mois",
  vision:        null,
  state:         "prise_en_charge",
  claimed_by:    { id: "9", name: "Dev" },
  claimed_at:    "2026-07-03T00:00:00Z",
  created_at:    "2026-07-03T00:00:00Z",
  updated_at:    "2026-07-03T00:00:00Z",
  customization: INITIAL_CUSTOMIZATION,
};

/** Server state — mutated by the mocked PATCH / RESET handlers so consecutive
 *  requests see up-to-date data (mirrors the real backend's deep-merge). */
let serverCust: CustomizationOut;
let patchCalls: CustomizationPatch[];

function deepMerge<T extends Record<string, unknown>>(a: T, b: Partial<T>): T {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === "object" && !Array.isArray(v)
        && out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}

beforeEach(() => {
  serverCust = structuredClone(INITIAL_CUSTOMIZATION);
  patchCalls = [];
  window.localStorage.clear();
  // Default to auto-save OFF for buffer-focused tests. Tests that specifically
  // exercise auto-save re-enable it before rendering.
  window.localStorage.setItem("editor.autoSave", "false");

  server.use(
    http.get(`*/v1/store-website/requests/${REQUEST_ID}`, () =>
      HttpResponse.json({ ...INITIAL_REQUEST, customization: serverCust }),
    ),
    http.patch(`*/v1/store-website/requests/${REQUEST_ID}/customization`, async ({ request }) => {
      const body = (await request.json()) as CustomizationPatch;
      patchCalls.push(body);
      serverCust = deepMerge(serverCust, body as Partial<CustomizationOut>);
      return HttpResponse.json(serverCust);
    }),
    http.post(`*/v1/store-website/requests/${REQUEST_ID}/customization/reset`, () => {
      serverCust = structuredClone(INITIAL_CUSTOMIZATION);
      return HttpResponse.json(serverCust);
    }),
  );
});

afterEach(() => vi.useRealTimers());


async function renderReady() {
  const rendered = renderHookWithProviders(() => useEditorCustomization(REQUEST_ID));
  await waitFor(() => expect(rendered.result.current.customization).not.toBeNull());
  return rendered;
}


describe("useEditorCustomization — buffer overlay", () => {
  test("patch() flips hasUnsaved and overlays the edit on customization immediately", async () => {
    const { result } = await renderReady();

    expect(result.current.hasUnsaved).toBe(false);
    expect(result.current.customization?.brand_colors.primary).toBe("#0E9E8C");

    act(() => result.current.patch({ brand_colors: { primary: "#FF0000" } }));

    // Overlay is synchronous — no waitFor needed.
    expect(result.current.hasUnsaved).toBe(true);
    expect(result.current.customization?.brand_colors.primary).toBe("#FF0000");
    // AND the untouched keys are preserved (the whole point of the merge).
    expect(result.current.customization?.brand_colors.secondary).toBe("#34CBB7");
    expect(result.current.customization?.brand_colors.accent).toBe("#E9C887");
  });

  test("consecutive patches accumulate in the buffer", async () => {
    const { result } = await renderReady();

    act(() => result.current.patch({ brand_colors: { primary:   "#FF0000" } }));
    act(() => result.current.patch({ brand_colors: { secondary: "#00FF00" } }));

    // Both survive on the overlay — this is the regression the bug fix prevents.
    expect(result.current.customization?.brand_colors.primary).toBe("#FF0000");
    expect(result.current.customization?.brand_colors.secondary).toBe("#00FF00");
    expect(result.current.customization?.brand_colors.accent).toBe("#E9C887");
  });
});


describe("useEditorCustomization — save flow", () => {
  test("auto-save OFF: patch() does NOT fire a network call", async () => {
    window.localStorage.setItem("editor.autoSave", "false");
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result } = await renderReady();
    expect(result.current.autoSave).toBe(false);

    act(() => result.current.patch({ brand_colors: { primary: "#FF0000" } }));

    // Advance well past the debounce window — nothing should have fired.
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(patchCalls).toHaveLength(0);
    expect(result.current.hasUnsaved).toBe(true);
  });

  test("save() flushes the buffer explicitly (auto-save OFF)", async () => {
    window.localStorage.setItem("editor.autoSave", "false");
    const { result } = await renderReady();

    act(() => result.current.patch({ brand_colors: { primary: "#FF0000" } }));
    act(() => result.current.save());

    await waitFor(() => expect(patchCalls).toHaveLength(1));
    expect(patchCalls[0]).toEqual({ brand_colors: { primary: "#FF0000" } });
    await waitFor(() => expect(result.current.hasUnsaved).toBe(false));
  });

  test("auto-save ON: patch() fires after the 500 ms debounce", async () => {
    window.localStorage.setItem("editor.autoSave", "true");
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = await renderReady();
    expect(result.current.autoSave).toBe(true);

    act(() => result.current.patch({ brand_colors: { primary: "#FF0000" } }));
    expect(patchCalls).toHaveLength(0);        // still buffered

    await act(async () => { vi.advanceTimersByTime(600); });
    await waitFor(() => expect(patchCalls).toHaveLength(1));
  });

  test("setAutoSave persists the preference to localStorage", async () => {
    const { result } = await renderReady();

    act(() => result.current.setAutoSave(false));
    expect(window.localStorage.getItem("editor.autoSave")).toBe("false");

    act(() => result.current.setAutoSave(true));
    expect(window.localStorage.getItem("editor.autoSave")).toBe("true");
  });
});


describe("useEditorCustomization — reset flow", () => {
  test("reset() drops buffer, POSTs, and restores the fresh customization", async () => {
    const { result } = await renderReady();

    // Dirty the buffer first — reset must clear it.
    act(() => result.current.patch({
      template:     "elegance",
      brand_colors: { primary: "#FF0000" },
    }));
    expect(result.current.hasUnsaved).toBe(true);

    act(() => result.current.reset());

    // Buffer cleared synchronously.
    expect(result.current.hasUnsaved).toBe(false);

    await waitFor(() => {
      expect(result.current.customization?.template).toBe("lumiere");
      expect(result.current.customization?.brand_colors.primary).toBe("#0E9E8C");
    });
    // The pending patch was thrown away — no PATCH went to the server.
    expect(patchCalls).toHaveLength(0);
  });
});
