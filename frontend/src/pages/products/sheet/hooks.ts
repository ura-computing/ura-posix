import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { api, ApiErr } from "@/api/client";
import { API } from "@/api/api";
import type { ProductSheet } from "@/types";

export const SHEET_TABS = ["general", "codes"] as const;
export type SheetTab = (typeof SHEET_TABS)[number];

/** One product's sheet + the tab in the URL (`?tab=codes`, kept on reload / back). */
export function useProduitPage(id: number) {
  const valid = Number.isInteger(id) && id > 0;
  const { data, isLoading, error } = useQuery({
    queryKey: API.products.sheet.key(id),
    queryFn: () => api.get<ProductSheet>(API.products.sheet.url(id)),
    enabled: valid,
  });

  const [params, setParams] = useSearchParams();
  const asked = params.get("tab");
  const tab: SheetTab = SHEET_TABS.find((t) => t === asked) ?? "general";
  const setTab = (next: SheetTab) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === "general") p.delete("tab");
        else p.set("tab", next);
        return p;
      },
      { replace: true },
    );

  return {
    sheet: data ?? null,
    isLoading,
    // Not one of the pharmacy's products (or a wrong address): the 404 inside the layout.
    notFound: !valid || (error instanceof ApiErr && error.status === 404),
    tab,
    setTab,
  };
}
