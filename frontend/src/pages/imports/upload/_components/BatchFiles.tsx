import { CheckCircle2, UploadCloud, X, AlertCircle, Ban, Clock } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import { formatNumStr } from "@/utils/format";
import type { UploadJob } from "@/hooks/UploadContext";
import { Button } from "@/_components/atoms/Button";
import { Spinner } from "@/_components/atoms/Spinner";
import { Card } from "@/_components/atoms/Card";
import { skipReasonsOf } from "./skipReasons";

/** Files imported together: one line each, in the order they run (en attente → en cours % →
 *  « N lignes importées » / erreur / annulé). Cancel the rest while it runs, then « Nouvel import ». */
export function BatchFiles({
  jobs,
  onCancel,
  onNewImport,
}: {
  jobs: UploadJob[];
  onCancel: () => void;
  onNewImport: () => void;
}) {
  const t = useT();
  const running = jobs.some((j) => j.phase === "queued" || j.phase === "uploading");
  const done = jobs.filter((j) => j.phase !== "queued" && j.phase !== "uploading").length;
  return (
    <div className="flex flex-col gap-4">
      <Card as="div" padding="none">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
          <h3 className="text-base font-semibold text-foreground">{t("uploadFile.batchTitle", { n: jobs.length })}</h3>
          <span className="text-sm text-muted-foreground">
            {t("uploadFile.batchProgress", { done, n: jobs.length })}
          </span>
        </div>
        <ul className="divide-y divide-border">
          {jobs.map((j) => {
            const pct = j.progress.total ? Math.round((j.progress.current / j.progress.total) * 100) : 0;
            return (
              <li key={j.id} className="flex flex-col gap-2 px-5 py-3">
                <div className="flex items-center gap-3">
                  {j.phase === "queued" && <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                  {j.phase === "uploading" && <Spinner className="text-primary" />}
                  {j.phase === "success" && <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />}
                  {j.phase === "error" && <AlertCircle className="size-4 shrink-0 text-error" aria-hidden />}
                  {j.phase === "cancelled" && <Ban className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                  <span className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">{j.filename}</span>
                  <span
                    className={cn(
                      "shrink-0 text-sm",
                      j.phase === "success"
                        ? "font-semibold text-success"
                        : j.phase === "error"
                          ? "text-error"
                          : "text-muted-foreground",
                    )}
                  >
                    {j.phase === "queued" && t("uploadFile.batchQueued")}
                    {j.phase === "uploading" && t("uploadFile.batchRunning", { pct })}
                    {j.phase === "success" && `${formatNumStr(j.progress.inserted)} ${t("uploadFile.linesImported")}`}
                    {j.phase === "error" && (j.error ?? t("uploadFile.unknownError"))}
                    {j.phase === "cancelled" && t("uploadFile.cancelledTitle")}
                  </span>
                </div>
                {j.phase === "success" &&
                  (skipReasonsOf(t, j.progress, j.stockResult).length > 0 || !!j.progress.new_medicaments?.count) && (
                    <p className="pl-7 text-xs text-muted-foreground">
                      {[
                        ...skipReasonsOf(t, j.progress, j.stockResult),
                        ...(j.progress.new_medicaments?.count
                          ? [
                              `${formatNumStr(j.progress.new_medicaments.count)} ${
                                j.progress.new_medicaments.count > 1
                                  ? t("uploadFile.newProductPlural")
                                  : t("uploadFile.newProductSingular")
                              }`,
                            ]
                          : []),
                      ].join(" · ")}
                    </p>
                  )}
                {j.phase === "uploading" && (
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-subtle">
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      <div className="flex justify-end">
        {running ? (
          <Button variant="outline" onClick={onCancel}>
            <X className="size-4" />
            {t("uploadFile.cancelAll")}
          </Button>
        ) : (
          <Button onClick={onNewImport}>
            <UploadCloud className="size-4" />
            {t("uploadFile.newImport")}
          </Button>
        )}
      </div>
    </div>
  );
}
