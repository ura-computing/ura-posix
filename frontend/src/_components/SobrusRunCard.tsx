/** Bottom-right card on every page but /sobrus (owners with the « Connexion Sobrus » access), in the look of the import cards
 *  (`AppLayout` `JobCard`): the « Connexion Sobrus » robot as it goes (« Ventes 2025 », the step, the
 *  bar, the lines added, « Arrêter »), then how it ended (« Terminé : 45 012 ligne(s) ajoutée(s) »
 *  for 6 s, or why it stopped until ✕). A click on the card → /sobrus. */
import { Ban, CheckCircle2, CircleAlert, Loader2, RefreshCw, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { useSobrusRunWatcher } from "@/hooks/useSobrusRunWatcher";
import { useT } from "@/i18n/I18nProvider";
import { ROUTES } from "@/types";
import { cn } from "@/utils/cn";
import { formatNumStr } from "@/utils/format";
import { currentStep, fileName, modeName, runResult } from "@/utils/sobrus";

export function SobrusRunCard() {
  const t = useT();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { activeRun, endedRun, dismissEnded, cancelRun, isCancelling } = useSobrusRunWatcher();
  const run = activeRun ?? endedRun;
  if (!run || pathname === ROUTES.SOBRUS) return null; // its page shows the whole run

  const running = run === activeRun;
  const importing = running && run.phase === "import" && run.chunk_total > 0;
  const pct = importing ? Math.round((run.chunk_current / run.chunk_total) * 100) : 0;
  const what = running ? fileName(t, run) : "";
  const icon = running ? (
    <Loader2 className="size-4 animate-spin" />
  ) : run.status === "success" ? (
    <CheckCircle2 className="size-4" />
  ) : (
    <CircleAlert className="size-4" />
  );

  return (
    <section aria-label={t("sobrus.cornerTitle")} className="rounded-2xl border border-border bg-card shadow-lg">
      <button
        type="button"
        onClick={() => nav(ROUTES.SOBRUS)}
        className="flex w-full cursor-pointer items-center gap-3 px-4 pt-3 text-left"
      >
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <RefreshCw className="size-3 text-muted-foreground" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("sobrus.cornerTitle")}
            </span>
            {what && <span className="truncate text-xs font-semibold text-foreground">{what}</span>}
          </div>
          <span className="truncate text-sm font-medium text-foreground" title={modeName(t, run)}>
            {running ? currentStep(t, run) : modeName(t, run)}
          </span>
        </div>
      </button>

      {running ? (
        <div className="space-y-2 px-4 pb-3 pt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-subtle">
            <span
              className={cn(
                "block h-full rounded-full bg-primary transition-[width] duration-300",
                !importing && "w-1/3 animate-pulse",
              )}
              style={importing ? { width: `${pct}%` } : undefined}
            />
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>{t("sobrus.addedSoFar", { n: formatNumStr(run.lines_added) })}</span>
            {run.mode !== "check" && (
              <button
                type="button"
                onClick={() => void cancelRun(run.id)}
                disabled={isCancelling || run.cancel_requested}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-destructive/30 px-2 py-0.5 font-semibold text-destructive hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Ban className="size-3" />
                {t("sobrus.stop")}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2 px-4 pb-3 pt-1 text-xs">
          <span
            className={cn(
              run.status === "success" && "text-success",
              run.status === "cancelled" && "text-warning",
              run.status === "error" && "text-error",
            )}
          >
            {runResult(t, run)}
          </span>
          <button
            type="button"
            onClick={dismissEnded}
            aria-label={t("common.close")}
            className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </section>
  );
}
