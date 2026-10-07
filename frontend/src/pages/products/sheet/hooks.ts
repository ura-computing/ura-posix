import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { api, ApiErr } from "@/api/client";
import { API, refresh } from "@/api/api";
import { useGlobalDateRange } from "@/hooks/useGlobalDateRange";
import { useListFilters } from "@/hooks/useListFilters";
import { useMe } from "@/hooks/useMe";
import { useT, type TFn } from "@/i18n/I18nProvider";
import type {
  EditField,
  MovementsFilters,
  ProductEditIn,
  ProductMovementsResponse,
  ProductSheet,
  ProductStats,
} from "@/types";
import { downloadXlsx, exportFilename } from "@/utils/table";

export const SHEET_TABS = ["general", "stats", "movements", "codes"] as const;
export type SheetTab = (typeof SHEET_TABS)[number];

/** One product's sheet, its statistics (« Ventes par mois » + Statistiques tab) and the
 *  tab in the URL (`?tab=codes`, kept on reload / back). */
export function useProduitPage(id: number) {
  const valid = Number.isInteger(id) && id > 0;
  const { data, isLoading, error } = useQuery({
    queryKey: API.products.sheet.key(id),
    queryFn: () => api.get<ProductSheet>(API.products.sheet.url(id)),
    enabled: valid,
  });
  const { data: stats } = useQuery({
    queryKey: API.products.stats.key(id),
    queryFn: () => api.get<ProductStats>(API.products.stats.url(id)),
    enabled: valid && !!data,
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
    stats: stats ?? null,
    isLoading,
    // Not one of the pharmacy's products (or a wrong address): the 404 inside the layout.
    notFound: !valid || (error instanceof ApiErr && error.status === 404),
    tab,
    setTab,
  };
}

const DEFAULT_MOVES: Omit<MovementsFilters, "date_from" | "date_to"> = {
  page: 1,
  limit: 25,
  search: "",
  kind: "all",
  sort_by: null,
  sort_order: "desc",
};

/** Query string of the movements call (no sort: always newest first). */
const toParams = (f: MovementsFilters) => ({
  date_from: f.date_from,
  date_to: f.date_to,
  kind: f.kind,
  search: f.search,
  page: f.page,
  limit: f.limit,
});

/** « Mouvements »: one product's purchase / sale lines, filtered (period shared with the other
 *  pages, type, search), paged; Excel = every filtered line. */
export function useMovements(id: number, pid: string) {
  const t = useT();
  const { from, to, setRange } = useGlobalDateRange();
  const { filters: local, patch, setPage, setPageSize, reset: resetLocal } = useListFilters(DEFAULT_MOVES, "desc");
  const filters: MovementsFilters = useMemo(() => ({ ...local, date_from: from, date_to: to }), [local, from, to]);

  const { data, isLoading } = useQuery({
    queryKey: API.products.movements.key(id, filters),
    queryFn: () => api.get<ProductMovementsResponse>(API.products.movements.url(id), { params: toParams(filters) }),
  });

  // Every filter change goes back to page 1 (`patch`); the period is shared between pages.
  const setSearch = (search: string) => patch({ search });
  const setKind = (kind: MovementsFilters["kind"]) => patch({ kind });
  const reset = () => {
    resetLocal();
    setRange(null, null);
  };

  const handleExport = useCallback(async () => {
    try {
      const { data: lines } = await api.get<ProductMovementsResponse>(API.products.movements.url(id), {
        params: { ...toParams(filters), page: undefined, limit: undefined, export: true },
      });
      const header = [
        "Date",
        "Type",
        "Quantité",
        "Prix unitaire",
        "Total",
        "Document",
        "Fournisseur / client",
        "Fichier importé",
      ];
      const body = lines.map((m) => [
        m.date ?? "",
        m.kind === "achat" ? "Achat" : "Vente",
        m.quantity ?? "",
        m.unit_price ?? "",
        m.total ?? "",
        m.document ?? "",
        m.party ?? "",
        m.filename ?? "",
      ]);
      await downloadXlsx([header, ...body], exportFilename(`MOUVEMENTS ${pid}`, "xlsx", from, to));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("products.exportFailed"));
    }
  }, [id, pid, filters, from, to, t]);

  return {
    filters,
    setSearch,
    setKind,
    setDateRange: setRange,
    setPage,
    setPageSize,
    reset,
    handleExport,
    rows: data?.data ?? [],
    total: data?.pagination.total ?? 0,
    unitsBought: data?.units_bought ?? 0,
    unitsSold: data?.units_sold ?? 0,
    isLoading,
  };
}

// ── « Modifier » (owner) ────────────────────────────────────────────────────

export type EditValues = Record<EditField, string>;

const EDIT_FIELDS: EditField[] = [
  "product",
  "laboratoire",
  "category",
  "tva",
  "ppv",
  "pph",
  "zone",
  "current_stock",
  "stock_min",
  "stock_max",
  "expiry_date",
  "barcode1",
  "barcode2",
  "description",
];
const PRICES: EditField[] = ["ppv", "pph"];
const INTEGERS: EditField[] = ["current_stock", "stock_min", "stock_max"];

const decimal = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));
const isoToFr = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "");

/** The form starts from what the sheet shows (edited or imported). */
function toForm(s: ProductSheet): EditValues {
  return {
    product: s.product,
    laboratoire: s.laboratoire ?? "",
    category: s.category ?? "",
    tva: s.tva ?? "",
    ppv: decimal(s.prices.ppv),
    pph: decimal(s.prices.pph),
    zone: s.stock.zone ?? "",
    current_stock: s.stock.current_stock == null ? "" : String(s.stock.current_stock),
    stock_min: String(s.stock.stock_min),
    stock_max: String(s.stock.stock_max),
    expiry_date: isoToFr(s.stock.expiry_date),
    barcode1: s.barcode1 ?? "",
    barcode2: s.barcode2 ?? "",
    description: s.info?.description ?? "",
  };
}

/** A changed input → what PUT /products/{id} takes. Empty = back to the imported value. */
function toApi(field: EditField, raw: string): string | number | null {
  const v = raw.trim();
  if (!v) return null;
  if (PRICES.includes(field)) return Number(v.replace(/\s/g, "").replace(",", "."));
  if (INTEGERS.includes(field)) return Number(v.replace(/\s/g, ""));
  if (field === "expiry_date") return v.split("/").reverse().join("-");
  return v;
}

function validDate(v: string): boolean {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim());
  if (!m) return false;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return d.getDate() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1;
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
      pph: price,
      current_stock: count(true),
      stock_min: count(false),
      stock_max: count(false),
      expiry_date: z.string().refine((v) => !v.trim() || validDate(v), t("products.invalidDate")),
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
        form.setError(issue.path[0] as EditField, { message: issue.message });
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

  const revert = async (field: EditField) => {
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
