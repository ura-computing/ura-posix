/** Bottom-right cards on every page, in the look of the import cards (`CornerStack` `JobCard`): a Sobrus robot run as it
 *  goes (the step, the bar, what was added so far, « Arrêter »), then how it ended (« Terminé : … » for 6 s, or why
 *  it stopped until ✕). A click on the card opens its page.
 *  - `SobrusRunCard`: owners with « Connexion Sobrus » (every page but /sobrus, which shows the whole run);
 *  - `AdminSobrusImportCard`: the admin's Catalogue « Importer les produits depuis Sobrus », on every page (the owner
 *    whose Sobrus account it reads never sees it). */
import { useMe } from "@/hooks/useMe";
import { Ban, CheckCircle2, ChevronDown, CircleAlert, CloudDownload, RefreshCw, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAdminSobrusImportWatcher } from "@/hooks/useAdminSobrusImportWatcher";
import { useSobrusRunWatcher } from "@/hooks/useSobrusRunWatcher";
import { useT } from "@/i18n/I18nProvider";
import { type SobrusRun } from "@/types/sobrus";
import { cn } from "@/utils/cn";
import { formatDateTime, formatNumStr } from "@/utils/format";
import { currentStep, eventText, fileName, modeName, runResult } from "@/utils/sobrus";
import { Spinner } from "@/_components/atoms/Spinner";
import { SectionTitle } from "@/_components/atoms/SectionTitle";

/** The bar fills while a file is cut into packets (import) or the closing goes month by month; else it pulses. */
function progress(run: SobrusRun): number | null {
  if ((run.phase === "import" || run.phase === "closing") && run.chunk_total > 0) {
    return Math.round((run.chunk_current / run.chunk_total) * 100);
  }
  return null;
}

function RunCornerCard({
  run,
  running,
  title,
  titleIcon,
  what,
  label,
  added,
  result,
  onOpen,
  onStop,
  isStopping,
  onDismiss,
  facts,
}: {
  run: SobrusRun;
  running: boolean;
  title: string;
  titleIcon: ReactNode;
  /** Next to the title: « Ventes 2025 », « Pharmacie X ». */
  what: string;
  /** Under the title: the step now, or what the run was. */
  label: string;
  /** While running: « 1 234 ligne(s) ajoutée(s) jusqu'ici ». */
  added: string;
  /** Once ended: how it went. */
  result: string;
  onOpen: () => void;
  /** No « Arrêter » for a login check. */
  onStop: (() => void) | null;
  isStopping: boolean;
  onDismiss: () => void;
  /** In « Détails », above the steps: « Pages lues : 231 », « Produits ajoutés : 4 851 »… */
  facts: { label: string; value: string }[];
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const pct = running ? progress(run) : null;
  // Each step done, oldest first (`sobrus.event.*`); the run's own end is the line under the bar.
  const steps = run.events.filter((e) => !e.code.startsWith("run_"));
  const icon = running ? (
    <Spinner />
  ) : run.status === "success" ? (
    <CheckCircle2 className="size-4" />
  ) : (
    <CircleAlert className="size-4" />
  );

  return (
    <section
      aria-label={title}
      aria-live="polite" // its steps read out as they change, like the import cards
      className="rounded-2xl border border-border bg-card shadow-lg"
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full cursor-pointer items-center gap-3 px-4 pt-3 text-left"
      >
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            {titleIcon}
            <SectionTitle as="span" size="sm">
              {title}
            </SectionTitle>
            {what && <span className="truncate text-sm font-semibold text-foreground">{what}</span>}
          </div>
          <span className="truncate text-sm font-medium text-foreground" title={label}>
            {label}
          </span>
        </div>
      </button>

      {running ? (
        <div className="space-y-2 px-4 pb-3 pt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-subtle">
            <span
              className={cn(
                "block h-full rounded-full bg-primary transition-[width] duration-300",
                pct == null && "w-1/3 animate-pulse",
              )}
              style={pct != null ? { width: `${pct}%` } : undefined}
            />
          </div>
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>{added}</span>
            {onStop && (
              <button
                type="button"
                onClick={onStop}
                disabled={isStopping || run.cancel_requested}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-destructive/30 px-2.5 py-1 font-semibold text-destructive hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Ban className="size-4" />
                {t("sobrus.stop")}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2 px-4 pb-3 pt-1 text-sm">
          <span
            className={cn(
              run.status === "success" && "text-success",
              run.status === "cancelled" && "text-warning",
              run.status === "error" && "text-error",
            )}
          >
            {result}
          </span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t("common.close")}
            className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="border-t border-border">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          {open ? t("sobrus.hideDetails") : t("sobrus.showDetails")}
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        {open && (
          <div className="flex max-h-72 flex-col gap-2 overflow-y-auto px-4 pb-3 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              {[
                ...(run.started_at ? [{ label: t("sobrus.startedAt"), value: formatDateTime(run.started_at) }] : []),
                ...facts,
              ].map((f) => (
                <div key={f.label} className="contents">
                  <dt className="text-muted-foreground">{f.label}</dt>
                  <dd className="text-right font-mono font-semibold text-foreground">{f.value}</dd>
                </div>
              ))}
            </dl>
            {steps.length > 0 && (
              <ol className="flex flex-col gap-1 border-t border-border pt-2">
                {steps.map((e, i) => (
                  <li key={`${e.at}-${i}`} className="flex gap-2">
                    <span className="shrink-0 font-mono text-muted-foreground">{formatDateTime(e.at).slice(-5)}</span>
                    <span className="text-foreground">{eventText(t, e)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export function SobrusRunCard() {
  const t = useT();
  const { me } = useMe();
  const role = me?.role;
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { activeRun, endedRun, dismissEnded, cancelRun, isCancelling } = useSobrusRunWatcher();
  const run = activeRun ?? endedRun;
  if (!run || pathname === `/${role}/sobrus`) return null; // its page shows the whole run
  const running = run === activeRun;
  return (
    <RunCornerCard
      run={run}
      running={running}
      title={t("sobrus.cornerTitle")}
      titleIcon={<RefreshCw className="size-3 text-muted-foreground" aria-hidden />}
      what={running ? fileName(t, run) : ""}
      label={running ? currentStep(t, run) : modeName(t, run)}
      added={t("sobrus.addedSoFar", { n: formatNumStr(run.lines_added) })}
      result={runResult(t, run)}
      onOpen={() => nav(`/${role}/sobrus`)}
      onStop={run.mode !== "check" ? () => void cancelRun(run.id) : null}
      isStopping={isCancelling}
      onDismiss={dismissEnded}
      facts={[{ label: t("sobrus.factLines"), value: formatNumStr(run.lines_added) }]}
    />
  );
}

export function AdminSobrusImportCard() {
  const t = useT();
  const { me } = useMe();
  const role = me?.role;
  const nav = useNavigate();
  const { activeRun, endedRun, pharmacyName, dismissEnded, cancelImport, isCancelling } =
    useAdminSobrusImportWatcher(true);
  const run = activeRun ?? endedRun;
  if (!run) return null;
  const running = run === activeRun;
  return (
    <RunCornerCard
      run={run}
      running={running}
      title={t("catalogue.sobrusCornerTitle")}
      titleIcon={<CloudDownload className="size-3 text-muted-foreground" aria-hidden />}
      what={pharmacyName}
      label={running ? currentStep(t, run) : t("catalogue.sobrusImport")}
      added={t("catalogue.sobrusAddedSoFar", { n: formatNumStr(run.lines_added) })}
      result={runResult(t, run)}
      onOpen={() => nav(`/${role}/catalogue`)}
      onStop={() => void cancelImport()}
      isStopping={isCancelling}
      onDismiss={dismissEnded}
      facts={[
        { label: t("catalogue.factAccount"), value: pharmacyName },
        { label: t("catalogue.factPages"), value: formatNumStr(run.chunk_current) },
        { label: t("catalogue.factAdded"), value: formatNumStr(run.lines_added) },
        { label: t("catalogue.factRead"), value: formatNumStr(run.chunk_current * 21) },
      ]}
    />
  );
}
