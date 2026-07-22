/** "{t("ps.reintegrerProduits")}" multi-pick dialog. Mirrors ExcludeProductDialog's
 *  UX but operates on the in-memory list of currently-spécial products — no
 *  per-keystroke API call needed. */
import { useEffect, useMemo, useState } from "react";
import { Package, Search, X } from "lucide-react";

import { AsyncButton } from "@/components/shared/AsyncButton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { SpecialProduct } from "@/types";
import { useT } from "@/i18n/I18nProvider";


export interface ReintegrateProductsDialogProps {
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


export function ReintegrateProductsDialog({
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
