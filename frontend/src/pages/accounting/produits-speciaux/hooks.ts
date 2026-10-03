/** /produits-speciaux page state: filters + CRUD + autocomplete for the
 *  exclude dialog. Owner-managed; no admin involved. */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/api/client";
import { URLS } from "@/api/urls";
import { QUERIES } from "@/api/queries";

import type {
  BlExclusion, BlExclusionResult, BlReintegrateResult, BlSummary,
  MedicamentSuggestion, SpecialProduct, SpecialProductBulkResult, SpecialProductReintegrateResult,
  SupplierExclusion, SupplierExclusionResult, SupplierReintegrateResult, SupplierSummary,
} from "@/types";
import { useT } from "@/i18n/I18nProvider";
import { matchesFields } from "@/utils/text";


export function useProduitsSpeciaux() {
  const t = useT();
  const queryClient = useQueryClient();
  const [search,   setSearch]   = useState("");
  const [suggestQ, setSuggestQ] = useState("");

  const {
    data: list,
    isLoading,
  } = useQuery({
    queryKey: QUERIES.specialProducts.list,
    queryFn:  () => api.get<SpecialProduct[]>(URLS.specialProducts.list),
  });

  const {
    data: suggestions,
    isFetching: suggestionsLoading,
  } = useQuery({
    queryKey:  QUERIES.specialProducts.suggestions(suggestQ),
    queryFn:   () => api.get<MedicamentSuggestion[]>(URLS.specialProducts.suggestions, { params: { q: suggestQ } }),
    enabled:   suggestQ.trim().length >= 2,
    staleTime: 60_000,
  });

  // Invalidate every cache that filters via non_declared_sub — exclusions affect
  // achats / ventes / stats / margin alerts / stock / analyse aggregates.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: QUERIES.specialProducts.list });
    queryClient.invalidateQueries({ queryKey: QUERIES.specialProducts.suggestionsAll });   // an excluded product is no longer suggested
    queryClient.invalidateQueries({ queryKey: QUERIES.stats.mainAll });
    queryClient.invalidateQueries({ queryKey: QUERIES.stats.marginAlertsAll });
    queryClient.invalidateQueries({ queryKey: QUERIES.stats.analyseMargeAll });
    queryClient.invalidateQueries({ queryKey: QUERIES.stats.stockSummary });
    queryClient.invalidateQueries({ queryKey: QUERIES.stats.stockAbcdFullAll });
    queryClient.invalidateQueries({ queryKey: QUERIES.stats.stockAbcdFilteredAll });
    queryClient.invalidateQueries({ queryKey: QUERIES.ventes.listAll });
    queryClient.invalidateQueries({ queryKey: QUERIES.achats.listAll });
  };

  const {
    mutate: exclude,
    isPending: excluding,
  } = useMutation({
    mutationFn: (ids: number[]) =>
      api.post<SpecialProductBulkResult>(URLS.specialProducts.list, { medicament_ids: ids }),
    onSuccess:  (r) => {
      const n    = r.inserted + r.already_special;
      const s    = r.already_special;
      const tail = s > 0 ? t(s === 1 ? "ps.alreadySpecialOne" : "ps.alreadySpecialMany", { n: s }) : "";
      toast.success(t(n === 1 ? "ps.prodExcludedOne" : "ps.prodExcludedMany", { n }) + tail);
      setSuggestQ("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const {
    mutate: reintegrate,
    isPending: reintegrating,
  } = useMutation({
    mutationFn: (ids: number[]) =>
      api.post<SpecialProductReintegrateResult>(URLS.specialProducts.reintegrate, { medicament_ids: ids }),
    onSuccess:  (r) => {
      const n = r.reintegrated;
      toast.success(t(n === 1 ? "ps.prodReintegratedOne" : "ps.prodReintegratedMany", { n }));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Local filter on the displayed table (case + accent insensitive).
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const filteredProducts = useMemo(() => {
    const all = list ?? [];
    if (!search.trim()) return all;
    const q = norm(search.trim());
    return all.filter((p) =>
      norm(p.product).includes(q) ||
      norm(p.pid).includes(q) ||
      norm(p.category ?? "").includes(q),
    );
  }, [list, search]);

  return {
    specialProducts: list ?? [],
    filteredProducts,
    productsLoading: isLoading,
    productSearch: search,
    setProductSearch: setSearch,
    suggestions: suggestions ?? [],
    suggestionsLoading,
    suggestQ,
    setSuggestQ,
    excludeProducts: exclude,
    reintegrateProducts: reintegrate,
    isExcludingProducts: excluding,
    isReintegratingProducts: reintegrating,
  };
}

/** BL-exclusion state for the "Bons de livraison" tab of Produits Spéciaux.
 *  Owner-managed, reversible. Excluding a BL removes its Achats from every
 *  purchase aggregate (dashboard / analyse / stock) via the backend
 *  achat_bl_filter — so we invalidate the same caches produit-exclusion does. */

export function useBlExclusions() {
  const t = useT();
  const queryClient = useQueryClient();
  const [search,   setSearch]   = useState("");   // filters the excluded-BL table
  const [searchQ,  setSearchQ]  = useState("");    // exclude-dialog search box

  const {
    data: list,
    isLoading,
  } = useQuery({
    queryKey: QUERIES.blExclusions.list,
    queryFn:  () => api.get<BlExclusion[]>(URLS.blExclusions.list),
  });

  const {
    data: results,
    isFetching: resultsLoading,
  } = useQuery({
    queryKey:  QUERIES.blExclusions.search(searchQ),
    queryFn:   () => api.get<BlSummary[]>(URLS.blExclusions.search, { params: { q: searchQ } }),
    enabled:   searchQ.trim().length >= 2,
    staleTime: 30_000,
  });

  // Excluding/reintegrating a BL shifts every purchase aggregate → invalidate
  // the same caches the product-exclusion flow does.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: QUERIES.blExclusions.list });
    queryClient.invalidateQueries({ queryKey: QUERIES.blExclusions.searchAll });
    queryClient.invalidateQueries({ queryKey: QUERIES.stats.mainAll });
    queryClient.invalidateQueries({ queryKey: QUERIES.stats.marginAlertsAll });
    queryClient.invalidateQueries({ queryKey: QUERIES.stats.analyseMargeAll });
    queryClient.invalidateQueries({ queryKey: QUERIES.stats.stockSummary });
    queryClient.invalidateQueries({ queryKey: QUERIES.stats.stockAbcdFullAll });
    queryClient.invalidateQueries({ queryKey: QUERIES.stats.stockAbcdFilteredAll });
    queryClient.invalidateQueries({ queryKey: QUERIES.achats.listAll });
    queryClient.invalidateQueries({ queryKey: QUERIES.ventes.listAll });
  };

  const {
    mutate: exclude,
    isPending: excluding,
  } = useMutation({
    mutationFn: (v: { ref: string; notes?: string }) =>
      api.post<BlExclusionResult>(URLS.blExclusions.list, { delivery_ref: v.ref, notes: v.notes || null }),
    onSuccess:  (r) => {
      toast.success(r.already_excluded ? t("ps.blAlreadyExcluded") : t("ps.blExcluded", { ref: r.item?.delivery_ref ?? "" }));
      setSearchQ("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const {
    mutate: reintegrate,
    isPending: reintegrating,
  } = useMutation({
    mutationFn: (refs: string[]) =>
      api.post<BlReintegrateResult>(URLS.blExclusions.reintegrate, { delivery_refs: refs }),
    onSuccess:  (r) => {
      const n = r.reintegrated;
      toast.success(t(n === 1 ? "ps.blReintegratedOne" : "ps.blReintegratedMany", { n }));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const filtered = useMemo(() => {
    const all = list ?? [];
    if (!search.trim()) return all;
    const q = norm(search.trim());
    return all.filter((b) =>
      norm(b.delivery_ref).includes(q) ||
      norm(b.supplier ?? "").includes(q) ||
      norm(b.notes ?? "").includes(q),
    );
  }, [list, search]);

  return {
    blExclusions: list ?? [],
    filteredBls: filtered,
    blsLoading: isLoading,
    blSearch: search,
    setBlSearch: setSearch,
    blSearchQ: searchQ,
    setBlSearchQ: setSearchQ,
    blResults: results ?? [],
    blResultsLoading: resultsLoading,
    excludeBl: (ref: string, notes?: string) => exclude({ ref, notes }),
    reintegrateBls: reintegrate,
    isExcludingBl: excluding,
    isReintegratingBls: reintegrating,
  };
}

/** Supplier-exclusion state for the "Fournisseurs" tab of Produits Spéciaux.
 *  Owner-managed, reversible. Excluding a supplier removes its Achats from every
 *  purchase aggregate (dashboard / analyse / stock) via the backend
 *  achat_supplier_filter — so we invalidate the same caches BL-exclusion does. */

export function useSupplierExclusions() {
  const t = useT();
  const queryClient = useQueryClient();
  const [search,  setSearch]  = useState("");   // filters the excluded-supplier table
  const [searchQ, setSearchQ] = useState("");   // exclude-dialog search box

  const {
    data: list,
    isLoading,
  } = useQuery({
    queryKey: QUERIES.supplierExclusions.list,
    queryFn:  () => api.get<SupplierExclusion[]>(URLS.supplierExclusions.list),
  });

  const {
    data: results,
    isFetching: resultsLoading,
  } = useQuery({
    queryKey:  QUERIES.supplierExclusions.search(searchQ),
    queryFn:   () => api.get<SupplierSummary[]>(URLS.supplierExclusions.search, { params: { q: searchQ } }),
    enabled:   searchQ.trim().length >= 2,
    staleTime: 30_000,
  });

  // Excluding/reintegrating a supplier shifts every purchase aggregate →
  // invalidate the same caches the BL-exclusion flow does.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: QUERIES.supplierExclusions.list });
    queryClient.invalidateQueries({ queryKey: QUERIES.supplierExclusions.searchAll });
    queryClient.invalidateQueries({ queryKey: QUERIES.stats.mainAll });
    queryClient.invalidateQueries({ queryKey: QUERIES.stats.marginAlertsAll });
    queryClient.invalidateQueries({ queryKey: QUERIES.stats.analyseMargeAll });
    queryClient.invalidateQueries({ queryKey: QUERIES.stats.stockSummary });
    queryClient.invalidateQueries({ queryKey: QUERIES.stats.stockAbcdFullAll });
    queryClient.invalidateQueries({ queryKey: QUERIES.stats.stockAbcdFilteredAll });
    queryClient.invalidateQueries({ queryKey: QUERIES.achats.listAll });
    queryClient.invalidateQueries({ queryKey: QUERIES.ventes.listAll });
  };

  const {
    mutate: exclude,
    isPending: excluding,
  } = useMutation({
    mutationFn: (v: { supplier: string; notes?: string }) =>
      api.post<SupplierExclusionResult>(URLS.supplierExclusions.list, { supplier: v.supplier, notes: v.notes || null }),
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

  const {
    mutate: reintegrate,
    isPending: reintegrating,
  } = useMutation({
    mutationFn: (suppliers: string[]) =>
      api.post<SupplierReintegrateResult>(URLS.supplierExclusions.reintegrate, { suppliers }),
    onSuccess:  (r) => {
      const verb = r.reintegrated === 1 ? t("ps.supReintegratedOne") : t("ps.supReintegratedMany");
      toast.success(`${r.reintegrated} ${verb}`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const all = list ?? [];
    if (!search.trim()) return all;
    return all.filter((s) => matchesFields([s.supplier, s.notes ?? ""], search));
  }, [list, search]);

  return {
    supplierExclusions: list ?? [],
    filteredSuppliers: filtered,
    suppliersLoading: isLoading,
    supplierSearch: search,
    setSupplierSearch: setSearch,
    supplierSearchQ: searchQ,
    setSupplierSearchQ: setSearchQ,
    supplierResults: results ?? [],
    supplierResultsLoading: resultsLoading,
    excludeSupplier: (supplier: string, notes?: string) => exclude({ supplier, notes }),
    reintegrateSuppliers: reintegrate,
    isExcludingSupplier: excluding,
    isReintegratingSuppliers: reintegrating,
  };
}
