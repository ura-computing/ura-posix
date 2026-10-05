/** useEditorCustomization — the developer editor's server-state hook.
 *
 *  - Fetches the full request + customization via GET /requests/{id}.
 *  - Buffers patches locally. In AUTO-SAVE mode (default), flushes on a
 *    500ms debounce. When auto-save is off, patches accumulate until the
 *    caller invokes `save()` — the Save button in the top bar.
 *  - Multipart logo upload is a separate mutation (no buffering — the file
 *    is committed on the spot).
 *  - Warns the developer via `beforeunload` when they try to close/navigate
 *    away with a dirty buffer. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/api/client";
import { API } from "@/api/api";

import type { CustomizationOut, CustomizationPatch, WebsiteRequestWithCustomizationOut } from "@/types/storeWebsite";

const DEBOUNCE_MS = 500;
const AUTOSAVE_LS_KEY = "editor.autoSave";

function readAutoSavePref(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(AUTOSAVE_LS_KEY);
  if (raw === null) return true; // default ON
  return raw === "true";
}

export function useEditorCustomization(requestId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: API.storeWebsite.request.key(requestId ?? "noop"),
    queryFn: () => api.get<WebsiteRequestWithCustomizationOut>(API.storeWebsite.request.url(requestId!)),
    enabled: !!requestId,
  });

  const patchMutation = useMutation({
    mutationFn: async (patch: CustomizationPatch) => {
      if (!requestId) throw new Error("No requestId");
      return api.patch<CustomizationOut>(API.storeWebsite.customization.url(requestId), patch);
    },
    onMutate: async (patch) => {
      if (!requestId) return;
      const key = API.storeWebsite.request.key(requestId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<WebsiteRequestWithCustomizationOut>(key);
      if (prev) {
        qc.setQueryData<WebsiteRequestWithCustomizationOut>(key, {
          ...prev,
          customization: mergeCustomization(prev.customization, patch),
        });
      }
      return { prev };
    },
    onError: (err, _patch, ctx) => {
      if (requestId && ctx?.prev) qc.setQueryData(API.storeWebsite.request.key(requestId), ctx.prev);
      toast.error(err.message);
    },
    onSuccess: (fresh) => {
      if (!requestId) return;
      const key = API.storeWebsite.request.key(requestId);
      const cur = qc.getQueryData<WebsiteRequestWithCustomizationOut>(key);
      if (cur) qc.setQueryData(key, { ...cur, customization: fresh });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!requestId) throw new Error("No requestId");
      return api.upload<CustomizationOut>(API.storeWebsite.logo.url(requestId), file);
    },
    onSuccess: (fresh) => {
      if (!requestId) return;
      const key = API.storeWebsite.request.key(requestId);
      const cur = qc.getQueryData<WebsiteRequestWithCustomizationOut>(key);
      if (cur) qc.setQueryData(key, { ...cur, customization: fresh });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!requestId) throw new Error("No requestId");
      return api.post<CustomizationOut>(API.storeWebsite.customizationReset.url(requestId));
    },
    onSuccess: (fresh) => {
      if (!requestId) return;
      const key = API.storeWebsite.request.key(requestId);
      const cur = qc.getQueryData<WebsiteRequestWithCustomizationOut>(key);
      if (cur) qc.setQueryData(key, { ...cur, customization: fresh });
    },
  });

  // ── Buffering + auto-save state ──────────────────────────────────────────
  //
  //  bufferRef  — the accumulated pending patch (null when clean).
  //  timerRef   — active debounce timer (auto-save mode only).
  //  bufferTick — a re-render trigger; bumps whenever the buffer becomes
  //               dirty or clean so the UI can reflect `hasUnsaved` +
  //               enable/disable the Save button.
  //
  const bufferRef = useRef<CustomizationPatch | null>(null);
  const timerRef = useRef<number | null>(null);
  const [bufferTick, setBufferTick] = useState(0);
  const bumpTick = useCallback(() => setBufferTick((t) => t + 1), []);

  const [autoSave, setAutoSaveState] = useState<boolean>(() => readAutoSavePref());

  const flush = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const p = bufferRef.current;
    bufferRef.current = null;
    bumpTick();
    if (p) patchMutation.mutate(p);
  }, [patchMutation, bumpTick]);

  /** Merge the incoming partial into the buffer. In auto-save mode, kick
   *  the debounced flush. In manual mode, sit tight until save() is
   *  called explicitly. */
  const patch = useCallback(
    (partial: CustomizationPatch) => {
      bufferRef.current = mergePatch(bufferRef.current, partial);
      bumpTick();
      if (autoSave) {
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(flush, DEBOUNCE_MS);
      }
    },
    [autoSave, flush, bumpTick],
  );

  /** Explicit user-initiated flush (Save button). Also used as the shared
   *  path from the debounce callback. */
  const save = useCallback(() => flush(), [flush]);

  /** Reset the customization back to bootstrap defaults. Drops any pending
   *  buffered edits AND cancels the debounce — they're meaningless once the
   *  server rewrites everything. */
  const reset = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    bufferRef.current = null;
    bumpTick();
    resetMutation.mutate();
  }, [resetMutation, bumpTick]);

  /** Toggle auto-save mode.
   *  - Enabling (off → on) with a dirty buffer flushes immediately: turning
   *    auto-save on shouldn't leave stale unsaved edits sitting around.
   *  - Disabling (on → off) cancels any pending debounce without flushing —
   *    that pending edit will only leave via a future save() call. */
  const setAutoSave = useCallback(
    (on: boolean) => {
      setAutoSaveState(on);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(AUTOSAVE_LS_KEY, on ? "true" : "false");
      }
      if (on) {
        if (bufferRef.current) flush();
      } else if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    },
    [flush],
  );

  // Flush on unmount so a fast-navigation-away doesn't drop a pending edit
  // while auto-save is ON. In manual mode we deliberately DON'T flush on
  // unmount — the developer chose to hold changes; respect that.
  useEffect(
    () => () => {
      if (autoSave && bufferRef.current) flush();
    },
    [autoSave, flush],
  );

  // Beforeunload guard — warn if the buffer is dirty. The browser only
  // honors it when the user has interacted with the page; that's fine.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (bufferRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const hasUnsaved = bufferRef.current !== null;
  void bufferTick; // reference so the `useMemo` deps below actually re-run

  // Overlay the pending buffer on top of the fetched customization so the UI
  // reflects the developer's edits immediately — otherwise a controlled input
  // (e.g. <input type="color">) would snap back to the last-persisted value on
  // the next re-render because `query.data.customization` hasn't caught up.
  const displayedCustomization = query.data?.customization
    ? bufferRef.current
      ? mergeCustomization(query.data.customization, bufferRef.current)
      : query.data.customization
    : null;

  return useMemo(
    () => ({
      request: query.data ?? null,
      customization: displayedCustomization,
      isLoading: query.isLoading,
      isError: query.isError,
      patch,
      save,
      reset,
      hasUnsaved,
      autoSave,
      setAutoSave,
      uploadLogo: (file: File) => uploadMutation.mutate(file),
      isUploading: uploadMutation.isPending,
      isSaving: patchMutation.isPending,
      isResetting: resetMutation.isPending,
    }),
    [
      query.data,
      displayedCustomization,
      query.isLoading,
      query.isError,
      patch,
      save,
      reset,
      hasUnsaved,
      autoSave,
      setAutoSave,
      uploadMutation,
      patchMutation.isPending,
      resetMutation.isPending,
      bufferTick,
    ],
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function mergePatch(a: CustomizationPatch | null, b: CustomizationPatch): CustomizationPatch {
  if (!a) return { ...b };
  return {
    ...a,
    ...b,
    // Special-case JSON objects: shallow-merge instead of overwriting so
    // ".patch({sections: {hero: {visible: false}}})" doesn't wipe other keys.
    sections: b.sections ? { ...(a.sections ?? {}), ...b.sections } : a.sections,
    brand_colors: b.brand_colors ? { ...(a.brand_colors ?? {}), ...b.brand_colors } : a.brand_colors,
  };
}

function mergeCustomization(cur: CustomizationOut, patch: CustomizationPatch): CustomizationOut {
  return {
    ...cur,
    ...patch,
    sections: patch.sections ? { ...cur.sections, ...patch.sections } : cur.sections,
    brand_colors: patch.brand_colors ? { ...cur.brand_colors, ...patch.brand_colors } : cur.brand_colors,
    featured_category_ids: patch.featured_category_ids ?? cur.featured_category_ids,
  };
}
