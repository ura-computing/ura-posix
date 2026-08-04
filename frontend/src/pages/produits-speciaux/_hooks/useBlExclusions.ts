/** BL-exclusion state for the "Bons de livraison" tab of Produits Spéciaux.
 *  Owner-managed, reversible. Excluding a BL removes its Achats from every
 *  purchase aggregate (dashboard / analyse / stock) via the backend
 *  achat_bl_filter — so we invalidate the same caches produit-exclusion does. */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  excludeBl,
  listBlExclusions,
  reintegrateBls,
  searchBls,
} from "@/api/blExclusions";
import { QUERY_KEYS } from "@/types";


export function useBlExclusions() {
  const queryClient = useQueryClient();
  const [search,   setSearch]   = useState("");   // filters the excluded-BL table
  const [searchQ,  setSearchQ]  = useState("");    // exclude-dialog search box

  const list = useQuery({
    queryKey: QUERY_KEYS.BL_EXCLUSIONS,
    queryFn:  listBlExclusions,
  });

  const results = useQuery({
    queryKey:  QUERY_KEYS.BL_SEARCH(searchQ),
    queryFn:   () => searchBls(searchQ),
    enabled:   searchQ.trim().length >= 2,
    staleTime: 30_000,
  });

  // Excluding/reintegrating a BL shifts every purchase aggregate → invalidate
  // the same caches the product-exclusion flow does.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BL_EXCLUSIONS });
    queryClient.invalidateQueries({ queryKey: ["bl-search"] });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STATS_PREFIX });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MARGIN_ALERTS_PREFIX });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ANALYSE_MARGE_PREFIX });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STOCK_SUMMARY });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STOCK_ABCD_FULL_PREFIX });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STOCK_ABCD_FILTERED_PREFIX });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACHATS_PREFIX });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.VENTES_PREFIX });
  };

  const exclude = useMutation({
    mutationFn: (v: { ref: string; notes?: string }) => excludeBl(v.ref, v.notes),
    onSuccess:  (r) => {
      toast.success(r.already_excluded ? "Ce BL était déjà exclu" : `BL ${r.item?.delivery_ref} exclu`);
      setSearchQ("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reintegrate = useMutation({
    mutationFn: (refs: string[]) => reintegrateBls(refs),
    onSuccess:  (r) => {
      const verb = r.reintegrated === 1 ? "BL réintégré" : "BL réintégrés";
      toast.success(`${r.reintegrated} ${verb}`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const filtered = useMemo(() => {
    const all = list.data ?? [];
    if (!search.trim()) return all;
    const q = norm(search.trim());
    return all.filter((b) =>
      norm(b.delivery_ref).includes(q) ||
      norm(b.supplier ?? "").includes(q) ||
      norm(b.notes ?? "").includes(q),
    );
  }, [list.data, search]);

  return {
    exclusions: list.data ?? [],
    filtered,
    isLoading: list.isLoading,

    search, setSearch,

    searchQ, setSearchQ,
    results:        results.data ?? [],
    resultsLoading: results.isFetching,

    handleExclude:     (ref: string, notes?: string) => exclude.mutate({ ref, notes }),
    handleReintegrate: (refs: string[]) => reintegrate.mutate(refs),
    excluding:     exclude.isPending,
    reintegrating: reintegrate.isPending,
  };
}
