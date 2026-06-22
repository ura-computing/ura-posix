/** /produits-speciaux page state: filters + CRUD + autocomplete for the
 *  exclude dialog. Owner-managed; no admin involved. */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  excludeProducts,
  listSpecialProducts,
  reintegrateProducts,
  suggestMedicaments,
} from "@/api/specialProducts";
import { QUERY_KEYS } from "@/types";


export function useProduitsSpeciaux() {
  const queryClient = useQueryClient();
  const [search,   setSearch]   = useState("");
  const [suggestQ, setSuggestQ] = useState("");

  const list = useQuery({
    queryKey: QUERY_KEYS.SPECIAL_PRODUCTS,
    queryFn:  listSpecialProducts,
  });

  const suggestions = useQuery({
    queryKey:  QUERY_KEYS.MEDICAMENT_SUGGESTIONS(suggestQ),
    queryFn:   () => suggestMedicaments(suggestQ),
    enabled:   suggestQ.trim().length >= 2,
    staleTime: 60_000,
  });

  // Invalidate every cache that filters via non_declared_sub — exclusions affect
  // achats / ventes / stats / margin alerts / stock / analyse aggregates.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SPECIAL_PRODUCTS });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STATS_PREFIX });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MARGIN_ALERTS_PREFIX });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ANALYSE_MARGE_PREFIX });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STOCK_SUMMARY });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STOCK_ABCD_FULL_PREFIX });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STOCK_ABCD_FILTERED_PREFIX });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.VENTES_PREFIX });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACHATS_PREFIX });
  };

  const exclude = useMutation({
    mutationFn: (ids: number[]) => excludeProducts(ids),
    onSuccess:  (r) => {
      const n    = r.inserted + r.already_special;
      const verb = n === 1 ? "produit exclu" : "produits exclus";
      const tail = r.already_special > 0
        ? ` (${r.already_special} déjà spécial${r.already_special > 1 ? "iaux" : ""})`
        : "";
      toast.success(`${n} ${verb}${tail}`);
      setSuggestQ("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reintegrate = useMutation({
    mutationFn: (ids: number[]) => reintegrateProducts(ids),
    onSuccess:  (r) => {
      const n    = r.reintegrated;
      const verb = n === 1 ? "produit réintégré" : "produits réintégrés";
      toast.success(`${n} ${verb}`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Local filter on the displayed table (case + accent insensitive).
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const filteredProducts = useMemo(() => {
    const all = list.data ?? [];
    if (!search.trim()) return all;
    const q = norm(search.trim());
    return all.filter((p) =>
      norm(p.product).includes(q) ||
      norm(p.pid).includes(q) ||
      norm(p.category ?? "").includes(q),
    );
  }, [list.data, search]);

  return {
    specialProducts: list.data ?? [],
    filteredProducts,
    isLoading: list.isLoading,

    search, setSearch,

    suggestions: suggestions.data ?? [],
    suggestionsLoading: suggestions.isFetching,
    suggestQ, setSuggestQ,

    handleExclude:     (ids: number[]) => exclude.mutate(ids),
    handleReintegrate: (ids: number[]) => reintegrate.mutate(ids),
    excluding:    exclude.isPending,
    reintegrating: reintegrate.isPending,
  };
}
