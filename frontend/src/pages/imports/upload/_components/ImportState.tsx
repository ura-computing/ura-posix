import { CheckCircle2, X, Ban, Clock, Loader2, RotateCcw } from "lucide-react";
import type { DocType, UploadStockResult } from "@/types";
import { useT } from "@/i18n/I18nProvider";
import { formatQty } from "@/utils/format";
import type { UploadPhase, UploadProgress } from "@/hooks/UploadContext";
import { Button } from "@/_components/atoms/Button";
import { Callout } from "@/_components/molecules/Callout";
import { skipReasonsOf } from "./skipReasons";

interface ImportStateProps {
  docType: DocType;
  /** "idle" = no job → return null. Otherwise render the matching card. */
  phase: UploadPhase | "idle";
  progress: UploadProgress;
  error: string | null;
  /** May be null when phase="idle" (no job) — guarded by the early return. */
  filename: string | null;
  stockResult: UploadStockResult | null;
  onCancel: () => void;
  onReset: () => void;
}

/**
 * Renders the 5 import-state cards (queued / uploading / success / cancelled / error).
 * Each card is tinted with the active doc-type's color. Returns null on 'idle'.
 */

export function ImportState({
  docType,
  phase,
  progress,
  error,
  filename,
  stockResult,
  onCancel,
  onReset,
}: ImportStateProps) {
  if (phase === "idle") return null;

  if (phase === "queued") return <Queued docType={docType} filename={filename ?? ""} onCancel={onCancel} />;
  if (phase === "uploading") return <Uploading docType={docType} progress={progress} onCancel={onCancel} />;
  if (phase === "success")
    return (
      <Success
        docType={docType}
        progress={progress}
        filename={filename ?? ""}
        stockResult={stockResult}
        onReset={onReset}
      />
    );
  if (phase === "cancelled") return <Cancelled progress={progress} onReset={onReset} />;
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
        <Button variant="danger-outline" size="sm" onClick={onCancel}>
          <X className="size-3.5" />
          {t("uploadFile.removeFromQueue")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("uploadFile.queuedHint")}</p>
      {filename && <p className="font-mono text-[11px] text-muted-foreground">{filename}</p>}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Uploading({
  docType,
  progress,
  onCancel,
}: {
  docType: DocType;
  progress: UploadProgress;
  onCancel: () => void;
}) {
  const t = useT();
  const ring = `var(--color-doc-${docType})`;
  const pct = progress.total ? Math.round((progress.current / progress.total) * 100) : 0;
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
        <span>
          {pct} % {t("uploadFile.completed")} — {formatQty(progress.inserted)} {t("uploadFile.inserted")},{" "}
          {formatQty(progress.skipped)} {t("uploadFile.ignored")}
        </span>
        <Button variant="danger-outline" size="sm" onClick={onCancel}>
          <Ban className="size-3.5" />
          {t("uploadFile.cancelImport")}
        </Button>
      </div>
    </div>
  );
}

export function Success({
  docType,
  progress,
  filename,
  stockResult,
  onReset,
}: {
  docType: DocType;
  progress: UploadProgress;
  filename: string;
  stockResult: UploadStockResult | null;
  onReset: () => void;
}) {
  const t = useT();
  const ring = `var(--color-doc-${docType})`;
  const newMeds = progress.new_medicaments;

  const skipReasons = skipReasonsOf(t, progress, stockResult);

  return (
    <div
      className="flex flex-col items-center gap-3 rounded-2xl border p-8 text-center"
      style={{ borderColor: `var(--color-doc-${docType}-border)`, background: `var(--color-doc-${docType}-bg)` }}
    >
      <div
        className="flex size-14 items-center justify-center rounded-full"
        style={{ background: `${ring}20`, color: ring }}
      >
        <CheckCircle2 className="size-7" aria-hidden />
      </div>
      <h3 className="text-xl font-semibold text-foreground">
        {formatQty(progress.inserted)} {t("uploadFile.linesImported")}
      </h3>
      {skipReasons.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-sm text-muted-foreground">
          {skipReasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {newMeds && newMeds.count > 0 && (
        <Callout
          tone="info"
          className="mt-1 w-full max-w-md text-left"
          title={
            <>
              {formatQty(newMeds.count)}{" "}
              {newMeds.count > 1 ? t("uploadFile.newProductPlural") : t("uploadFile.newProductSingular")}
            </>
          }
        >
          <p>
            {newMeds.sample.slice(0, 3).join(" · ")}
            {newMeds.count > 3 &&
              ` · +${newMeds.count - 3} ${newMeds.count - 3 > 1 ? t("uploadFile.others") : t("uploadFile.other")}`}
          </p>
          <p className="font-normal">{t("uploadFile.newProductsNote")}</p>
        </Callout>
      )}
      <p className="font-mono text-[11px] text-muted-foreground">{filename}</p>
      <Button variant="outline" className="mt-2" onClick={onReset}>
        <RotateCcw className="size-4" />
        {t("uploadFile.newImport")}
      </Button>
    </div>
  );
}

function Cancelled({ progress, onReset }: { progress: UploadProgress; onReset: () => void }) {
  const t = useT();
  const had = progress.inserted > 0;
  return (
    <Callout
      tone="warning"
      title={<h3>{t("uploadFile.cancelledTitle")}</h3>}
      action={
        <Button variant="outline" onClick={onReset}>
          <RotateCcw className="size-3.5" />
          {t("uploadFile.restart")}
        </Button>
      }
    >
      {had ? (
        <>
          {formatQty(progress.inserted)} {t("uploadFile.cancelledHad")}
        </>
      ) : (
        t("uploadFile.cancelledNone")
      )}
    </Callout>
  );
}

function Errored({ error, onDismiss }: { error: string | null; onDismiss: () => void }) {
  const t = useT();
  return (
    <Callout tone="error" title={<h3>{t("uploadFile.errorTitle")}</h3>} onDismiss={onDismiss}>
      {error ?? t("uploadFile.unknownError")}
    </Callout>
  );
}
