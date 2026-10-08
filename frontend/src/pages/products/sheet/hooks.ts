import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { api, ApiErr } from "@/api/client";
import { API, refresh } from "@/api/api";
import { useGlobalDateRange } from "@/hooks/useGlobalDateRange";
import { useListFilters } from "@/hooks/useListFilters";
import { useMe } from "@/hooks/useMe";
import { useT, type TFn } from "@/i18n/I18nProvider";
import {
  ROUTES,
  type EditField,
  type MovementsFilters,
  type ProductEditIn,
  type ProductMovementLine,
  type ProductMovementsResponse,
  type ProductSheet,
  type ProductStats,
} from "@/types";
import { dayAfter, daysAgo, monthsAgo, todayIso } from "@/utils/dateRange";

export const SHEET_TABS = ["general", "stats", "movements", "codes"] as const;
export type SheetTab = (typeof SHEET_TABS)[number];

/** One product's sheet and the tab in the URL (`?tab=codes`, kept on reload / back). */
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

// ── Statistiques ────────────────────────────────────────────────────────────

export const STATS_PERIODS = ["7d", "30d", "3m", "12m", "custom"] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];
export interface StatsRange {
  from: string | null;
  to: string | null;
}

/** A period button → its dates: the last 7 / 30 days or 3 / 12 months, today included
 *  (« 3 mois » on 08/10/2026 = 09/07/2026 → 08/10/2026). */
function presetRange(period: Exclude<StatsPeriod, "custom">): StatsRange {
  const to = todayIso();
  if (period === "7d") return { from: daysAgo(6), to };
  if (period === "30d") return { from: daysAgo(29), to };
  return { from: dayAfter(monthsAgo(period === "3m" ? 3 : 12)), to };
}

/** The Statistiques period (buttons on the tab row): 30 days first; « Personnalisé » starts from
 *  the dates shown, then the two date fields change it. Kept while switching tabs. */
export function useStatsPeriod() {
  const [period, setPeriodState] = useState<StatsPeriod>("30d");
  const [custom, setCustom] = useState<StatsRange>(() => presetRange("30d"));
  const range = period === "custom" ? custom : presetRange(period);
  const setPeriod = (next: StatsPeriod) => {
    if (next === "custom" && period !== "custom") setCustom(range);
    setPeriodState(next);
  };
  const setCustomRange = (from: string | null, to: string | null) => setCustom({ from, to });
  return {
    period,
    setPeriod,
    range,
    setCustomRange,
  };
}

/** One product's statistics over a period, asked with the sheet (`enabled` once it is there):
 *  « Statistiques » opens at once, without a « Chargement… » first. Nothing asked while a custom
 *  date is missing. */
export function useProductStats(id: number, { from, to }: StatsRange, enabled: boolean) {
  const { data } = useQuery({
    queryKey: API.products.stats.key(id, from ?? "", to ?? ""),
    queryFn: () => api.get<ProductStats>(API.products.stats.url(id), { params: { date_from: from, date_to: to } }),
    enabled: enabled && !!from && !!to,
    placeholderData: keepPreviousData,
  });
  return {
    stats: from && to ? (data ?? null) : null,
  };
}

const DEFAULT_MOVES: Omit<MovementsFilters, "date_from" | "date_to"> = {
  page: 1,
  limit: 10,
  search: "",
  kind: "all",
  sort_by: null,
  sort_order: "desc",
};

/** « Mouvements »: one product's purchase / sale lines, filtered (type, period shared with the
 *  other pages, search), 10 per page. « Voir détail » opens the whole ticket (Ventes) or BL
 *  (Achats): every period, that number only. */
export function useMovements(id: number) {
  const navigate = useNavigate();
  const { me } = useMe();
  const { from, to, setRange } = useGlobalDateRange();
  const { filters: local, patch, setPage, setPageSize, reset: resetLocal } = useListFilters(DEFAULT_MOVES, "desc");
  const filters: MovementsFilters = useMemo(() => ({ ...local, date_from: from, date_to: to }), [local, from, to]);

  const { data, isLoading } = useQuery({
    queryKey: API.products.movements.key(id, filters),
    queryFn: () =>
      api.get<ProductMovementsResponse>(API.products.movements.url(id), {
        // No sort: always newest first.
        params: {
          date_from: from,
          date_to: to,
          kind: filters.kind,
          search: filters.search,
          page: filters.page,
          limit: filters.limit,
        },
      }),
  });

  // Every filter change goes back to page 1 (`patch`); the period is shared between pages.
  const setSearch = (search: string) => patch({ search });
  const setKind = (kind: MovementsFilters["kind"]) => patch({ kind });
  const reset = () => {
    resetLocal();
    setRange(null, null);
  };
  /** Ventes / Achats open for this user (an employee may not have them). */
  const canSeeDetail = (kind: ProductMovementLine["kind"]) =>
    me?.role === "admin" || !!me?.permissions.includes(kind === "achat" ? "achats" : "ventes");
  const seeDetail = (m: ProductMovementLine) => {
    if (!m.document) return;
    setRange(null, null);
    navigate(`${m.kind === "achat" ? ROUTES.ACHATS : ROUTES.VENTES}?ref=${encodeURIComponent(m.document)}`);
  };

  return {
    filters,
    setSearch,
    setKind,
    setDateRange: setRange,
    setPage,
    setPageSize,
    reset,
    canSeeDetail,
    seeDetail,
    rows: data?.data ?? [],
    total: data?.pagination.total ?? 0,
    isLoading,
  };
}

// ── Codes ───────────────────────────────────────────────────────────────────

/** « Scanner / Rechercher un code barre »: a PID or barcode (typed, or a USB scanner = digits +
 *  Entrée) → that product's sheet. Resolves false when no product of the pharmacy has it, null
 *  when the search failed (error toast). */
export function useBarcodeLookup() {
  const t = useT();
  const navigate = useNavigate();
  const [isSearching, setSearching] = useState(false);
  const lookup = async (raw: string): Promise<boolean | null> => {
    const code = raw.trim();
    if (!code) return false;
    setSearching(true);
    try {
      // Called directly, not through the query cache: « no product » is an answer shown in the
      // dialog, not an error toast.
      const { id } = await api.get<{ id: number }>(API.products.lookup.url, { params: { code } });
      navigate(ROUTES.PRODUIT.replace(":id", String(id)));
      return true;
    } catch (e) {
      if (e instanceof ApiErr && e.status === 404) return false;
      toast.error(e instanceof ApiErr ? e.detail : t("toast.genericError"));
      return null;
    } finally {
      setSearching(false);
    }
  };
  return {
    lookup,
    isSearching,
  };
}

// ── « Modifier » (owner) ────────────────────────────────────────────────────

// The values the page shows and the owner can change (PPH, zone, péremption and description
// are no longer on the page: their edits stay as they are).
const EDIT_FIELDS = [
  "product",
  "laboratoire",
  "category",
  "tva",
  "ppv",
  "current_stock",
  "stock_min",
  "stock_max",
  "barcode1",
  "barcode2",
] as const satisfies readonly EditField[];
export type FormField = (typeof EDIT_FIELDS)[number];
export type EditValues = Record<FormField, string>;

const INTEGERS: FormField[] = ["current_stock", "stock_min", "stock_max"];

const decimal = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));

/** The form starts from what the sheet shows (edited or imported). */
function toForm(s: ProductSheet): EditValues {
  return {
    product: s.product,
    laboratoire: s.laboratoire ?? "",
    category: s.category ?? "",
    tva: s.tva ?? "",
    ppv: decimal(s.prices.ppv),
    current_stock: s.stock.current_stock == null ? "" : String(s.stock.current_stock),
    stock_min: String(s.stock.stock_min),
    stock_max: String(s.stock.stock_max),
    barcode1: s.barcode1 ?? "",
    barcode2: s.barcode2 ?? "",
  };
}

/** A changed input → what PUT /products/{id} takes. Empty = back to the imported value. */
function toApi(field: FormField, raw: string): string | number | null {
  const v = raw.trim();
  if (!v) return null;
  if (field === "ppv") return Number(v.replace(/\s/g, "").replace(",", "."));
  if (INTEGERS.includes(field)) return Number(v.replace(/\s/g, ""));
  return v;
}

function editSchema(t: TFn) {
  const price = z
    .string()
    .refine((v) => !v.trim() || /^\d+([.,]\d{1,2})?$/.test(v.replace(/\s/g, "")), t("products.invalidPrice"));
  const count = (signed: boolean) =>
    z
      .string()
      .refine((v) => !v.trim() || (signed ? /^-?\d+$/ : /^\d+$/).test(v.replace(/\s/g, "")), t("products.invalidInt"));
  return z
    .object({
      ppv: price,
      current_stock: count(true),
      stock_min: count(false),
      stock_max: count(false),
    })
    .refine((v) => !v.stock_min.trim() || !v.stock_max.trim() || Number(v.stock_min) <= Number(v.stock_max), {
      path: ["stock_min"],
      message: t("errors.stockMinAboveMax"),
    });
}

/** The owner's « Modifier »: a form over what the sheet shows; « Enregistrer » sends the changed
 *  fields only; « Revenir à la valeur importée » clears one edit. Employees: read only. */
export function useSheetEditor(sheet: ProductSheet | null) {
  const t = useT();
  const qc = useQueryClient();
  const { me } = useMe();
  const [editing, setEditing] = useState(false);
  const form = useForm<EditValues>();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: ({ id, body }: { id: number; body: ProductEditIn }) =>
      api.put<ProductSheet>(API.products.save.url(id), body),
    onSuccess: (saved) => {
      qc.setQueryData(API.products.sheet.key(saved.id), saved);
      void refresh(qc, API.products.save);
    },
  });

  const start = () => {
    if (!sheet) return;
    form.reset(toForm(sheet));
    setEditing(true);
  };
  const cancel = () => setEditing(false);

  const save = async () => {
    if (!sheet) return;
    const values = form.getValues();
    form.clearErrors();
    const checked = editSchema(t).safeParse(values);
    if (!checked.success) {
      for (const issue of checked.error.issues) {
        form.setError(issue.path[0] as FormField, { message: issue.message });
      }
      return;
    }
    const before = toForm(sheet);
    const body: ProductEditIn = {};
    for (const f of EDIT_FIELDS) if (values[f] !== before[f]) body[f] = toApi(f, values[f]);
    if (Object.keys(body).length > 0) {
      await mutateAsync({ id: sheet.id, body });
      toast.success(t("products.saved"));
    }
    setEditing(false);
  };

  const revert = async (field: FormField) => {
    if (sheet) await mutateAsync({ id: sheet.id, body: { [field]: null } });
  };

  return {
    canEdit: me?.role === "owner",
    editing,
    start,
    cancel,
    save,
    revert,
    isSaving: isPending,
    form,
  };
}

export type SheetEditor = ReturnType<typeof useSheetEditor>;
