/** "Exclure un fournisseur" dialog. Two steps:
 *   1. Search a supplier by name → pick one.
 *   2. Review its purchase totals, add an optional note, and confirm.
 *  Non-destructive & reversible — mirrors ExcludeBlDialog, achats-side.
 */
import { useEffect, useState } from "react";
import { ArrowLeft, Building2, Loader2, Search } from "lucide-react";

import { AsyncButton } from "@/components/shared/AsyncButton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatMAD, formatQty } from "@/utils/format";
import type { SupplierSummary } from "@/types";
import { useT } from "@/i18n/I18nProvider";


export interface ExcludeSupplierDialogProps {
  open:           boolean;
  onClose:        () => void;
  onSubmit:       (supplier: string, notes?: string) => void;
  isLoading:      boolean;
  results:        SupplierSummary[];
  resultsLoading: boolean;
  searchQ:        string;
  onSearchChange: (q: string) => void;
}


function frDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}


export function ExcludeSupplierDialog({
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
