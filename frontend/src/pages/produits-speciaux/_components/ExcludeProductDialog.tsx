/** "Exclure un produit" dialog: debounced autocomplete over the pharmacy's
 *  medicaments → pick one → submit. Friendly UI: showing PID + category +
 *  sale count on each suggestion so the owner picks the right product. */
import { useEffect, useState } from "react";
import { Loader2, Package, Search } from "lucide-react";

import { AsyncButton } from "@/components/shared/AsyncButton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/utils/cn";
import { formatQty } from "@/utils/format";
import type { MedicamentSuggestion } from "@/types";


export interface ExcludeProductDialogProps {
  open:               boolean;
  onClose:            () => void;
  onSubmit:           (medicamentId: number) => void;
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
  const [picked, setPicked] = useState<MedicamentSuggestion | null>(null);

  // Reset picked + query when dialog opens/closes
  useEffect(() => {
    if (!open) { setPicked(null); onQueryChange(""); }
  }, [open, onQueryChange]);

  // Clear picked if the user changes the query
  useEffect(() => {
    if (picked && !suggestions.find((s) => s.id === picked.id)) setPicked(null);
  }, [suggestions, picked]);

  const canSubmit = picked !== null && !isLoading;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isLoading && onClose()}>
      <DialogContent className="max-w-xl">
        <div className="flex flex-col gap-4 p-5">
          <header>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Exclure un produit
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Recherchez un médicament que vous voulez exclure de vos rapports.
              Réversible à tout moment.
            </p>
          </header>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Nom, PID, catégorie… (min 2 caractères)"
              className="block w-full rounded-md border border-input bg-surface-subtle py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-md border border-border bg-card">
            {query.trim().length < 2 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">
                Tapez au moins 2 caractères pour rechercher.
              </p>
            ) : suggestionsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : suggestions.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">
                Aucun produit trouvé. (Seuls vos produits avec ventes/achats sont listés.)
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {suggestions.map((s) => {
                  const active = picked?.id === s.id;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setPicked(s)}
                        className={cn(
                          "flex w-full cursor-pointer items-start gap-3 px-3 py-2 text-left transition-colors",
                          active ? "bg-primary/10" : "hover:bg-surface-subtle",
                        )}
                      >
                        <Package className={cn("mt-0.5 size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
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
                  );
                })}
              </ul>
            )}
          </div>

          <footer className="mt-1 flex justify-end gap-2 border-t border-border pt-3">
            <AsyncButton variant="ghost" type="button" onClick={onClose} disabled={isLoading}>
              Annuler
            </AsyncButton>
            <AsyncButton
              type="button"
              variant="primary"
              disabled={!canSubmit}
              isLoading={isLoading}
              loadingText="Exclusion…"
              onClick={() => picked && onSubmit(picked.id)}
            >
              Exclure
            </AsyncButton>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
}
