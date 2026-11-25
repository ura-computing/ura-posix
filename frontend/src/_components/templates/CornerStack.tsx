/** Bottom-right, on every page: the Sobrus robot's run (owners with « Connexion Sobrus »), the admin's Catalogue
 *  « Importer les produits depuis Sobrus », then the files being imported. */
import { useMe } from "@/hooks/useMe";
import { useNavigate } from "react-router-dom";

import { Ban, CheckCircle2, Clock, FileSpreadsheet, X } from "lucide-react";
import type { DocType } from "@/types/imports";
import { useT } from "@/i18n/I18nProvider";
import { AdminSobrusImportCard, SobrusRunCard } from "@/_components/organisms/SobrusRunCard";
import { useUploadCtx, type UploadJob } from "@/hooks/useUpload";
import { formatQty } from "@/utils/format";
import { Spinner } from "@/_components/atoms/Spinner";
import { SectionTitle } from "@/_components/atoms/SectionTitle";

const TYPE_LABEL: Record<DocType, string> = {
  achat: "upload.typeAchat",
  vente: "upload.typeVente",
  stock: "upload.typeStock",
};

/** Cap visible cards — older finished ones drop off the bottom of the stack.
 *  Auto-dismiss already trims successful ones; this is the floor for everything
 *  else (queue length, cancelled, errored). */
const MAX_VISIBLE = 3;

function UploadProgressWidget() {
  const t = useT();
  const { me } = useMe();
  const role = me?.role;
  const { jobs: all, cancelUpload, dismissJob } = useUploadCtx();
  const nav = useNavigate();
  // Files imported together leave the corner 4 s after their success (their wizard list keeps them).
  const jobs = all.filter((j) => !j.hidden);

  if (jobs.length === 0) return null;

  // Queued jobs sorted FIFO so we can label them "1ᵉʳ en file / 2e / …".
  const queuedOrdered = jobs.filter((j) => j.phase === "queued").sort((a, b) => a.createdAt - b.createdAt);

  // Newest first in the visual stack so the running job stays at the top while
  // pending ones pile up below.
  const visible = [...jobs].sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_VISIBLE);

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2">
      {visible.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          queuePosition={job.phase === "queued" ? queuedOrdered.indexOf(job) + 1 : null}
          onOpenWizard={() => nav(`/${role}/upload-file?type=${job.docType}`)}
          onCancel={() => cancelUpload(job.id)}
          onDismiss={() => dismissJob(job.id)}
        />
      ))}
      {jobs.length > MAX_VISIBLE && (
        <button
          type="button"
          onClick={() => nav(`/${role}/upload-file?type=${visible[visible.length - 1].docType}`)}
          className="cursor-pointer self-end rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-md hover:text-foreground"
        >
          {t("upload.moreJobs", { n: jobs.length - MAX_VISIBLE })}
        </button>
      )}
    </div>
  );
}

function JobCard({
  job,
  queuePosition,
  onOpenWizard,
  onCancel,
  onDismiss,
}: {
  job: UploadJob;
  queuePosition: number | null;
  onOpenWizard: () => void;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  const t = useT();
  const tint = `var(--color-doc-${job.docType})`;
  const tintBg = `var(--color-doc-${job.docType}-bg)`;
  const border = `var(--color-doc-${job.docType}-border)`;
  const pct = job.progress.total ? Math.round((job.progress.current / job.progress.total) * 100) : 0;

  return (
    <div className="rounded-2xl border bg-card shadow-lg" style={{ borderColor: border }}>
      <button
        type="button"
        onClick={onOpenWizard}
        className="flex w-full cursor-pointer items-center gap-3 px-4 pt-3 text-left"
      >
        <div className="flex size-9 items-center justify-center rounded-xl" style={{ background: tintBg, color: tint }}>
          {job.phase === "uploading" ? (
            <Spinner />
          ) : job.phase === "success" ? (
            <CheckCircle2 className="size-4" />
          ) : job.phase === "queued" ? (
            <Clock className="size-4" />
          ) : (
            <FileSpreadsheet className="size-4" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <SectionTitle as="span" size="sm">
              {t(TYPE_LABEL[job.docType])}
            </SectionTitle>
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
            <span>
              {pct}% · {formatQty(job.progress.inserted)} {t("upload.inserted")}
            </span>
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
          {job.progress.skipped > 0 ? (
            <>
              {" "}
              · {formatQty(job.progress.skipped)} {t("upload.skipped")}
            </>
          ) : null}
        </p>
      )}

      {job.phase === "cancelled" && (
        <div className="flex items-center justify-between px-4 pb-3 text-xs">
          <span className="text-warning">{t("upload.cancelled")}</span>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t("common.close")}
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {job.phase === "error" && (
        <div className="flex items-start justify-between gap-2 px-4 pb-3 text-xs">
          <span className="text-error">{job.error ?? t("upload.importError")}</span>
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
    </div>
  );
}

/** Above the lists' bottom bar (« Précédent / Suivant », rows per page: sticky, ≈ 80 px high), never on it. */
export function CornerStack({ sobrusOwner, admin }: { sobrusOwner: boolean; admin: boolean }) {
  return (
    <div className="fixed bottom-24 right-4 z-50 flex w-[400px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {sobrusOwner && <SobrusRunCard />}
      {admin && <AdminSobrusImportCard />}
      <UploadProgressWidget />
    </div>
  );
}
