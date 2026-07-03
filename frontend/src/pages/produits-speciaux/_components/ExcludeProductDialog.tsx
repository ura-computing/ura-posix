/** "Exclure des produits" multi-pick dialog. Friendly multi-select: type →
 *  pick one or more → optionally clear search and pick more → submit all in
 *  one shot. Picked items persist across query changes (key UX). */
import { useEffect, useState } from "react";
import { Loader2, Package, Search, X } from "lucide-react";

import { AsyncButton } from "@/components/shared/AsyncButton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatQty } from "@/utils/format";
import type { MedicamentSuggestion } from "@/types";


export interface ExcludeProductDialogProps {
  open:               boolean;
  onClose:            () => void;
  onSubmit:           (medicamentIds: number[]) => void;
  isLoading:          boolean;
  suggestions:        MedicamentSuggestion[];
  suggestionsLoading: boolean;
  query:              string;
  onQueryChange:      (q: string) => void;
}


export function ExcludeProductDialog({
  open, onClose, onSubmit, isLoading,
  suggestions, suggestionsLoading,
  query, onQueryChange,
}: ExcludeProductDialogProps) {
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
              Exclure des produits
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Sélectionnez un ou plusieurs médicaments à exclure de vos rapports.
              Réversible à tout moment.
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
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Nom (min 2 caractères)"
              className="block w-full rounded-md border border-input bg-surface-subtle py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-md border border-border bg-card">
            {query.trim().length < 2 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">
                Tapez au moins 2 caractères pour rechercher.
                {count > 0 && " Vos sélections sont conservées."}
              </p>
            ) : suggestionsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : visibleSuggestions.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">
                {suggestions.length === 0
                  ? "Aucun produit trouvé. (Seuls vos produits avec ventes/achats sont listés.)"
                  : "Tous les résultats sont déjà sélectionnés."}
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
                        {formatQty(s.nb_ventes)} ventes
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
                ? "Cliquez sur un produit pour le sélectionner."
                : count === 1
                ? "1 produit sélectionné."
                : `${count} produits sélectionnés.`}
            </span>
            <div className="flex gap-2">
              <AsyncButton variant="ghost" type="button" onClick={onClose} disabled={isLoading}>
                Annuler
              </AsyncButton>
              <AsyncButton
                type="button"
                variant="primary"
                disabled={!canSubmit}
                isLoading={isLoading}
                loadingText="Exclusion…"
                onClick={() => onSubmit([...picked.keys()])}
              >
                {count > 0 ? `Exclure (${count})` : "Exclure"}
              </AsyncButton>
            </div>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
}


