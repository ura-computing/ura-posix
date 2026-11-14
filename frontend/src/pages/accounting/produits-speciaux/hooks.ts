/** /produits-speciaux: one tab per kind (a product, a BL, a product on some of its BLs, a supplier),
 *  each with its search, ONE click to exclude (« Annuler » in the message), and its list of what is
 *  excluded (« Réintégrer », « Ajouter une note »). Owner-managed, reversible: nothing is deleted.
 *  Each write refreshes the reads it changes (`API.*.exclude.refreshes`). */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/api/client";
import { API, refresh } from "@/api/api";
import { useT } from "@/i18n/I18nProvider";
import type {
  BlDetail,
  BlExclusion,
  BlLineExclusion,
  BlLineExclusionResult,
  BlSummary,
  MedicamentSuggestion,
  SpecialProduct,
  SupplierExclusion,
  SupplierSummary,
} from "@/types";
import { formatDate, formatNumStr } from "@/utils/format";

export type ExclusionKind = "product" | "bl" | "supplier" | "line";

/** What one click excludes / reintegrates. A line = one product on one BL (its exclusion ids once
 *  excluded: « Réintégrer » and « Annuler » use them). */
export type ExclusionTarget =
  | { kind: "product"; medicamentId: number; name: string }
  | { kind: "bl"; ref: string; name: string }
  | { kind: "supplier"; supplier: string; name: string }
  | { kind: "line"; medicamentId: number; ref: string; ids: number[]; name: string };

/** One excluded thing, whatever its kind, in the « Déjà exclus » list. */
export interface ExcludedRow {
  key: string;
  target: ExclusionTarget;
  name: string;
  /** « PID · Catégorie », « Fournisseur · date · 12 lignes »… */
  detail: string;
  total: number | null;
  notes: string | null;
  created_at: string;
}

/** Each kind's writes (their `refreshes` = the reads that change). */
const WRITES = {
  product: API.specialProducts,
  bl: API.blExclusions,
  supplier: API.supplierExclusions,
  line: API.blLineExclusions,
} as const;

async function excludeOne(x: ExclusionTarget): Promise<ExclusionTarget> {
  if (x.kind === "product") await api.post(API.specialProducts.exclude.url, { medicament_ids: [x.medicamentId] });
  else if (x.kind === "bl") await api.post(API.blExclusions.exclude.url, { delivery_ref: x.ref });
  else if (x.kind === "supplier") await api.post(API.supplierExclusions.exclude.url, { supplier: x.supplier });
  else {
    const r = await api.post<BlLineExclusionResult>(API.blLineExclusions.exclude.url, {
      medicament_id: x.medicamentId,
      delivery_refs: [x.ref],
    });
    return { ...x, ids: r.ids };
  }
  return x;
}

async function reintegrateOne(x: ExclusionTarget): Promise<ExclusionTarget> {
  if (x.kind === "product") await api.post(API.specialProducts.reintegrate.url, { medicament_ids: [x.medicamentId] });
  else if (x.kind === "bl") await api.post(API.blExclusions.reintegrate.url, { delivery_refs: [x.ref] });
  else if (x.kind === "supplier") await api.post(API.supplierExclusions.reintegrate.url, { suppliers: [x.supplier] });
  else await api.post(API.blLineExclusions.reintegrate.url, { ids: x.ids });
  return x;
}

function saveNoteOf(x: ExclusionTarget, notes: string) {
  if (x.kind === "product") return api.put(API.specialProducts.note.url, { medicament_id: x.medicamentId, notes });
  if (x.kind === "bl") return api.put(API.blExclusions.note.url, { delivery_ref: x.ref, notes });
  if (x.kind === "supplier") return api.put(API.supplierExclusions.note.url, { supplier: x.supplier, notes });
  return api.put(API.blLineExclusions.note.url, { id: x.ids[0], notes });
}

/** Everything excluded + the 3 actions (exclude, reintegrate, note), each with its message. */
export function useExclusions() {
  const t = useT();
  const qc = useQueryClient();

  const products = useQuery({
    queryKey: API.specialProducts.list.key,
    queryFn: () => api.get<SpecialProduct[]>(API.specialProducts.list.url),
  });
  const bls = useQuery({
    queryKey: API.blExclusions.list.key,
    queryFn: () => api.get<BlExclusion[]>(API.blExclusions.list.url),
  });
  const suppliers = useQuery({
    queryKey: API.supplierExclusions.list.key,
    queryFn: () => api.get<SupplierExclusion[]>(API.supplierExclusions.list.url),
  });
  const lines = useQuery({
    queryKey: API.blLineExclusions.list.key,
    queryFn: () => api.get<BlLineExclusion[]>(API.blLineExclusions.list.url),
  });

  const rows = useMemo<ExcludedRow[]>(() => {
    const out: ExcludedRow[] = [
      ...(products.data ?? []).map((p) => ({
        key: `product:${p.medicament_id}`,
        target: { kind: "product" as const, medicamentId: p.medicament_id, name: p.product },
        name: p.product,
        detail: [p.pid, p.category].filter(Boolean).join(" · "),
        total: null,
        notes: p.notes,
        created_at: p.created_at,
      })),
      ...(bls.data ?? []).map((b) => ({
        key: `bl:${b.delivery_ref}`,
        target: { kind: "bl" as const, ref: b.delivery_ref, name: b.delivery_ref },
        name: b.delivery_ref,
        detail: [b.supplier, formatDate(b.delivery_date)].filter(Boolean).join(" · "),
        total: b.total,
        notes: b.notes,
        created_at: b.created_at,
      })),
      ...(suppliers.data ?? []).map((s) => ({
        key: `supplier:${s.supplier}`,
        target: { kind: "supplier" as const, supplier: s.supplier, name: s.supplier },
        name: s.supplier,
        detail: t("ps.supplierDetail", { lines: formatNumStr(s.nb_lines), products: formatNumStr(s.nb_products) }),
        total: s.total,
        notes: s.notes,
        created_at: s.created_at,
      })),
      ...(lines.data ?? []).map((x) => ({
        key: `line:${x.id}`,
        target: {
          kind: "line" as const,
          medicamentId: x.medicament_id,
          ref: x.delivery_ref,
          ids: [x.id],
          name: x.product,
        },
        name: x.product,
        detail: [`BL ${x.delivery_ref}`, x.supplier, formatDate(x.delivery_date)].filter(Boolean).join(" · "),
        total: x.total,
        notes: x.notes,
        created_at: x.created_at,
      })),
    ];
    return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [products.data, bls.data, suppliers.data, lines.data, t]);

  const { mutate: exclude, isPending: isExcluding } = useMutation({
    mutationFn: excludeOne,
    onSuccess: (x) => {
      void refresh(qc, WRITES[x.kind].exclude);
      toast.success(t("ps.excludedToast", { name: x.name }), {
        action: { label: t("common.cancel"), onClick: () => reintegrate(x) },
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const { mutate: reintegrate, isPending: isReintegrating } = useMutation({
    mutationFn: reintegrateOne,
    onSuccess: (x) => {
      void refresh(qc, WRITES[x.kind].reintegrate);
      toast.success(t("ps.reintegratedToast", { name: x.name }), {
        action: { label: t("common.cancel"), onClick: () => exclude(x) },
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const { mutateAsync: saveNote } = useMutation({
    mutationFn: ({ target, notes }: { target: ExclusionTarget; notes: string }) => saveNoteOf(target, notes),
    onSuccess: (_, { target }) => {
      void refresh(qc, WRITES[target.kind].note);
      toast.success(t("ps.noteSaved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    excludedRows: rows,
    excludedLoading: products.isLoading || bls.isLoading || suppliers.isLoading || lines.isLoading,
    excludedError: products.isError || bls.isError || suppliers.isError || lines.isError,
    reloadExcluded: () => {
      for (const list of [products, bls, suppliers, lines]) if (list.isError) void list.refetch();
    },
    exclude,
    isExcluding,
    reintegrate,
    isReintegrating,
    saveNote: (target: ExclusionTarget, notes: string) => saveNote({ target, notes }),
  };
}

/** One tab's search (2+ letters), for its kind only: products (« Produits »), BLs (by reference or by a product
 *  they hold) or suppliers (« Fournisseurs », « BL par Fournisseur »). */
export function useExclusionSearch(kind: ExclusionKind) {
  const [q, setQ] = useState("");
  const ready = q.trim().length >= 2;
  const products = useQuery({
    queryKey: API.specialProducts.suggestions.key(q),
    queryFn: () => api.get<MedicamentSuggestion[]>(API.specialProducts.suggestions.url, { params: { q } }),
    enabled: ready && kind === "product",
    staleTime: 30_000,
  });
  const bls = useQuery({
    queryKey: API.blExclusions.search.key(q),
    queryFn: () => api.get<BlSummary[]>(API.blExclusions.search.url, { params: { q } }),
    enabled: ready && kind === "bl",
    staleTime: 30_000,
  });
  const suppliers = useQuery({
    queryKey: API.supplierExclusions.search.key(q),
    queryFn: () => api.get<SupplierSummary[]>(API.supplierExclusions.search.url, { params: { q } }),
    enabled: ready && (kind === "supplier" || kind === "line"),
    staleTime: 30_000,
  });
  return {
    q,
    setQ,
    ready,
    foundProducts: products.data ?? [],
    foundBls: bls.data ?? [],
    foundSuppliers: suppliers.data ?? [],
    isSearching: products.isFetching || bls.isFetching || suppliers.isFetching,
  };
}

/** The product lines of one BL (« Voir le contenu »). */
export function useBlDetail(deliveryRef: string) {
  const { data, isLoading, isError } = useQuery({
    queryKey: API.blExclusions.detail.key(deliveryRef),
    queryFn: () => api.get<BlDetail>(API.blExclusions.detail.url, { params: { delivery_ref: deliveryRef } }),
  });
  return {
    blLines: data?.lines ?? [],
    isLoadingLines: isLoading,
    linesError: isError,
  };
}

/** Every BL of one supplier, newest first (« BL par Fournisseur » → « Voir ses BL »). */
export function useSupplierBls(supplier: string) {
  const { data, isLoading, isError } = useQuery({
    queryKey: API.blExclusions.ofSupplier.key(supplier),
    queryFn: () => api.get<BlSummary[]>(API.blExclusions.ofSupplier.url, { params: { supplier } }),
  });
  return {
    supplierBls: data ?? [],
    isLoadingBls: isLoading,
    blsError: isError,
  };
}
