/** "Exclure un BL" dialog — PG-007. Two steps:
 *   1. Search a delivery note by reference OR by a product it contains → pick one.
 *   2. Review the BL (supplier, date, product lines, total), add an optional
 *      note, and confirm. Non-destructive & reversible.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, Loader2, Search } from "lucide-react";

import { AsyncButton } from "@/components/shared/AsyncButton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getBlDetail } from "@/api/blExclusions";
import { formatMAD, formatQty } from "@/utils/format";
import { QUERY_KEYS } from "@/types";
import type { BlSummary } from "@/types";


export interface ExcludeBlDialogProps {
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


export function ExcludeBlDialog({
  open, onClose, onSubmit, isLoading,
  results, resultsLoading, searchQ, onSearchChange,
}: ExcludeBlDialogProps) {
  const [selected, setSelected] = useState<BlSummary | null>(null);
  const [notes,    setNotes]    = useState("");

  useEffect(() => {
    if (!open) { setSelected(null); setNotes(""); onSearchChange(""); }
  }, [open, onSearchChange]);

  const detail = useQuery({
    queryKey: QUERY_KEYS.BL_DETAIL(selected?.delivery_ref ?? ""),
    queryFn:  () => getBlDetail(selected!.delivery_ref),
    enabled:  open && !!selected,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isLoading && onClose()}>
      <DialogContent className="max-w-xl">
        <div className="flex flex-col gap-4 p-5">
          <header>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Exclure un bon de livraison
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Recherchez par référence de BL ou par produit. L'exclusion retire ce BL de vos
              analyses (achats, marges, stock) — réversible à tout moment.
            </p>
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
                  placeholder="Référence (ex. LVC2606CAS00033) ou nom de produit"
                  className="block w-full rounded-md border border-input bg-surface-subtle py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                />
              </div>

              <div className="max-h-72 overflow-y-auto rounded-md border border-border bg-card">
                {searchQ.trim().length < 2 ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">
                    Tapez au moins 2 caractères (référence ou produit).
                  </p>
                ) : resultsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : results.length === 0 ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">
                    Aucun bon de livraison trouvé.
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
                                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">déjà exclu</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="truncate">{b.supplier ?? "—"}</span>
                              <span>·</span>
                              <span>{frDate(b.delivery_date)}</span>
                              <span>·</span>
                              <span>{formatQty(b.nb_products)} réf.</span>
                            </div>
                            {/* When found via a product search, show the matched product(s) so
                                the user recognises the BL by what they bought. */}
                            {b.matched_products.length > 0 && (
                              <div className="mt-0.5 truncate text-[11px] text-primary" title={b.matched_products.join(", ")}>
                                Contient : {b.matched_products.join(", ")}
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
                  Annuler
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
                  <span>{formatQty(selected.nb_lines)} ligne{selected.nb_lines > 1 ? "s" : ""}</span>
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto rounded-md border border-border bg-card">
                {detail.isLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : detail.isError ? (
                  <p className="p-4 text-center text-xs text-error">Impossible de charger le détail du BL.</p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-surface-subtle text-[10px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-1.5 font-semibold">Produit</th>
                        <th className="px-3 py-1.5 text-right font-semibold">Qté</th>
                        <th className="px-3 py-1.5 text-right font-semibold">PU</th>
                        <th className="px-3 py-1.5 text-right font-semibold">Total</th>
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
                <label htmlFor="bl-note" className="text-xs font-medium text-muted-foreground">Note (optionnelle)</label>
                <textarea
                  id="bl-note"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Raison de l'exclusion (ex. achat exceptionnel, transfert…)"
                  className="block w-full resize-none rounded-md border border-input bg-surface-subtle px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                />
              </div>

              <footer className="mt-1 flex items-center justify-between gap-2 border-t border-border pt-3">
                <AsyncButton variant="ghost" type="button" onClick={() => setSelected(null)} disabled={isLoading}>
                  <ArrowLeft className="size-4" /> Retour
                </AsyncButton>
                <AsyncButton
                  type="button"
                  variant="primary"
                  isLoading={isLoading}
                  loadingText="Exclusion…"
                  onClick={() => onSubmit(selected.delivery_ref, notes.trim() || undefined)}
                >
                  Exclure ce BL
                </AsyncButton>
              </footer>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
