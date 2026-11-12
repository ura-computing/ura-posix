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
  type ProductHistoryResponse,
  type ProductNote,
  type ProductSheet,
  type ProductStats,
} from "@/types";
import { PERIOD_PRESETS, currentYear, presetOf, type PeriodPreset } from "@/utils/dateRange";

export const SHEET_TABS = ["general", "stats", "movements", "codes", "history"] as const;
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

export interface StatsRange {
  from: string | null;
  to: string | null;
}

/** The page dates (the Ventes date picker, in the toolbar under the tabs): « Performance »,
 *  Statistiques and Traçabilité. The current year first (1 January → today); kept while switching tabs.
 *  Its own: the Ventes / Achats dates do not move. */
export function useStatsRange() {
  const [range, setRangeState] = useState<StatsRange>(() => currentYear());
  const setRange = (from: string | null, to: string | null) => setRangeState({ from, to });
  return {
    range,
    setRange,
    period: presetOf(range.from, range.to), // « Période » (utils/dateRange.ts)
    setPeriod: (k: PeriodPreset) => setRangeState(PERIOD_PRESETS[k]()),
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
  limit: 20,
  search: "",
  kind: "all",
  order: "date",
  sort_by: null,
  sort_order: "desc",
};

/** « Traçabilité »: one product's purchase / sale lines, filtered (type, the page dates, search),
 *  sorted by date or by type, 20 per page. « Voir tout le ticket / BL » opens it in Ventes / Achats:
 *  every period, that number only. */
export function useMovements(id: number, { from, to }: StatsRange) {
  const navigate = useNavigate();
  const { me } = useMe();
  const { setRange } = useGlobalDateRange();
  const { filters: local, patch, setPage, setPageSize, reset: resetLocal } = useListFilters(DEFAULT_MOVES, "desc");
  const filters: MovementsFilters = useMemo(() => ({ ...local, date_from: from, date_to: to }), [local, from, to]);

  const { data, isLoading } = useQuery({
    queryKey: API.products.movements.key(id, filters),
    queryFn: () =>
      api.get<ProductMovementsResponse>(API.products.movements.url(id), {
        params: {
          date_from: from,
          date_to: to,
          kind: filters.kind,
          search: filters.search,
          order: filters.order,
          page: filters.page,
          limit: filters.limit,
        },
      }),
  });

  // Every filter change goes back to page 1 (`patch`); the dates are the page's (Général, Statistiques).
  const setSearch = (search: string) => patch({ search });
  const setKind = (kind: MovementsFilters["kind"]) => patch({ kind });
  const setOrder = (order: MovementsFilters["order"]) => patch({ order });
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
    setOrder,
    setPage,
    setPageSize,
    reset: resetLocal,
    canSeeDetail,
    seeDetail,
    rows: data?.data ?? [],
    total: data?.pagination.total ?? 0,
    isLoading,
  };
}

// ── « Historique » ──────────────────────────────────────────────────────────

/** A product's « Historique » tab: its edits, observations and the imports that brought its
 *  lines, newest first, 20 a page. */
export function useProductHistory(id: number) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.products.history.key(id, page),
    queryFn: () => api.get<ProductHistoryResponse>(API.products.history.url(id), { params: { page, limit: 20 } }),
    placeholderData: keepPreviousData,
  });
  return {
    rows: data?.data ?? [],
    total: data?.pagination.total ?? 0,
    page,
    setPage,
    isLoading,
    isError,
    reload: () => void refetch(),
  };
}

// ── « Observations » ────────────────────────────────────────────────────────

/** A product's « Observations » (asked when `enabled`: their window is open); add one, delete one
 *  (its author or the owner). The sheet's count and the list's icon follow. */
export function useProductNotes(id: number, enabled: boolean) {
  const t = useT();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: API.products.notes.key(id),
    queryFn: () => api.get<ProductNote[]>(API.products.notes.url(id)),
    enabled,
  });
  const { mutateAsync: addNote, isPending: isAdding } = useMutation({
    mutationFn: (text: string) => api.post<ProductNote>(API.products.addNote.url(id), { text }),
    onSuccess: () => {
      toast.success(t("products.noteSaved"));
      void refresh(qc, API.products.addNote);
    },
  });
  const { mutateAsync: deleteNote, isPending: isDeleting } = useMutation({
    mutationFn: (noteId: number) => api.delete(API.products.deleteNote.url(id, noteId)),
    onSuccess: () => {
      toast.success(t("products.noteDeleted"));
      void refresh(qc, API.products.deleteNote);
    },
  });
  return {
    notes: data ?? [],
    isLoading,
    addNote,
    isAdding,
    deleteNote,
    isDeleting,
  };
}

// ── « Modifier » (owner) ────────────────────────────────────────────────────

// The values the page shows and the owner can change (PPH and description are no longer on the
// page: their edits stay as they are).
const EDIT_FIELDS = [
  "product",
  "laboratoire",
  "category",
  "tva",
  "ppv",
  "current_stock",
  "stock_min",
  "stock_max",
  "zone",
  "expiry_date",
  "barcode1",
  "barcode2",
] as const satisfies readonly EditField[];
export type FormField = (typeof EDIT_FIELDS)[number];
export type EditValues = Record<FormField, string>;

const INTEGERS: FormField[] = ["current_stock", "stock_min", "stock_max"];

const decimal = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));
/** « 2027-03-31 » ⇄ « 31/03/2027 » (the date typed in the form). */
export const isoToTyped = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "");
const TYPED_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
export function typedToIso(typed: string): string | null {
  const m = TYPED_DATE.exec(typed.trim());
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

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
    zone: s.stock.zone ?? "",
    expiry_date: isoToTyped(s.stock.expiry_date),
    barcode1: s.barcode1 ?? "",
    barcode2: s.barcode2 ?? "",
  };
}

/** A changed input → what PUT /products/{id} takes. Empty = back to the imported value. */
function toApi(field: FormField, raw: string): string | number | null {
  const v = raw.trim();
  if (!v) return null;
  if (field === "ppv") return Number(v.replace(/\s/g, "").replace(",", "."));
  if (field === "expiry_date") return typedToIso(v);
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
      expiry_date: z.string().refine((v) => !v.trim() || typedToIso(v) != null, t("products.invalidDate")),
    })
    .refine((v) => !v.stock_min.trim() || !v.stock_max.trim() || Number(v.stock_min) <= Number(v.stock_max), {
      path: ["stock_min"],
      message: t("errors.stockMinAboveMax"),
    });
}

/** The owner's « Modifier »: a form over what the sheet shows; « Enregistrer » sends the changed
 *  fields only; « Revenir à la valeur importée » clears one edit. Employees: read only. */
/** The sheet's editable blocks, each with its own « Modifier »: « Identité », « Prix et marge », « Stock et
 *  réappro » (Général) and « Identifiants » (Codes). */
export type EditSection = "identity" | "prices" | "stock" | "codes";

export function useSheetEditor(sheet: ProductSheet | null) {
  const t = useT();
  const qc = useQueryClient();
  const { me } = useMe();
  // The block being edited (one at a time), its « Modifier » / « Enregistrer » next to it.
  const [section, setSection] = useState<EditSection | null>(null);
  const form = useForm<EditValues>();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: ({ id, body }: { id: number; body: ProductEditIn }) =>
      api.put<ProductSheet>(API.products.save.url(id), body),
    onSuccess: (saved) => {
      qc.setQueryData(API.products.sheet.key(saved.id), saved);
      void refresh(qc, API.products.save);
    },
  });

  const start = (block: EditSection) => {
    if (!sheet) return;
    form.reset(toForm(sheet));
    setSection(block);
  };
  const cancel = () => setSection(null);

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
    setSection(null);
  };

  const revert = async (field: FormField) => {
    if (sheet) await mutateAsync({ id: sheet.id, body: { [field]: null } });
  };

  return {
    canEdit: me?.role === "owner",
    section,
    start,
    cancel,
    save,
    revert,
    isSaving: isPending,
    form,
  };
}

export type SheetEditor = ReturnType<typeof useSheetEditor>;
