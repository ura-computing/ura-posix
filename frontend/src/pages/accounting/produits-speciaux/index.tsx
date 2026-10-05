import { useState, useEffect, useMemo } from "react";
import { Building2, FileText, Package, Plus, Undo2, Loader2, Search, X } from "lucide-react";

import { AsyncButton } from "@/_components/AsyncButton";
import { DataTable, type ColumnDef } from "@/_components/DataTable";
import { FilterBar, type ActiveFilter } from "@/_components/filterBar";
import { formatDate, formatMAD, formatQty } from "@/utils/format";
import { matchesFields } from "@/utils/text";
import type {
  BlExclusion,
  SpecialProduct,
  SupplierExclusion,
  BlSummary,
  MedicamentSuggestion,
  SupplierSummary,
} from "@/types";

import { TwoStepExcludeDialog } from "./_components/TwoStepExcludeDialog";
import { useBlDetail, useBlExclusions, useProduitsSpeciaux, useSupplierExclusions } from "./hooks";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { Dialog, DialogContent } from "@/_components/dialog";
import { TabBar } from "@/_components/TabBar";
import { Page } from "@/_components/Page";

/** "Exclure un BL" dialog — PG-007. Two steps:
 *   1. Search a delivery note by reference OR by a product it contains → pick one.
 *   2. Review the BL (supplier, date, product lines, total), add an optional
 *      note, and confirm. Non-destructive & reversible.
 */

interface ExcludeBlDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (deliveryRef: string, notes?: string) => void;
  isLoading: boolean;
  results: BlSummary[];
  resultsLoading: boolean;
  searchQ: string;
  onSearchChange: (q: string) => void;
}

function ExcludeBlDialog({ onSubmit, ...rest }: ExcludeBlDialogProps) {
  const t = useT();
  return (
    <TwoStepExcludeDialog<BlSummary>
      {...rest}
      title={t("ps.blTitle")}
      description={t("ps.blDesc")}
      searchPlaceholder={t("ps.blSearchPh")}
      min2Text={t("ps.blMin2")}
      noResultText={t("ps.blNoResult")}
      itemKey={(b) => b.delivery_ref}
      renderResult={(b) => (
        <>
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-mono text-sm font-medium text-foreground">{b.delivery_ref}</span>
              {b.already_excluded && <AlreadyExcluded />}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="truncate">{b.supplier ?? "—"}</span>
              <span>·</span>
              <span>{formatDate(b.delivery_date)}</span>
              <span>·</span>
              <span>
                {formatQty(b.nb_products)} {t("ps.ref")}
              </span>
            </div>
            {/* When found via a product search, show the matched product(s) so
                the user recognises the BL by what they bought. */}
            {b.matched_products.length > 0 && (
              <div className="mt-0.5 truncate text-[11px] text-primary" title={b.matched_products.join(", ")}>
                {t("ps.contient")} {b.matched_products.join(", ")}
              </div>
            )}
          </div>
          <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-foreground">
            {formatMAD(b.total)}
          </span>
        </>
      )}
      renderPicked={(b) => (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm font-semibold text-foreground">{b.delivery_ref}</span>
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{formatMAD(b.total)}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">{b.supplier ?? "—"}</span>
            <span>·</span>
            <span>{formatDate(b.delivery_date)}</span>
            <span>·</span>
            <span>
              {formatQty(b.nb_lines)} {b.nb_lines > 1 ? t("ps.lignesWord") : t("ps.ligne")}
            </span>
          </div>
        </>
      )}
      renderDetails={(b) => <BlLines deliveryRef={b.delivery_ref} />}
      noteId="bl-note"
      confirmLabel={t("ps.excludeThisBl")}
      onSubmit={(b, notes) => onSubmit(b.delivery_ref, notes)}
    />
  );
}

/** Step 2 of « Exclure un BL »: the BL's product lines. */
function BlLines({ deliveryRef }: { deliveryRef: string }) {
  const t = useT();
  const { blLines, isLoadingLines, linesError } = useBlDetail(deliveryRef);
  return (
    <div className="max-h-56 overflow-y-auto rounded-md border border-border bg-card">
      {isLoadingLines ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : linesError ? (
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
            {blLines.map((ln, i) => (
              <tr key={i}>
                <td className="max-w-[220px] truncate px-3 py-1.5 text-foreground" title={ln.product ?? ""}>
                  {ln.product ?? "—"}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {ln.quantity != null ? formatQty(ln.quantity) : "—"}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {ln.unit_price != null ? formatMAD(ln.unit_price) : "—"}
                </td>
                <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                  {ln.total != null ? formatMAD(ln.total) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** « Déjà exclu » pill on a search result. */
function AlreadyExcluded() {
  const t = useT();
  return (
    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
      {t("ps.dejaExclu")}
    </span>
  );
}

/** "{t("ps.exclureProduits")}" multi-pick dialog. Friendly multi-select: type →
 *  pick one or more → optionally clear search and pick more → submit all in
 *  one shot. Picked items persist across query changes (key UX). */

interface ExcludeProductDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (medicamentIds: number[]) => void;
  isLoading: boolean;
  suggestions: MedicamentSuggestion[];
  suggestionsLoading: boolean;
  query: string;
  onQueryChange: (q: string) => void;
}

/** Mounted only while open: every open starts empty; closing clears the search. */
function ExcludeProductDialog(props: ExcludeProductDialogProps) {
  return props.open ? <ExcludeProductBody {...props} /> : null;
}

function ExcludeProductBody({
  open,
  onClose,
  onSubmit,
  isLoading,
  suggestions,
  suggestionsLoading,
  query,
  onQueryChange,
}: ExcludeProductDialogProps) {
  const t = useT();
  // Multi-pick state: keyed by med id so dedup is automatic. Persists across
  // query changes (owner can search "a", pick 2, clear, search "b", pick more).
  const [picked, setPicked] = useState<Map<number, MedicamentSuggestion>>(new Map());

  useEffect(() => () => onQueryChange(""), [onQueryChange]);

  const togglePick = (s: MedicamentSuggestion) =>
    setPicked((p) => {
      const n = new Map(p);
      if (n.has(s.id)) n.delete(s.id);
      else n.set(s.id, s);
      return n;
    });
  const removePicked = (id: number) =>
    setPicked((p) => {
      const n = new Map(p);
      n.delete(id);
      return n;
    });
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
            <h2 className="text-base font-semibold tracking-tight text-foreground">{t("ps.exclureProduits")}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("ps.prodDesc")}</p>
          </header>

          {/* Chips row — only when ≥1 picked */}
          {count > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface-subtle/50 p-2">
              {[...picked.values()].map((s) => (
                <span
                  key={s.id}
                  className="inline-flex max-w-[220px] items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  <span className="truncate" title={s.product}>
                    {s.product}
                  </span>
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
                {count} {t("ps.selectionne")}
                {count > 1 ? "s" : ""}
              </span>
            </div>
          )}

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
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
                {suggestions.length === 0 ? t("ps.aucunProduit") : t("ps.tousSelectionnes")}
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
                        <div className="truncate text-sm font-medium text-foreground" title={s.product}>
                          {s.product}
                        </div>
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
              {count === 0 ? t("ps.clickToSelect") : count === 1 ? t("ps.unSelected") : t("ps.nSelected", { n: count })}
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
  open: boolean;
  onClose: () => void;
  onSubmit: (supplier: string, notes?: string) => void;
  isLoading: boolean;
  results: SupplierSummary[];
  resultsLoading: boolean;
  searchQ: string;
  onSearchChange: (q: string) => void;
}

function ExcludeSupplierDialog({ onSubmit, ...rest }: ExcludeSupplierDialogProps) {
  const t = useT();
  const facts = (s: SupplierSummary) => (
    <>
      <span>
        {formatQty(s.nb_lines)} {t("ps.lignesWord")}
      </span>
      <span>·</span>
      <span>
        {formatQty(s.nb_products)} {t("common.wProduits")}
      </span>
      <span>·</span>
      <span>{formatDate(s.last_date)}</span>
    </>
  );
  return (
    <TwoStepExcludeDialog<SupplierSummary>
      {...rest}
      title={t("ps.supTitle")}
      description={t("ps.supDesc")}
      searchPlaceholder={t("ps.supSearchPh")}
      min2Text={t("ps.supMin2")}
      noResultText={t("ps.supNoResult")}
      itemKey={(s) => s.supplier}
      renderResult={(s) => (
        <>
          <Building2 className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">{s.supplier}</span>
              {s.already_excluded && <AlreadyExcluded />}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">{facts(s)}</div>
          </div>
          <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-foreground">
            {formatMAD(s.total)}
          </span>
        </>
      )}
      renderPicked={(s) => (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{s.supplier}</span>
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{formatMAD(s.total)}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">{facts(s)}</div>
        </>
      )}
      noteId="sup-note"
      confirmLabel={t("ps.excludeThisSup")}
      onSubmit={(s, notes) => onSubmit(s.supplier, notes)}
    />
  );
}

/** "{t("ps.reintegrerProduits")}" multi-pick dialog. Mirrors ExcludeProductDialog's
 *  UX but operates on the in-memory list of currently-spécial products — no
 *  per-keystroke API call needed. */

interface ReintegrateProductsDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (medicamentIds: number[]) => void;
  isLoading: boolean;
  specialProducts: SpecialProduct[];
}

/** Mounted only while open: every open starts with no pick and no search. */
function ReintegrateProductsDialog(props: ReintegrateProductsDialogProps) {
  return props.open ? <ReintegrateProductsBody {...props} /> : null;
}

function ReintegrateProductsBody({
  open,
  onClose,
  onSubmit,
  isLoading,
  specialProducts,
}: ReintegrateProductsDialogProps) {
  const t = useT();
  const [allPicked, setPicked] = useState<Map<number, SpecialProduct>>(new Map());
  const [query, setQuery] = useState("");

  // Only the picks still in the spéciaux list (e.g. someone else reintegrated
  // one in another tab between dialog open + submit).
  const picked = useMemo(() => {
    const validIds = new Set(specialProducts.map((s) => s.medicament_id));
    const kept = new Map([...allPicked].filter(([id]) => validIds.has(id)));
    return kept.size === allPicked.size ? allPicked : kept;
  }, [allPicked, specialProducts]);

  const togglePick = (sp: SpecialProduct) =>
    setPicked((p) => {
      const n = new Map(p);
      if (n.has(sp.medicament_id)) n.delete(sp.medicament_id);
      else n.set(sp.medicament_id, sp);
      return n;
    });
  const removePicked = (id: number) =>
    setPicked((p) => {
      const n = new Map(p);
      n.delete(id);
      return n;
    });
  const clearAll = () => setPicked(new Map());

  // Filter the visible list — local, no API call. Hide already-picked rows.
  const visible = useMemo(() => {
    return specialProducts.filter(
      (sp) => !picked.has(sp.medicament_id) && matchesFields([sp.product, sp.pid, sp.category], query),
    );
  }, [specialProducts, picked, query]);

  const count = picked.size;
  const canSubmit = count > 0 && !isLoading;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isLoading && onClose()}>
      <DialogContent className="max-w-xl">
        <div className="flex flex-col gap-4 p-5">
          <header>
            <h2 className="text-base font-semibold tracking-tight text-foreground">{t("ps.reintegrerProduits")}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("ps.reintegrerHint")}</p>
          </header>

          {/* Chips row — only when ≥1 picked */}
          {count > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface-subtle/50 p-2">
              {[...picked.values()].map((sp) => (
                <span
                  key={sp.medicament_id}
                  className="inline-flex max-w-[220px] items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  <span className="truncate" title={sp.product}>
                    {sp.product}
                  </span>
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
                  {t("ps.toutEffacer")}
                </button>
              )}
              <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
                {count} sélectionné{count > 1 ? "s" : ""}
              </span>
            </div>
          )}

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
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
              <p className="p-4 text-center text-xs text-muted-foreground">{t("ps.noExcluded")}</p>
            ) : visible.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">
                {query.trim() ? t("ps.noFilterResult") : t("ps.allReintSelected")}
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
                        <div className="truncate text-sm font-medium text-foreground" title={sp.product}>
                          {sp.product}
                        </div>
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
              {count === 0 ? t("ps.clickToSelect") : count === 1 ? t("ps.unSelected") : t("ps.nSelected", { n: count })}
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

const buildProductColumns = (t: TFn): ColumnDef<SpecialProduct>[] => [
  {
    key: "product",
    label: t("col.produit"),
    width: 320,
    render: (sp) => (
      <div className="flex flex-col">
        <span className="truncate text-sm" title={sp.product}>
          {sp.product}
        </span>
        <span className="truncate font-mono text-[10px] text-muted-foreground">{sp.pid}</span>
      </div>
    ),
  },
  {
    key: "category",
    label: t("col.categorie"),
    width: 200,
    sortable: false,
    render: (sp) =>
      sp.category ? (
        <span className="block max-w-[190px] truncate text-xs text-muted-foreground">{sp.category}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: "created_at",
    label: t("ps.exclusLe"),
    width: 160,
    sortable: false,
    render: (sp) => <span className="text-xs text-muted-foreground">{formatDate(sp.created_at)}</span>,
  },
];

type Tab = "produits" | "bl" | "fournisseurs";

export default function ProduitsSpeciauxPage() {
  const t = useT();
  const {
    isExcludingProducts,
    filteredProducts,
    excludeProducts,
    reintegrateProducts,
    productsLoading,
    isReintegratingProducts,
    productSearch,
    setProductSearch,
    setSuggestQ,
    specialProducts,
    suggestions,
    suggestionsLoading,
    suggestQ,
  } = useProduitsSpeciaux();
  const {
    isExcludingBl,
    filteredBls,
    excludeBl,
    reintegrateBls,
    blsLoading,
    isReintegratingBls,
    blResults,
    blResultsLoading,
    blSearch,
    blSearchQ,
    setBlSearch,
    setBlSearchQ,
  } = useBlExclusions();
  const {
    isExcludingSupplier,
    filteredSuppliers,
    excludeSupplier,
    reintegrateSuppliers,
    suppliersLoading,
    isReintegratingSuppliers,
    supplierResults,
    supplierResultsLoading,
    supplierSearch,
    supplierSearchQ,
    setSupplierSearch,
    setSupplierSearchQ,
  } = useSupplierExclusions();
  const [tab, setTab] = useState<Tab>("produits");
  const [excluding, setExcluding] = useState(false);
  const [reintegrating, setReintegrating] = useState(false);
  const [excludingBl, setExcludingBl] = useState(false);
  const [excludingSup, setExcludingSup] = useState(false);

  const supplierColumns: ColumnDef<SupplierExclusion>[] = [
    {
      key: "supplier",
      label: t("col.fournisseur"),
      width: 260,
      sortable: false,
      render: (s) => <span className="text-sm font-medium text-foreground">{s.supplier}</span>,
    },
    {
      key: "nb_lines",
      label: t("ps.lignes"),
      width: 90,
      align: "right",
      sortable: false,
      render: (s) => <span className="tabular-nums text-sm">{formatQty(s.nb_lines)}</span>,
    },
    {
      key: "total",
      label: t("col.total"),
      width: 130,
      align: "right",
      sortable: false,
      render: (s) => <span className="font-mono text-sm tabular-nums">{formatMAD(s.total)}</span>,
    },
    {
      key: "notes",
      label: t("ps.note"),
      width: 220,
      sortable: false,
      render: (s) =>
        s.notes ? (
          <span className="block max-w-[210px] truncate text-xs text-muted-foreground" title={s.notes}>
            {s.notes}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "created_at",
      label: t("ps.exclusLe"),
      width: 130,
      sortable: false,
      render: (s) => <span className="text-xs text-muted-foreground">{formatDate(s.created_at)}</span>,
    },
    {
      key: "_action",
      label: "",
      width: 130,
      sortable: false,
      align: "right",
      render: (s) => (
        <AsyncButton
          variant="ghost"
          type="button"
          isLoading={isReintegratingSuppliers}
          onClick={() => reintegrateSuppliers([s.supplier])}
        >
          <Undo2 className="size-3.5" /> {t("ps.reintegrer")}
        </AsyncButton>
      ),
    },
  ];

  const blColumns: ColumnDef<BlExclusion>[] = [
    {
      key: "delivery_ref",
      label: t("col.reference"),
      width: 200,
      sortable: false,
      render: (b) => <span className="font-mono text-sm font-medium text-foreground">{b.delivery_ref}</span>,
    },
    {
      key: "supplier",
      label: t("col.fournisseur"),
      width: 200,
      sortable: false,
      render: (b) => (
        <span className="block max-w-[190px] truncate text-sm text-muted-foreground" title={b.supplier ?? ""}>
          {b.supplier ?? "—"}
        </span>
      ),
    },
    {
      key: "delivery_date",
      label: t("col.dateBL"),
      width: 120,
      sortable: false,
      render: (b) => <span className="text-xs text-muted-foreground">{formatDate(b.delivery_date ?? "")}</span>,
    },
    {
      key: "nb_lines",
      label: t("ps.lignes"),
      width: 80,
      align: "right",
      sortable: false,
      render: (b) => <span className="tabular-nums text-sm">{formatQty(b.nb_lines)}</span>,
    },
    {
      key: "total",
      label: t("col.total"),
      width: 120,
      align: "right",
      sortable: false,
      render: (b) => <span className="font-mono text-sm tabular-nums">{formatMAD(b.total)}</span>,
    },
    {
      key: "notes",
      label: t("ps.note"),
      width: 220,
      sortable: false,
      render: (b) =>
        b.notes ? (
          <span className="block max-w-[210px] truncate text-xs text-muted-foreground" title={b.notes}>
            {b.notes}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "created_at",
      label: t("ps.exclusLe"),
      width: 130,
      sortable: false,
      render: (b) => <span className="text-xs text-muted-foreground">{formatDate(b.created_at)}</span>,
    },
    {
      key: "_action",
      label: "",
      width: 130,
      sortable: false,
      align: "right",
      render: (b) => (
        <AsyncButton
          variant="ghost"
          type="button"
          isLoading={isReintegratingBls}
          onClick={() => reintegrateBls([b.delivery_ref])}
        >
          <Undo2 className="size-3.5" /> {t("ps.reintegrer")}
        </AsyncButton>
      ),
    },
  ];

  const productFilters: ActiveFilter[] = productSearch
    ? [
        {
          key: "search",
          label: (
            <>
              {t("common.recherche")} {productSearch}
            </>
          ),
          onClear: () => setProductSearch(""),
        },
      ]
    : [];
  const blFilters: ActiveFilter[] = blSearch
    ? [
        {
          key: "search",
          label: (
            <>
              {t("common.recherche")} {blSearch}
            </>
          ),
          onClear: () => setBlSearch(""),
        },
      ]
    : [];
  const supFilters: ActiveFilter[] = supplierSearch
    ? [
        {
          key: "search",
          label: (
            <>
              {t("common.recherche")} {supplierSearch}
            </>
          ),
          onClear: () => setSupplierSearch(""),
        },
      ]
    : [];

  return (
    <Page title={t("nav.produitsSpeciaux")} subtitle={t("ps.subtitle")}>
      {/* Tabs */}
      <TabBar<Tab>
        tabs={[
          { id: "produits", label: t("ps.tabProduits"), icon: <Package className="size-4" /> },
          { id: "bl", label: t("ps.tabBL"), icon: <FileText className="size-4" /> },
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
              value: productSearch,
              onChange: setProductSearch,
              placeholder: t("ps.searchProdPh"),
              suggestions: null,
            }}
            rightActions={[
              {
                label: t("ps.reintegrerProduits"),
                icon: <Undo2 className="size-4" />,
                variant: "outline",
                onClick: () => setReintegrating(true),
                disabled: specialProducts.length === 0,
              },
              {
                label: t("ps.exclureProduits"),
                icon: <Plus className="size-4" />,
                variant: "primary",
                onClick: () => setExcluding(true),
              },
            ]}
            activeFilters={productFilters}
            onResetAll={() => setProductSearch("")}
          />

          <DataTable<SpecialProduct>
            rows={filteredProducts}
            columns={buildProductColumns(t)}
            isLoading={productsLoading}
            emptyTitle={t("ps.emptyProduits")}
            emptyHint={productSearch ? t("ps.emptySearchHint") : t("ps.emptyProduitsHint")}
            rowKey={(sp) => sp.medicament_id}
          />
        </>
      )}

      {/* ── Bons de livraison tab ────────────────────────────────────────── */}
      {tab === "bl" && (
        <>
          <FilterBar
            search={{
              value: blSearch,
              onChange: setBlSearch,
              placeholder: t("ps.searchBlPh"),
              suggestions: null,
            }}
            rightActions={[
              {
                label: t("ps.exclureBl"),
                icon: <Plus className="size-4" />,
                variant: "primary",
                onClick: () => setExcludingBl(true),
              },
            ]}
            activeFilters={blFilters}
            onResetAll={() => setBlSearch("")}
          />

          <DataTable<BlExclusion>
            rows={filteredBls}
            columns={blColumns}
            isLoading={blsLoading}
            emptyTitle={t("ps.emptyBl")}
            emptyHint={blSearch ? t("ps.emptySearchHint") : t("ps.emptyBlHint")}
            rowKey={(b) => b.delivery_ref}
          />
        </>
      )}

      {/* ── Fournisseurs tab ─────────────────────────────────────────────── */}
      {tab === "fournisseurs" && (
        <>
          <FilterBar
            search={{
              value: supplierSearch,
              onChange: setSupplierSearch,
              placeholder: t("ps.searchSupPh"),
              suggestions: null,
            }}
            rightActions={[
              {
                label: t("ps.exclureFournisseur"),
                icon: <Plus className="size-4" />,
                variant: "primary",
                onClick: () => setExcludingSup(true),
              },
            ]}
            activeFilters={supFilters}
            onResetAll={() => setSupplierSearch("")}
          />

          <DataTable<SupplierExclusion>
            rows={filteredSuppliers}
            columns={supplierColumns}
            isLoading={suppliersLoading}
            emptyTitle={t("ps.emptySup")}
            emptyHint={supplierSearch ? t("ps.emptySearchHint") : t("ps.emptySupHint")}
            rowKey={(s) => s.supplier}
          />
        </>
      )}

      {/* Dialogs */}
      <ExcludeProductDialog
        open={excluding}
        onClose={() => setExcluding(false)}
        onSubmit={(ids) => {
          excludeProducts(ids);
          setExcluding(false);
        }}
        isLoading={isExcludingProducts}
        suggestions={suggestions}
        suggestionsLoading={suggestionsLoading}
        query={suggestQ}
        onQueryChange={setSuggestQ}
      />

      <ReintegrateProductsDialog
        open={reintegrating}
        onClose={() => setReintegrating(false)}
        onSubmit={(ids) => {
          reintegrateProducts(ids);
          setReintegrating(false);
        }}
        isLoading={isReintegratingProducts}
        specialProducts={specialProducts}
      />

      <ExcludeBlDialog
        open={excludingBl}
        onClose={() => setExcludingBl(false)}
        onSubmit={(ref, notes) => {
          excludeBl(ref, notes);
          setExcludingBl(false);
        }}
        isLoading={isExcludingBl}
        results={blResults}
        resultsLoading={blResultsLoading}
        searchQ={blSearchQ}
        onSearchChange={setBlSearchQ}
      />

      <ExcludeSupplierDialog
        open={excludingSup}
        onClose={() => setExcludingSup(false)}
        onSubmit={(supplier, notes) => {
          excludeSupplier(supplier, notes);
          setExcludingSup(false);
        }}
        isLoading={isExcludingSupplier}
        results={supplierResults}
        resultsLoading={supplierResultsLoading}
        searchQ={supplierSearchQ}
        onSearchChange={setSupplierSearchQ}
      />
    </Page>
  );
}
