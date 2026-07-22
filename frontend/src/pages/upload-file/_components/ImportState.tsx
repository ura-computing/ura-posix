import { AlertCircle, Ban, CheckCircle2, Clock, Info, Loader2, RotateCcw, X } from "lucide-react";

import { formatNumStr, formatQty } from "@/utils/format";
import type { DocType, UploadStockResult } from "@/types";
import { useT } from "@/i18n/I18nProvider";

import type { UploadPhase, UploadProgress } from "@/contexts/UploadContext";


interface ImportStateProps {
  docType:    DocType;
  /** "idle" = no job → return null. Otherwise render the matching card. */
  phase:      UploadPhase | "idle";
  progress:   UploadProgress;
  error:      string | null;
  /** May be null when phase="idle" (no job) — guarded by the early return. */
  filename:   string | null;
  stockResult: UploadStockResult | null;
  onCancel:   () => void;
  onReset:    () => void;
}


/**
 * Renders the 5 import-state cards (queued / uploading / success / cancelled / error).
 * Each card is tinted with the active doc-type's color. Returns null on 'idle'.
 */

export function ImportState({
  docType, phase, progress, error, filename, stockResult, onCancel, onReset,
}: ImportStateProps) {
  if (phase === "idle") return null;

  if (phase === "queued")      return <Queued     docType={docType} filename={filename ?? ""} onCancel={onCancel} />;
  if (phase === "uploading")   return <Uploading  docType={docType} progress={progress} onCancel={onCancel} />;
  if (phase === "success")     return <Success    docType={docType} progress={progress} filename={filename ?? ""} stockResult={stockResult} onReset={onReset} />;
  if (phase === "cancelled")   return <Cancelled  progress={progress} onReset={onReset} />;
  return <Errored error={error} onDismiss={onReset} />;
}


function Queued({ docType, filename, onCancel }: { docType: DocType; filename: string; onCancel: () => void }) {
  const t = useT();
  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border p-5"
      style={{ borderColor: `var(--color-doc-${docType}-border)`, background: `var(--color-doc-${docType}-bg)` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Clock className="size-4" style={{ color: `var(--color-doc-${docType})` }} />
          {t("uploadFile.queuedTitle")}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-destructive/30 bg-card px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/5"
        >
          <X className="size-3.5" />
          {t("uploadFile.removeFromQueue")}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("uploadFile.queuedHint")}
      </p>
      {filename && (
        <p className="font-mono text-[11px] text-muted-foreground">{filename}</p>
      )}
    </div>
  );
}


// ─── Sub-components ───────────────────────────────────────────────────────────

function Uploading({ docType, progress, onCancel }: { docType: DocType; progress: UploadProgress; onCancel: () => void }) {
  const t = useT();
  const ring = `var(--color-doc-${docType})`;
  const pct  = progress.total ? Math.round((progress.current / progress.total) * 100) : 0;
  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border p-5"
      style={{ borderColor: `var(--color-doc-${docType}-border)`, background: `var(--color-doc-${docType}-bg)` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Loader2 className="size-4 animate-spin" style={{ color: ring }} />
          {t("uploadFile.uploading")}
        </h3>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {t("uploadFile.lot")} {progress.current} / {progress.total}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-subtle">
        <span
          className="block h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%`, background: ring }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{pct} % {t("uploadFile.completed")} — {formatQty(progress.inserted)} {t("uploadFile.inserted")}, {formatQty(progress.skipped)} {t("uploadFile.ignored")}</span>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-destructive/30 bg-card px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/5"
        >
          <Ban className="size-3.5" />
          {t("uploadFile.cancelImport")}
        </button>
      </div>
    </div>
  );
}


function Success({
  docType, progress, filename, stockResult, onReset,
}: { docType: DocType; progress: UploadProgress; filename: string; stockResult: UploadStockResult | null; onReset: () => void }) {
  const t = useT();
  const ring = `var(--color-doc-${docType})`;
  const newMeds = progress.new_medicaments;

  // Skip breakdown — stock surfaces unknowns via stockResult.skipped_unknown,
  // achat/vente use the per-reason counters now populated by the backend.
  // formatNumStr (plain string) NOT formatQty (returns JSX) — these build string
  // list items, and interpolating JSX into a template literal yields "[object Object]".
  const skipReasons: string[] = stockResult
    ? (stockResult.skipped_unknown.length > 0
        ? [t("uploadFile.skipUnknownPid", { n: formatNumStr(stockResult.skipped_unknown.length) })]
        : [])
    : [
        ...(progress.skipped_duplicate     ? [t("uploadFile.skipDuplicate", { n: formatNumStr(progress.skipped_duplicate) })]            : []),
        ...(progress.skipped_no_pid        ? [t("uploadFile.skipNoPid", { n: formatNumStr(progress.skipped_no_pid) })]                  : []),
        ...(progress.skipped_no_medicament ? [t("uploadFile.skipNoMed", { n: formatNumStr(progress.skipped_no_medicament) })] : []),
      ];
  // Defensive fallback: total skipped > 0 but no per-reason data (shouldn't happen).
  if (skipReasons.length === 0 && progress.skipped > 0) {
    skipReasons.push(t("uploadFile.skipGeneric", { n: formatNumStr(progress.skipped) }));
  }

  return (
    <div
      className="flex flex-col items-center gap-3 rounded-2xl border p-8 text-center"
      style={{ borderColor: `var(--color-doc-${docType}-border)`, background: `var(--color-doc-${docType}-bg)` }}
    >
      <div className="flex size-14 items-center justify-center rounded-full" style={{ background: `${ring}20`, color: ring }}>
        <CheckCircle2 className="size-7" aria-hidden />
      </div>
      <h3 className="text-xl font-semibold text-foreground">
        {formatQty(progress.inserted)} {t("uploadFile.linesImported")}
      </h3>
      {skipReasons.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-sm text-muted-foreground">
          {skipReasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}
      {newMeds && newMeds.count > 0 && (
        <div className="mt-1 flex w-full max-w-md flex-col gap-1.5 rounded-md border border-info-border bg-info-subtle px-4 py-3 text-left">
          <div className="flex items-center gap-2 text-sm font-semibold text-info">
            <Info className="size-4" aria-hidden />
            {formatQty(newMeds.count)} {newMeds.count > 1 ? t("uploadFile.newProductPlural") : t("uploadFile.newProductSingular")}
          </div>
          <p className="text-xs text-info-subtle-foreground">
            {newMeds.sample.slice(0, 3).join(" · ")}
            {newMeds.count > 3 && ` · +${newMeds.count - 3} ${newMeds.count - 3 > 1 ? t("uploadFile.others") : t("uploadFile.other")}`}
          </p>
          <p className="text-xs text-info-subtle-foreground">
            {t("uploadFile.newProductsNote")}
          </p>
        </div>
      )}
      <p className="font-mono text-[11px] text-muted-foreground">
        {filename}
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-subtle"
      >
        <RotateCcw className="size-4" />
        {t("uploadFile.newImport")}
      </button>
    </div>
  );
}


function Cancelled({ progress, onReset }: { progress: UploadProgress; onReset: () => void }) {
  const t = useT();
  const had = progress.inserted > 0;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-warning-border bg-warning-subtle p-5">
      <div className="flex items-start gap-3">
        <Ban className="size-5 text-warning" aria-hidden />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-warning">{t("uploadFile.cancelledTitle")}</h3>
          <p className="mt-0.5 text-xs text-warning-subtle-foreground">
            {had
              ? <>{formatQty(progress.inserted)} {t("uploadFile.cancelledHad")}</>
              : t("uploadFile.cancelledNone")}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex cursor-pointer items-center gap-2 self-start rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-subtle"
      >
        <RotateCcw className="size-3.5" />
        {t("uploadFile.restart")}
      </button>
    </div>
  );
}


function Errored({ error, onDismiss }: { error: string | null; onDismiss: () => void }) {
  const t = useT();
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-error-border bg-error-subtle p-5">
      <AlertCircle className="size-5 text-error" aria-hidden />
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-error">{t("uploadFile.errorTitle")}</h3>
        <p className="mt-0.5 text-xs text-error-subtle-foreground">
          {error ?? t("uploadFile.unknownError")}
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("common.close")}
        className="cursor-pointer text-error-subtle-foreground/70 hover:text-error-subtle-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}