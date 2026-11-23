/** The store editor's data (Support). Each change is kept as `pending`, shown at once (the colors, the switches),
 *  then sent: 0,5 s after the last change with « Enregistrement auto », else on « Enregistrer ». The logo is sent at
 *  once. Leaving the page with changes not sent: the browser asks first.
 *
 *    patch({ brand_colors: { primary: "#ff0000" } }) → pending = { brand_colors: { primary: "#ff0000" } }
 *    … 0,5 s … → PATCH /customization → the request's cache gets the answer → pending = null */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/api/client";
import { API } from "@/api/api";
import { useT } from "@/i18n/I18nProvider";
import type { CustomizationOut, CustomizationPatch, WebsiteRequestWithCustomizationOut } from "@/types/storeWebsite";

const DEBOUNCE_MS = 500;
const AUTOSAVE_KEY = "editor.autoSave";

function readAutoSave(): boolean {
  try {
    return window.localStorage.getItem(AUTOSAVE_KEY) !== "false";
  } catch {
    return true;
  }
}

/** `b` over `a`; `sections` / `brand_colors` merged key by key (like the backend). */
function mergePatch(a: CustomizationPatch | null, b: CustomizationPatch): CustomizationPatch {
  if (!a) return b;
  return {
    ...a,
    ...b,
    sections: b.sections ? { ...a.sections, ...b.sections } : a.sections,
    brand_colors: b.brand_colors ? { ...a.brand_colors, ...b.brand_colors } : a.brand_colors,
  };
}

function applyPatch(cur: CustomizationOut, patch: CustomizationPatch): CustomizationOut {
  return {
    ...cur,
    ...patch,
    sections: patch.sections ? { ...cur.sections, ...patch.sections } : cur.sections,
    brand_colors: patch.brand_colors ? { ...cur.brand_colors, ...patch.brand_colors } : cur.brand_colors,
    featured_category_ids: patch.featured_category_ids ?? cur.featured_category_ids,
  };
}

export function useStoreEditor(id: string) {
  const qc = useQueryClient();
  const t = useT();
  const key = API.storeWebsite.request.key(id);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: key,
    queryFn: () => api.get<WebsiteRequestWithCustomizationOut>(API.storeWebsite.request.url(id)),
    retry: false,
  });
  const [pending, setPending] = useState<CustomizationPatch | null>(null);
  const [autoSave, setAutoSaveState] = useState(readAutoSave);

  /** The server's answer replaces the cached customization (no refetch). */
  const store = (fresh: CustomizationOut) =>
    qc.setQueryData<WebsiteRequestWithCustomizationOut>(key, (cur) => (cur ? { ...cur, customization: fresh } : cur));

  const { mutate: sendPatch, isPending: isSaving } = useMutation({
    mutationFn: (patch: CustomizationPatch) =>
      api.patch<CustomizationOut>(API.storeWebsite.customization.url(id), patch),
    // Shown at once (the patch left `pending`), undone if the server refuses it.
    onMutate: (patch) => {
      const prev = qc.getQueryData<WebsiteRequestWithCustomizationOut>(key);
      if (prev) qc.setQueryData(key, { ...prev, customization: applyPatch(prev.customization, patch) });
      return { prev };
    },
    onError: (_e, _patch, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSuccess: store,
  });
  const upload = useMutation({
    mutationFn: (file: File) => api.upload<CustomizationOut>(API.storeWebsite.logo.url(id), file),
    onSuccess: (fresh) => {
      store(fresh);
      toast.success(t("store.logoSaved"));
    },
  });
  const reset = useMutation({
    mutationFn: () => api.post<CustomizationOut>(API.storeWebsite.customizationReset.url(id)),
    onSuccess: (fresh) => {
      store(fresh);
      toast.success(t("store.resetDone"));
    },
  });

  const save = () => {
    if (!pending) return;
    setPending(null);
    sendPatch(pending);
  };

  // Auto-save: 0,5 s after the last change.
  useEffect(() => {
    if (!pending || !autoSave) return;
    const timer = window.setTimeout(() => {
      setPending(null);
      sendPatch(pending);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [pending, autoSave, sendPatch]);

  // Changes not sent: the browser asks before leaving.
  useEffect(() => {
    if (!pending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);

  const setAutoSave = (on: boolean) => {
    setAutoSaveState(on);
    try {
      window.localStorage.setItem(AUTOSAVE_KEY, String(on));
    } catch {
      // private window: the choice lasts until the page closes
    }
  };

  return {
    request: data,
    /** The customization with the changes not sent yet: what the editor shows. */
    customization: data ? (pending ? applyPatch(data.customization, pending) : data.customization) : undefined,
    isLoading,
    isError,
    reload: () => void refetch(),
    patch: (partial: CustomizationPatch) => setPending((cur) => mergePatch(cur, partial)),
    save,
    hasUnsaved: pending !== null,
    isSaving,
    autoSave,
    setAutoSave,
    uploadLogo: upload.mutateAsync,
    isUploading: upload.isPending,
    resetCustomization: () => {
      setPending(null);
      return reset.mutateAsync();
    },
    isResetting: reset.isPending,
  };
}
