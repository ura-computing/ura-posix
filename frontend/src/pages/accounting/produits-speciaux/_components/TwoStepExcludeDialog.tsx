/** « Exclure un BL » and « Exclure un fournisseur »: one dialog, two steps.
 *   1. Search (2+ letters) → pick one result (already excluded ones are greyed out).
 *   2. Review what is picked (+ optional details), add a note, confirm.
 *  Mounted only while open: every open starts empty; closing clears the search. */
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Loader2, Search } from "lucide-react";

import { AsyncButton } from "@/_components/AsyncButton";
import { Dialog, DialogContent } from "@/_components/dialog";
import { useT } from "@/i18n/I18nProvider";

export interface TwoStepExcludeDialogProps<T extends { already_excluded: boolean }> {
  open: boolean;
  onClose: () => void;
  isLoading: boolean;
  title: string;
  description: string;
  searchPlaceholder: string;
  /** « Tapez au moins 2 caractères… » */
  min2Text: string;
  noResultText: string;
  searchQ: string;
  onSearchChange: (q: string) => void;
  results: T[];
  resultsLoading: boolean;
  itemKey: (item: T) => string;
  /** Inside a result button: icon, name, small facts, amount. */
  renderResult: (item: T) => ReactNode;
  /** Step 2: the picked item's summary box. */
  renderPicked: (item: T) => ReactNode;
  /** Step 2, under the summary (e.g. the BL's product lines). */
  renderDetails?: (item: T) => ReactNode;
  noteId: string;
  confirmLabel: string;
  onSubmit: (item: T, notes?: string) => void;
}

export function TwoStepExcludeDialog<T extends { already_excluded: boolean }>(props: TwoStepExcludeDialogProps<T>) {
  return props.open ? <TwoStepBody {...props} /> : null;
}

const INPUT =
  "block w-full rounded-md border border-input bg-surface-subtle text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";

function TwoStepBody<T extends { already_excluded: boolean }>({
  open,
  onClose,
  isLoading,
  title,
  description,
  searchPlaceholder,
  min2Text,
  noResultText,
  searchQ,
  onSearchChange,
  results,
  resultsLoading,
  itemKey,
  renderResult,
  renderPicked,
  renderDetails,
  noteId,
  confirmLabel,
  onSubmit,
}: TwoStepExcludeDialogProps<T>) {
  const t = useT();
  const [picked, setPicked] = useState<T | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => () => onSearchChange(""), [onSearchChange]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isLoading && onClose()}>
      <DialogContent className="max-w-xl">
        <div className="flex flex-col gap-4 p-5">
          <header>
            <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </header>

          {!picked ? (
            <>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  type="text"
                  autoFocus
                  value={searchQ}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className={`${INPUT} py-2 pl-9 pr-3`}
                />
              </div>

              <div className="max-h-72 overflow-y-auto rounded-md border border-border bg-card">
                {searchQ.trim().length < 2 ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">{min2Text}</p>
                ) : resultsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : results.length === 0 ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">{noResultText}</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {results.map((item) => (
                      <li key={itemKey(item)}>
                        <button
                          type="button"
                          disabled={item.already_excluded}
                          onClick={() => setPicked(item)}
                          className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {renderResult(item)}
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
            <>
              <div className="rounded-md border border-border bg-surface-subtle/50 p-3">{renderPicked(picked)}</div>

              {renderDetails?.(picked)}

              <div className="flex flex-col gap-1">
                <label htmlFor={noteId} className="text-xs font-medium text-muted-foreground">
                  {t("ps.noteOptionnelle")}
                </label>
                <textarea
                  id={noteId}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder={t("ps.notePlaceholder")}
                  className={`${INPUT} resize-none px-3 py-2`}
                />
              </div>

              <footer className="mt-1 flex items-center justify-between gap-2 border-t border-border pt-3">
                <AsyncButton variant="ghost" type="button" onClick={() => setPicked(null)} disabled={isLoading}>
                  <ArrowLeft className="size-4" /> {t("common.back")}
                </AsyncButton>
                <AsyncButton
                  type="button"
                  variant="primary"
                  isLoading={isLoading}
                  loadingText={t("ps.excluding")}
                  onClick={() => onSubmit(picked, notes.trim() || undefined)}
                >
                  {confirmLabel}
                </AsyncButton>
              </footer>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
