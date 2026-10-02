import { useState, useEffect, useMemo } from "react";
import {
  Building2,
  FileText,
  Package,
  Plus,
  Undo2,
  ArrowLeft,
  Loader2,
  Search,
  X,
} from "lucide-react";

import { AsyncButton } from "@/_components/AsyncButton";
import { DataTable, type ColumnDef } from "@/_components/DataTable";
import { FilterBar, type ActiveFilter } from "@/_components/filterBar";
import { formatMAD, formatQty } from "@/utils/format";
import type {
  BlDetail,
  BlExclusion,
  SpecialProduct,
  SupplierExclusion,
  BlSummary,
  MedicamentSuggestion,
  SupplierSummary,
} from "@/types";

import { useBlExclusions, useProduitsSpeciaux, useSupplierExclusions } from "./hooks";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/_components/dialog";
import { TabBar } from "@/_components/TabBar";
import { api } from "@/api/client";
import { URLS } from "@/api/urls";
import { QUERY_KEYS } from "@/types";

/** "Exclure un BL" dialog — PG-007. Two steps:
 *   1. Search a delivery note by reference OR by a product it contains → pick one.
 *   2. Review the BL (supplier, date, product lines, total), add an optional
 *      note, and confirm. Non-destructive & reversible.
 */

interface ExcludeBlDialogProps {
  open:           boolean;
  onClose:        () => void;
  onSubmit:       (deliveryRef: string, notes?: string) => void;
  isLoading:      boolean;
  results:        BlSummary[];
  resultsLoading: boolean;
  searchQ:        string;
  onSearchChange: (q: string) => void;
}

function frDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function ExcludeBlDialog({
  open, onClose, onSubmit, isLoading,
  results, resultsLoading, searchQ, onSearchChange,
}: ExcludeBlDialogProps) {
  const t = useT();
  const [selected, setSelected] = useState<BlSummary | null>(null);
  const [notes,    setNotes]    = useState("");

  useEffect(() => {
    if (!open) { setSelected(null); setNotes(""); onSearchChange(""); }
  }, [open, onSearchChange]);

  const detail = useQuery({
    queryKey: QUERY_KEYS.BL_DETAIL(selected?.delivery_ref ?? ""),
    queryFn:  () => api.get<BlDetail>(URLS.blExclusions.detail, { params: { delivery_ref: selected!.delivery_ref } }),
    enabled:  open && !!selected,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isLoading && onClose()}>
      <DialogContent className="max-w-xl">
        <div className="flex flex-col gap-4 p-5">
          <header>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {t("ps.blTitle")}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("ps.blDesc")}</p>
          </header>

          {/* ── Step 1: search + pick ─────────────────────────────────────── */}
          {!selected ? (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input
                  type="text"
                  autoFocus
                  value={searchQ}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={t("ps.blSearchPh")}
                  className="block w-full rounded-md border border-input bg-surface-subtle py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                />
              </div>

              <div className="max-h-72 overflow-y-auto rounded-md border border-border bg-card">
                {searchQ.trim().length < 2 ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">
                    {t("ps.blMin2")}
                  </p>
                ) : resultsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : results.length === 0 ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">
                    {t("ps.blNoResult")}
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {results.map((b) => (
                      <li key={b.delivery_ref}>
                        <button
                          type="button"
                          disabled={b.already_excluded}
                          onClick={() => setSelected(b)}
                          className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <FileText className="size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-mono text-sm font-medium text-foreground">{b.delivery_ref}</span>
                              {b.already_excluded && (
                                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{t("ps.dejaExclu")}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="truncate">{b.supplier ?? "—"}</span>
                              <span>·</span>
                              <span>{frDate(b.delivery_date)}</span>
                              <span>·</span>
                              <span>{formatQty(b.nb_products)} {t("ps.ref")}</span>
                            </div>
                            {/* When found via a product search, show the matched product(s) so
                                the user recognises the BL by what they bought. */}
                            {b.matched_products.length > 0 && (
                              <div className="mt-0.5 truncate text-[11px] text-primary" title={b.matched_products.join(", ")}>
                                {t("ps.contient")} {b.matched_products.join(", ")}
                              </div>
                            )}
                          </div>
                          <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-foreground">{formatMAD(b.total)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <footer className="mt-1 flex items-center justify-end gap-2 border-t border-border pt-3">
                <AsyncButton variant="ghost" type="button" onClick={onClose} disabled={isLoading}>
                  {t("common.cancel")}
                </AsyncButton>
              </footer>
            </>
          ) : (
            /* ── Step 2: review + note + confirm ──────────────────────────── */
            <>
              <div className="rounded-md border border-border bg-surface-subtle/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-foreground">{selected.delivery_ref}</span>
                  <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{formatMAD(selected.total)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{selected.supplier ?? "—"}</span>
                  <span>·</span>
                  <span>{frDate(selected.delivery_date)}</span>
                  <span>·</span>
                  <span>{formatQty(selected.nb_lines)} {selected.nb_lines > 1 ? t("ps.lignesWord") : t("ps.ligne")}</span>
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto rounded-md border border-border bg-card">
                {detail.isLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : detail.isError ? (
                  <p className="p-4 text-center text-xs text-error">{t("ps.loadDetailErr")}</p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-surface-subtle text-[10px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-1.5 font-semibold">{t("col.produit")}</th>
                        <th className="px-3 py-1.5 text-right font-semibold">{t("col.qte")}</th>
                        <th className="px-3 py-1.5 text-right font-semibold">{t("col.puAchat")}</th>
                        <th className="px-3 py-1.5 text-right font-semibold">{t("col.total")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(detail.data?.lines ?? []).map((ln, i) => (
                        <tr key={i}>
                          <td className="max-w-[220px] truncate px-3 py-1.5 text-foreground" title={ln.product ?? ""}>{ln.product ?? "—"}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{ln.quantity != null ? formatQty(ln.quantity) : "—"}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{ln.unit_price != null ? formatMAD(ln.unit_price) : "—"}</td>
                          <td className="px-3 py-1.5 text-right font-medium tabular-nums">{ln.total != null ? formatMAD(ln.total) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="bl-note" className="text-xs font-medium text-muted-foreground">{t("ps.noteOptionnelle")}</label>
                <textarea
                  id="bl-note"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder={t("ps.notePlaceholder")}
                  className="block w-full resize-none rounded-md border border-input bg-surface-subtle px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                />
              </div>

              <footer className="mt-1 flex items-center justify-between gap-2 border-t border-border pt-3">
                <AsyncButton variant="ghost" type="button" onClick={() => setSelected(null)} disabled={isLoading}>
                  <ArrowLeft className="size-4" /> {t("common.back")}
                </AsyncButton>
                <AsyncButton
                  type="button"
                  variant="primary"
                  isLoading={isLoading}
                  loadingText={t("ps.excluding")}
                  onClick={() => onSubmit(selected.delivery_ref, notes.trim() || undefined)}
                >
                  {t("ps.excludeThisBl")}
                </AsyncButton>
              </footer>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** "{t("ps.exclureProduits")}" multi-pick dialog. Friendly multi-select: type →
 *  pick one or more → optionally clear search and pick more → submit all in
 *  one shot. Picked items persist across query changes (key UX). */

interface ExcludeProductDialogProps {
  open:               boolean;
  onClose:            () => void;
  onSubmit:           (medicamentIds: number[]) => void;
  isLoading:          boolean;
  suggestions:        MedicamentSuggestion[];
  suggestionsLoading: boolean;
  query:              string;
  onQueryChange:      (q: string) => void;
}

function ExcludeProductDialog({
  open, onClose, onSubmit, isLoading,
  suggestions, suggestionsLoading,
  query, onQueryChange,
}: ExcludeProductDialogProps) {
  const t = useT();
  // Multi-pick state: keyed by med id so dedup is automatic. Persists across
  // query changes (owner can search "a", pick 2, clear, search "b", pick more).
  const [picked, setPicked] = useState<Map<number, MedicamentSuggestion>>(new Map());

  // Reset on dialog close.
  useEffect(() => {
    if (!open) { setPicked(new Map()); onQueryChange(""); }
  }, [open, onQueryChange]);

  const togglePick = (s: MedicamentSuggestion) =>
    setPicked((p) => {
      const n = new Map(p);
      if (n.has(s.id)) n.delete(s.id); else n.set(s.id, s);
      return n;
    });
  const removePicked = (id: number) =>
    setPicked((p) => { const n = new Map(p); n.delete(id); return n; });
  const clearAll = () => setPicked(new Map());

  // Hide already-picked rows from the suggestion list.
  const visibleSuggestions = suggestions.filter((s) => !picked.has(s.id));

  const count = picked.size;
  const canSubmit = count > 0 && !isLoading;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isLoading && onClose()}>
      <DialogContent className="max-w-xl">
        <div className="flex flex-col gap-4 p-5">
          <header>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {t("ps.exclureProduits")}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("ps.prodDesc")}
              
            </p>
          </header>

          {/* Chips row — only when ≥1 picked */}
          {count > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface-subtle/50 p-2">
              {[...picked.values()].map((s) => (
                <span
                  key={s.id}
                  className="inline-flex max-w-[220px] items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  <span className="truncate" title={s.product}>{s.product}</span>
                  <button
                    type="button"
                    onClick={() => removePicked(s.id)}
                    aria-label={`Retirer ${s.product}`}
                    className="ml-0.5 inline-flex cursor-pointer items-center justify-center rounded-sm p-0.5 hover:bg-primary/20"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              {count > 2 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="ml-1 inline-flex cursor-pointer items-center rounded-md px-2 py-0.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  {t("ps.toutEffacer")}
                </button>
              )}
              <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
                {count} {t("ps.selectionne")}{count > 1 ? "s" : ""}
              </span>
            </div>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={t("ps.prodSearchPh")}
              className="block w-full rounded-md border border-input bg-surface-subtle py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-md border border-border bg-card">
            {query.trim().length < 2 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">
                {t("ps.prodMin2")}
                {count > 0 && ` ${t("ps.selectionsConservees")}`}
              </p>
            ) : suggestionsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : visibleSuggestions.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">
                {suggestions.length === 0
                  ? t("ps.aucunProduit")
                  : t("ps.tousSelectionnes")}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {visibleSuggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => togglePick(s)}
                      className="flex w-full cursor-pointer items-start gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-subtle"
                    >
                      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-input bg-card">
                        {/* unchecked — visual hint that clicking will pick it */}
                      </span>
                      <Package className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground" title={s.product}>{s.product}</div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="font-mono">{s.pid}</span>
                          {s.category && (
                            <>
                              <span>·</span>
                              <span className="truncate">{s.category}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {formatQty(s.nb_ventes)} {t("ps.ventesWord")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <footer className="mt-1 flex items-center justify-between gap-2 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">
              {count === 0
                ? t("ps.clickToSelect")
                : count === 1
                ? "1 produit sélectionné."
                : t("ps.nSelected", { n: count })}
            </span>
            <div className="flex gap-2">
              <AsyncButton variant="ghost" type="button" onClick={onClose} disabled={isLoading}>
                {t("common.cancel")}
              </AsyncButton>
              <AsyncButton
                type="button"
                variant="primary"
                disabled={!canSubmit}
                isLoading={isLoading}
                loadingText={t("ps.excluding")}
                onClick={() => onSubmit([...picked.keys()])}
              >
                {count > 0 ? `${t("ps.exclureProduits")} (${count})` : t("common.delete")}
              </AsyncButton>
            </div>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** "Exclure un fournisseur" dialog. Two steps:
 *   1. Search a supplier by name → pick one.
 *   2. Review its purchase totals, add an optional note, and confirm.
 *  Non-destructive & reversible — mirrors ExcludeBlDialog, achats-side.
 */

interface ExcludeSupplierDialogProps {
  open:           boolean;
  onClose:        () => void;
  onSubmit:       (supplier: string, notes?: string) => void;
  isLoading:      boolean;
  results:        SupplierSummary[];
  resultsLoading: boolean;
  searchQ:        string;
  onSearchChange: (q: string) => void;
}

function ExcludeSupplierDialog({
  open, onClose, onSubmit, isLoading,
  results, resultsLoading, searchQ, onSearchChange,
}: ExcludeSupplierDialogProps) {
  const t = useT();
  const [selected, setSelected] = useState<SupplierSummary | null>(null);
  const [notes,    setNotes]    = useState("");

  useEffect(() => {
    if (!open) { setSelected(null); setNotes(""); onSearchChange(""); }
  }, [open, onSearchChange]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isLoading && onClose()}>
      <DialogContent className="max-w-xl">
        <div className="flex flex-col gap-4 p-5">
          <header>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {t("ps.supTitle")}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("ps.supDesc")}</p>
          </header>

          {/* ── Step 1: search + pick ─────────────────────────────────────── */}
          {!selected ? (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input
                  type="text"
                  autoFocus
                  value={searchQ}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={t("ps.supSearchPh")}
                  className="block w-full rounded-md border border-input bg-surface-subtle py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                />
              </div>

              <div className="max-h-72 overflow-y-auto rounded-md border border-border bg-card">
                {searchQ.trim().length < 2 ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">
                    {t("ps.supMin2")}
                  </p>
                ) : resultsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : results.length === 0 ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">
                    {t("ps.supNoResult")}
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {results.map((s) => (
                      <li key={s.supplier}>
                        <button
                          type="button"
                          disabled={s.already_excluded}
                          onClick={() => setSelected(s)}
                          className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Building2 className="size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-foreground">{s.supplier}</span>
                              {s.already_excluded && (
                                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{t("ps.dejaExclu")}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span>{formatQty(s.nb_lines)} {t("ps.lignesWord")}</span>
                              <span>·</span>
                              <span>{formatQty(s.nb_products)} {t("common.wProduits")}</span>
                              <span>·</span>
                              <span>{frDate(s.last_date)}</span>
                            </div>
                          </div>
                          <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-foreground">{formatMAD(s.total)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <footer className="mt-1 flex items-center justify-end gap-2 border-t border-border pt-3">
                <AsyncButton variant="ghost" type="button" onClick={onClose} disabled={isLoading}>
                  {t("common.cancel")}
                </AsyncButton>
              </footer>
            </>
          ) : (
            /* ── Step 2: review + note + confirm ──────────────────────────── */
            <>
              <div className="rounded-md border border-border bg-surface-subtle/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">{selected.supplier}</span>
                  <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{formatMAD(selected.total)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatQty(selected.nb_lines)} {t("ps.lignesWord")}</span>
                  <span>·</span>
                  <span>{formatQty(selected.nb_products)} {t("common.wProduits")}</span>
                  <span>·</span>
                  <span>{frDate(selected.last_date)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="sup-note" className="text-xs font-medium text-muted-foreground">{t("ps.noteOptionnelle")}</label>
                <textarea
                  id="sup-note"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder={t("ps.notePlaceholder")}
                  className="block w-full resize-none rounded-md border border-input bg-surface-subtle px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                />
              </div>

              <footer className="mt-1 flex items-center justify-between gap-2 border-t border-border pt-3">
                <AsyncButton variant="ghost" type="button" onClick={() => setSelected(null)} disabled={isLoading}>
                  <ArrowLeft className="size-4" /> {t("common.back")}
                </AsyncButton>
                <AsyncButton
                  type="button"
                  variant="primary"
                  isLoading={isLoading}
                  loadingText={t("ps.excluding")}
                  onClick={() => onSubmit(selected.supplier, notes.trim() || undefined)}
                >
                  {t("ps.excludeThisSup")}
                </AsyncButton>
              </footer>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** "{t("ps.reintegrerProduits")}" multi-pick dialog. Mirrors ExcludeProductDialog's
 *  UX but operates on the in-memory list of currently-spécial products — no
 *  per-keystroke API call needed. */

interface ReintegrateProductsDialogProps {
  open:            boolean;
  onClose:         () => void;
  onSubmit:        (medicamentIds: number[]) => void;
  isLoading:       boolean;
  specialProducts: SpecialProduct[];
}

/** Case + accent insensitive normalization for the local filter. */
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function ReintegrateProductsDialog({
  open, onClose, onSubmit, isLoading, specialProducts,
}: ReintegrateProductsDialogProps) {
  const t = useT();
  const [picked, setPicked] = useState<Map<number, SpecialProduct>>(new Map());
  const [query,  setQuery]  = useState("");

  // Reset on dialog close.
  useEffect(() => {
    if (!open) { setPicked(new Map()); setQuery(""); }
  }, [open]);

  // Drop picks that no longer exist in the spéciaux list (e.g. someone else
  // reintegrated them in another tab between dialog open + submit).
  useEffect(() => {
    if (!open) return;
    setPicked((p) => {
      const validIds = new Set(specialProducts.map((s) => s.medicament_id));
      let changed = false;
      const n = new Map(p);
      for (const id of n.keys()) {
        if (!validIds.has(id)) { n.delete(id); changed = true; }
      }
      return changed ? n : p;
    });
  }, [open, specialProducts]);

  const togglePick = (sp: SpecialProduct) =>
    setPicked((p) => {
      const n = new Map(p);
      if (n.has(sp.medicament_id)) n.delete(sp.medicament_id);
      else n.set(sp.medicament_id, sp);
      return n;
    });
  const removePicked = (id: number) =>
    setPicked((p) => { const n = new Map(p); n.delete(id); return n; });
  const clearAll = () => setPicked(new Map());

  // Filter the visible list — local, no API call. Hide already-picked rows.
  const visible = useMemo(() => {
    const base = specialProducts.filter((sp) => !picked.has(sp.medicament_id));
    if (!query.trim()) return base;
    const q = norm(query.trim());
    return base.filter((sp) =>
      norm(sp.product).includes(q) ||
      norm(sp.pid).includes(q) ||
      norm(sp.category ?? "").includes(q),
    );
  }, [specialProducts, picked, query]);

  const count = picked.size;
  const canSubmit = count > 0 && !isLoading;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isLoading && onClose()}>
      <DialogContent className="max-w-xl">
        <div className="flex flex-col gap-4 p-5">
          <header>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {t("ps.reintegrerProduits")}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Sélectionnez les produits à réintégrer dans vos rapports.
              Ils réapparaîtront immédiatement dans tous les agrégats.
            </p>
          </header>

          {/* Chips row — only when ≥1 picked */}
          {count > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface-subtle/50 p-2">
              {[...picked.values()].map((sp) => (
                <span
                  key={sp.medicament_id}
                  className="inline-flex max-w-[220px] items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  <span className="truncate" title={sp.product}>{sp.product}</span>
                  <button
                    type="button"
                    onClick={() => removePicked(sp.medicament_id)}
                    aria-label={`Retirer ${sp.product}`}
                    className="ml-0.5 inline-flex cursor-pointer items-center justify-center rounded-sm p-0.5 hover:bg-primary/20"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              {count > 2 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="ml-1 inline-flex cursor-pointer items-center rounded-md px-2 py-0.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Tout effacer
                </button>
              )}
              <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
                {count} sélectionné{count > 1 ? "s" : ""}
              </span>
            </div>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("ps.filterPh")}
              className="block w-full rounded-md border border-input bg-surface-subtle py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-md border border-border bg-card">
            {specialProducts.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">
                Aucun produit exclu pour le moment.
              </p>
            ) : visible.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">
                {query.trim()
                  ? t("ps.noFilterResult")
                  : t("ps.allReintSelected")}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {visible.map((sp) => (
                  <li key={sp.medicament_id}>
                    <button
                      type="button"
                      onClick={() => togglePick(sp)}
                      className="flex w-full cursor-pointer items-start gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-subtle"
                    >
                      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-input bg-card" />
                      <Package className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground" title={sp.product}>{sp.product}</div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="font-mono">{sp.pid}</span>
                          {sp.category && (
                            <>
                              <span>·</span>
                              <span className="truncate">{sp.category}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <footer className="mt-1 flex items-center justify-between gap-2 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">
              {count === 0
                ? t("ps.clickToSelect")
                : count === 1
                ? "1 produit sélectionné."
                : t("ps.nSelected", { n: count })}
            </span>
            <div className="flex gap-2">
              <AsyncButton variant="ghost" type="button" onClick={onClose} disabled={isLoading}>
                {t("common.cancel")}
              </AsyncButton>
              <AsyncButton
                type="button"
                variant="primary"
                disabled={!canSubmit}
                isLoading={isLoading}
                loadingText={t("ps.reintegrating")}
                onClick={() => onSubmit([...picked.keys()])}
              >
                {count > 0 ? `${t("ps.reintegrer")} (${count})` : t("ps.reintegrer")}
              </AsyncButton>
            </div>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatRelative(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}


const buildProductColumns = (t: TFn): ColumnDef<SpecialProduct>[] => [
  { key: "product", label: t("col.produit"), width: 320,
    render: (sp) => (
      <div className="flex flex-col">
        <span className="truncate text-sm" title={sp.product}>{sp.product}</span>
        <span className="truncate font-mono text-[10px] text-muted-foreground">{sp.pid}</span>
      </div>
    ) },
  { key: "category", label: t("col.categorie"), width: 200, sortable: false,
    render: (sp) => sp.category
      ? <span className="block max-w-[190px] truncate text-xs text-muted-foreground">{sp.category}</span>
      : <span className="text-muted-foreground">—</span> },
  { key: "created_at", label: t("ps.exclusLe"), width: 160, sortable: false,
    render: (sp) => <span className="text-xs text-muted-foreground">{formatRelative(sp.created_at)}</span> },
];


type Tab = "produits" | "bl" | "fournisseurs";


export default function ProduitsSpeciauxPage() {
  const t = useT();
  const p   = useProduitsSpeciaux();
  const bl  = useBlExclusions();
  const sup = useSupplierExclusions();
  const [tab, setTab] = useState<Tab>("produits");
  const [excluding, setExcluding]         = useState(false);
  const [reintegrating, setReintegrating] = useState(false);
  const [excludingBl, setExcludingBl]     = useState(false);
  const [excludingSup, setExcludingSup]   = useState(false);

  const supplierColumns: ColumnDef<SupplierExclusion>[] = [
    { key: "supplier", label: t("col.fournisseur"), width: 260, sortable: false,
      render: (s) => <span className="text-sm font-medium text-foreground">{s.supplier}</span> },
    { key: "nb_lines", label: t("ps.lignes"), width: 90, align: "right", sortable: false,
      render: (s) => <span className="tabular-nums text-sm">{formatQty(s.nb_lines)}</span> },
    { key: "total", label: t("col.total"), width: 130, align: "right", sortable: false,
      render: (s) => <span className="font-mono text-sm tabular-nums">{formatMAD(s.total)}</span> },
    { key: "notes", label: t("ps.note"), width: 220, sortable: false,
      render: (s) => s.notes
        ? <span className="block max-w-[210px] truncate text-xs text-muted-foreground" title={s.notes}>{s.notes}</span>
        : <span className="text-muted-foreground">—</span> },
    { key: "created_at", label: t("ps.exclusLe"), width: 130, sortable: false,
      render: (s) => <span className="text-xs text-muted-foreground">{formatRelative(s.created_at)}</span> },
    { key: "_action", label: "", width: 130, sortable: false, align: "right",
      render: (s) => (
        <AsyncButton
          variant="ghost"
          type="button"
          isLoading={sup.reintegrating}
          onClick={() => sup.handleReintegrate([s.supplier])}
        >
          <Undo2 className="size-3.5" /> {t("ps.reintegrer")}
        </AsyncButton>
      ) },
  ];

  const blColumns: ColumnDef<BlExclusion>[] = [
    { key: "delivery_ref", label: t("col.reference"), width: 200, sortable: false,
      render: (b) => <span className="font-mono text-sm font-medium text-foreground">{b.delivery_ref}</span> },
    { key: "supplier", label: t("col.fournisseur"), width: 200, sortable: false,
      render: (b) => <span className="block max-w-[190px] truncate text-sm text-muted-foreground" title={b.supplier ?? ""}>{b.supplier ?? "—"}</span> },
    { key: "delivery_date", label: t("col.dateBL"), width: 120, sortable: false,
      render: (b) => <span className="text-xs text-muted-foreground">{formatRelative(b.delivery_date ?? "")}</span> },
    { key: "nb_lines", label: t("ps.lignes"), width: 80, align: "right", sortable: false,
      render: (b) => <span className="tabular-nums text-sm">{formatQty(b.nb_lines)}</span> },
    { key: "total", label: t("col.total"), width: 120, align: "right", sortable: false,
      render: (b) => <span className="font-mono text-sm tabular-nums">{formatMAD(b.total)}</span> },
    { key: "notes", label: t("ps.note"), width: 220, sortable: false,
      render: (b) => b.notes
        ? <span className="block max-w-[210px] truncate text-xs text-muted-foreground" title={b.notes}>{b.notes}</span>
        : <span className="text-muted-foreground">—</span> },
    { key: "created_at", label: t("ps.exclusLe"), width: 130, sortable: false,
      render: (b) => <span className="text-xs text-muted-foreground">{formatRelative(b.created_at)}</span> },
    { key: "_action", label: "", width: 130, sortable: false, align: "right",
      render: (b) => (
        <AsyncButton
          variant="ghost"
          type="button"
          isLoading={bl.reintegrating}
          onClick={() => bl.handleReintegrate([b.delivery_ref])}
        >
          <Undo2 className="size-3.5" /> {t("ps.reintegrer")}
        </AsyncButton>
      ) },
  ];

  const productFilters: ActiveFilter[] = p.search
    ? [{ key: "search", label: <>{t("common.recherche")} {p.search}</>, onClear: () => p.setSearch("") }]
    : [];
  const blFilters: ActiveFilter[] = bl.search
    ? [{ key: "search", label: <>{t("common.recherche")} {bl.search}</>, onClear: () => bl.setSearch("") }]
    : [];
  const supFilters: ActiveFilter[] = sup.search
    ? [{ key: "search", label: <>{t("common.recherche")} {sup.search}</>, onClear: () => sup.setSearch("") }]
    : [];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("nav.produitsSpeciaux")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("ps.subtitle")}
        </p>
      </header>

      {/* Tabs */}
      <TabBar<Tab>
        tabs={[
          { id: "produits",     label: t("ps.tabProduits"),     icon: <Package className="size-4" /> },
          { id: "bl",           label: t("ps.tabBL"),           icon: <FileText className="size-4" /> },
          { id: "fournisseurs", label: t("ps.tabFournisseurs"), icon: <Building2 className="size-4" /> },
        ]}
        activeId={tab}
        onChange={setTab}
      />

      {/* ── Produits tab ─────────────────────────────────────────────────── */}
      {tab === "produits" && (
        <>
          <FilterBar
            search={{
              value:       p.search,
              onChange:    p.setSearch,
              placeholder: t("ps.searchProdPh"),
              suggestions: null,
            }}
            rightActions={[
              { label: t("ps.reintegrerProduits"), icon: <Undo2 className="size-4" />, variant: "outline",
                onClick: () => setReintegrating(true), disabled: p.specialProducts.length === 0 },
              { label: t("ps.exclureProduits"), icon: <Plus className="size-4" />, variant: "primary",
                onClick: () => setExcluding(true) },
            ]}
            activeFilters={productFilters}
            onResetAll={() => p.setSearch("")}
          />

          <DataTable<SpecialProduct>
            rows={p.filteredProducts}
            columns={buildProductColumns(t)}
            isLoading={p.isLoading}
            emptyTitle={t("ps.emptyProduits")}
            emptyHint={p.search ? t("ps.emptySearchHint") : t("ps.emptyProduitsHint")}
            rowKey={(sp) => sp.medicament_id}
          />
        </>
      )}

      {/* ── Bons de livraison tab ────────────────────────────────────────── */}
      {tab === "bl" && (
        <>
          <FilterBar
            search={{
              value:       bl.search,
              onChange:    bl.setSearch,
              placeholder: t("ps.searchBlPh"),
              suggestions: null,
            }}
            rightActions={[
              { label: t("ps.exclureBl"), icon: <Plus className="size-4" />, variant: "primary",
                onClick: () => setExcludingBl(true) },
            ]}
            activeFilters={blFilters}
            onResetAll={() => bl.setSearch("")}
          />

          <DataTable<BlExclusion>
            rows={bl.filtered}
            columns={blColumns}
            isLoading={bl.isLoading}
            emptyTitle={t("ps.emptyBl")}
            emptyHint={bl.search ? t("ps.emptySearchHint") : t("ps.emptyBlHint")}
            rowKey={(b) => b.delivery_ref}
          />
        </>
      )}

      {/* ── Fournisseurs tab ─────────────────────────────────────────────── */}
      {tab === "fournisseurs" && (
        <>
          <FilterBar
            search={{
              value:       sup.search,
              onChange:    sup.setSearch,
              placeholder: t("ps.searchSupPh"),
              suggestions: null,
            }}
            rightActions={[
              { label: t("ps.exclureFournisseur"), icon: <Plus className="size-4" />, variant: "primary",
                onClick: () => setExcludingSup(true) },
            ]}
            activeFilters={supFilters}
            onResetAll={() => sup.setSearch("")}
          />

          <DataTable<SupplierExclusion>
            rows={sup.filtered}
            columns={supplierColumns}
            isLoading={sup.isLoading}
            emptyTitle={t("ps.emptySup")}
            emptyHint={sup.search ? t("ps.emptySearchHint") : t("ps.emptySupHint")}
            rowKey={(s) => s.supplier}
          />
        </>
      )}

      {/* Dialogs */}
      <ExcludeProductDialog
        open={excluding}
        onClose={() => setExcluding(false)}
        onSubmit={(ids) => { p.handleExclude(ids); setExcluding(false); }}
        isLoading={p.excluding}
        suggestions={p.suggestions}
        suggestionsLoading={p.suggestionsLoading}
        query={p.suggestQ}
        onQueryChange={p.setSuggestQ}
      />

      <ReintegrateProductsDialog
        open={reintegrating}
        onClose={() => setReintegrating(false)}
        onSubmit={(ids) => { p.handleReintegrate(ids); setReintegrating(false); }}
        isLoading={p.reintegrating}
        specialProducts={p.specialProducts}
      />

      <ExcludeBlDialog
        open={excludingBl}
        onClose={() => setExcludingBl(false)}
        onSubmit={(ref, notes) => { bl.handleExclude(ref, notes); setExcludingBl(false); }}
        isLoading={bl.excluding}
        results={bl.results}
        resultsLoading={bl.resultsLoading}
        searchQ={bl.searchQ}
        onSearchChange={bl.setSearchQ}
      />

      <ExcludeSupplierDialog
        open={excludingSup}
        onClose={() => setExcludingSup(false)}
        onSubmit={(supplier, notes) => { sup.handleExclude(supplier, notes); setExcludingSup(false); }}
        isLoading={sup.excluding}
        results={sup.results}
        resultsLoading={sup.resultsLoading}
        searchQ={sup.searchQ}
        onSearchChange={sup.setSearchQ}
      />
    </div>
  );
}
