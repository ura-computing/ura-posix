import { useNavigate } from "react-router-dom";
import { useT } from "@/i18n/I18nProvider";
import { Ban, CheckCircle2, Clock, FileSpreadsheet, Loader2, X } from "lucide-react";

import { useUploadCtx, type UploadJob } from "@/contexts/UploadContext";
import { formatQty } from "@/utils/format";
import { ROUTES } from "@/types";
import type { DocType } from "@/types";


/**
 * Fixed bottom-right widget — renders one card per non-dismissed job on EVERY
 * route, including /upload-file. With concurrency=1 we typically see: 1
 * running + N queued + recent successes fading out. Auto-dismiss for
 * "success" is owned by UploadContext (per-job timer); cancelled/error stay
 * until the user closes them.
 *
 * The wizard at /upload-file shows ONE doc-type's job inline as a bigger
 * card — that's the same data as one of the widget cards, intentional
 * duplication for full visibility per the user's request.
 *
 * Click a card body → /upload-file?type=<docType> so the wizard rehydrates
 * onto the matching job.
 */

const TYPE_LABEL: Record<DocType, string> = {
  achat: "upload.typeAchat", vente: "upload.typeVente", stock: "upload.typeStock",
};

/** Cap visible cards — older finished ones drop off the bottom of the stack.
 *  Auto-dismiss already trims successful ones; this is the floor for everything
 *  else (queue length, cancelled, errored). */
const MAX_VISIBLE = 5;


export function UploadProgressWidget() {
  const { jobs, cancelUpload, dismissJob } = useUploadCtx();
  const nav = useNavigate();

  if (jobs.length === 0) return null;

  // Queued jobs sorted FIFO so we can label them "1ᵉʳ en file / 2e / …".
  const queuedOrdered = jobs
    .filter((j) => j.phase === "queued")
    .sort((a, b) => a.createdAt - b.createdAt);

  // Newest first in the visual stack so the running job stays at the top while
  // pending ones pile up below.
  const visible = [...jobs].sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_VISIBLE);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex w-[320px] flex-col gap-2"
    >
      {visible.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          queuePosition={job.phase === "queued" ? queuedOrdered.indexOf(job) + 1 : null}
          onOpenWizard={() => nav(`${ROUTES.UPLOAD_FILE}?type=${job.docType}`)}
          onCancel={() => cancelUpload(job.id)}
          onDismiss={() => dismissJob(job.id)}
        />
      ))}
    </div>
  );
}


function JobCard({
  job, queuePosition, onOpenWizard, onCancel, onDismiss,
}: {
  job:           UploadJob;
  queuePosition: number | null;
  onOpenWizard:  () => void;
  onCancel:      () => void;
  onDismiss:     () => void;
}) {
  const t      = useT();
  const tint   = `var(--color-doc-${job.docType})`;
  const tintBg = `var(--color-doc-${job.docType}-bg)`;
  const border = `var(--color-doc-${job.docType}-border)`;
  const pct    = job.progress.total
    ? Math.round((job.progress.current / job.progress.total) * 100)
    : 0;

  return (
    <div
      className="rounded-2xl border bg-card shadow-lg"
      style={{ borderColor: border }}
    >
      <button
        type="button"
        onClick={onOpenWizard}
        className="flex w-full cursor-pointer items-center gap-3 px-4 pt-3 text-left"
      >
        <div
          className="flex size-9 items-center justify-center rounded-xl"
          style={{ background: tintBg, color: tint }}
        >
          {job.phase === "uploading" ? <Loader2 className="size-4 animate-spin" />
            : job.phase === "success" ? <CheckCircle2 className="size-4" />
            : job.phase === "queued"  ? <Clock className="size-4" />
            : <FileSpreadsheet className="size-4" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(TYPE_LABEL[job.docType])}
            </span>
            {job.phase === "uploading" && (
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {t("upload.lot", { current: job.progress.current, total: job.progress.total })}
              </span>
            )}
            {job.phase === "queued" && queuePosition != null && (
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {queuePosition === 1 ? t("upload.firstInQueue") : t("upload.nInQueue", { n: queuePosition })}
              </span>
            )}
          </div>
          <span className="truncate text-sm font-medium text-foreground" title={job.filename}>
            {job.filename}
          </span>
        </div>
      </button>

      {job.phase === "uploading" && (
        <div className="space-y-2 px-4 pb-3 pt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-subtle">
            <span
              className="block h-full rounded-full transition-[width] duration-300"
              style={{ width: `${pct}%`, background: tint }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{pct}% · {formatQty(job.progress.inserted)} {t("upload.inserted")}</span>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-destructive/30 px-2 py-0.5 font-semibold text-destructive hover:bg-destructive/5"
            >
              <Ban className="size-3" />
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {job.phase === "queued" && (
        <div className="flex items-center justify-between px-4 pb-3 pt-1 text-[11px] text-muted-foreground">
          <span>{t("upload.waiting")}</span>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t("upload.removeFromQueue")}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {job.phase === "success" && (
        <p className="px-4 pb-3 text-xs text-muted-foreground">
          {formatQty(job.progress.inserted)} {t("upload.linesImported")}
          {job.progress.skipped > 0 ? <> · {formatQty(job.progress.skipped)} {t("upload.skipped")}</> : null}
        </p>
      )}

      {job.phase === "cancelled" && (
        <div className="flex items-center justify-between px-4 pb-3 text-xs">
          <span className="text-warning">{t("upload.cancelled")}</span>
          <button type="button" onClick={onDismiss} aria-label={t("common.close")} className="cursor-pointer text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {job.phase === "error" && (
        <div className="flex items-start justify-between gap-2 px-4 pb-3 text-xs">
          <span className="text-error">{job.error ?? t("upload.importError")}</span>
          <button type="button" onClick={onDismiss} aria-label={t("common.close")} className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
