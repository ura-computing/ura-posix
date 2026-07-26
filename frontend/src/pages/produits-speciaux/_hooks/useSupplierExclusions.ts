/** Supplier-exclusion state for the "Fournisseurs" tab of Produits Spéciaux.
 *  Owner-managed, reversible. Excluding a supplier removes its Achats from every
 *  purchase aggregate (dashboard / analyse / stock) via the backend
 *  achat_supplier_filter — so we invalidate the same caches BL-exclusion does. */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  excludeSupplier,
  listSupplierExclusions,
  reintegrateSuppliers,
  searchSuppliers,
} from "@/api/supplierExclusions";
import { useT } from "@/i18n/I18nProvider";
import { matchesFields } from "@/utils/text";
import { QUERY_KEYS } from "@/types";


export function useSupplierExclusions() {
  const t = useT();
  const queryClient = useQueryClient();
  const [search,  setSearch]  = useState("");   // filters the excluded-supplier table
  const [searchQ, setSearchQ] = useState("");   // exclude-dialog search box

  const list = useQuery({
    queryKey: QUERY_KEYS.SUPPLIER_EXCLUSIONS,
    queryFn:  listSupplierExclusions,
  });

  const results = useQuery({
    queryKey:  QUERY_KEYS.SUPPLIER_SEARCH(searchQ),
    queryFn:   () => searchSuppliers(searchQ),
    enabled:   searchQ.trim().length >= 2,
    staleTime: 30_000,
  });

  // Excluding/reintegrating a supplier shifts every purchase aggregate →
  // invalidate the same caches the BL-exclusion flow does.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SUPPLIER_EXCLUSIONS });
    queryClient.invalidateQueries({ queryKey: ["supplier-search"] });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STATS_PREFIX });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MARGIN_ALERTS_PREFIX });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ANALYSE_MARGE_PREFIX });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STOCK_SUMMARY });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STOCK_ABCD_FULL_PREFIX });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STOCK_ABCD_FILTERED_PREFIX });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACHATS_PREFIX });
  };

  const exclude = useMutation({
    mutationFn: (v: { supplier: string; notes?: string }) => excludeSupplier(v.supplier, v.notes),
    onSuccess:  (r) => {
      toast.success(
        r.already_excluded
          ? t("ps.supAlreadyExcluded")
          : t("ps.supExcluded", { name: r.item?.supplier ?? "" }),
      );
      setSearchQ("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reintegrate = useMutation({
    mutationFn: (suppliers: string[]) => reintegrateSuppliers(suppliers),
    onSuccess:  (r) => {
      const verb = r.reintegrated === 1 ? t("ps.supReintegratedOne") : t("ps.supReintegratedMany");
      toast.success(`${r.reintegrated} ${verb}`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const all = list.data ?? [];
    if (!search.trim()) return all;
    return all.filter((s) => matchesFields([s.supplier, s.notes ?? ""], search));
  }, [list.data, search]);

  return {
    exclusions: list.data ?? [],
    filtered,
    isLoading: list.isLoading,

    search, setSearch,

    searchQ, setSearchQ,
    results:        results.data ?? [],
    resultsLoading: results.isFetching,

    handleExclude:     (supplier: string, notes?: string) => exclude.mutate({ supplier, notes }),
    handleReintegrate: (suppliers: string[]) => reintegrate.mutate(suppliers),
    excluding:     exclude.isPending,
    reintegrating: reintegrate.isPending,
  };
}
