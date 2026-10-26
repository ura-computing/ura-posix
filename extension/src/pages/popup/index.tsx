/** The extension's window: who is connected (else « Se connecter à PharmaGest »), the latest Sobrus
 *  files sent (live progress, « Annuler » while running), « Voir mes imports », the language. */
import { Button } from "@/_components/button";
import { useI18n } from "@/i18n/I18nProvider";
import { errorText } from "@/i18n/translate";
import type { ImportJob } from "@/types";
import { isRunning, jobStatus } from "@/utils/jobs";
import { openApp } from "@/utils/links";

import { usePopupPage } from "./hooks";

const PHASE_TONE: Record<ImportJob["phase"], string> = {
  queued: "bg-muted text-muted-foreground",
  uploading: "bg-info-subtle text-info-subtle-foreground",
  success: "bg-success-subtle text-success-subtle-foreground",
  cancelled: "bg-muted text-muted-foreground",
  error: "bg-error-subtle text-error-subtle-foreground",
};

function JobRow({ job, onCancel, isCancelling }: { job: ImportJob; onCancel: () => void; isCancelling: boolean }) {
  const { t } = useI18n();
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{t(`kind.${job.docType ?? "unknown"}`)}</span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ${PHASE_TONE[job.phase]}`}
        >
          {isRunning(job) && (
            <span
              className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden
            />
          )}
          {jobStatus(t, job)}
        </span>
      </div>
      <span className="break-all text-xs text-muted-foreground">{job.filename}</span>
      {job.phase === "uploading" && job.total > 0 && (
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${(job.current / job.total) * 100}%` }} />
        </div>
      )}
      {isRunning(job) && (
        <Button variant="secondary" onClick={onCancel} disabled={isCancelling}>
          {t("jobs.cancel")}
        </Button>
      )}
    </li>
  );
}

export default function PopupPage() {
  const { t, lang, setLang } = useI18n();
  const { me, isLoadingMe, meError, jobs, cancelImport, isCancelling, startFullExport, isStarting } = usePopupPage();
  return (
    <main className="flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-base font-bold text-primary">{t("app.name")}</span>
          <span className="text-xs text-muted-foreground">{t("app.subtitle")}</span>
        </div>
        <div role="group" aria-label={t("lang.label")} className="flex gap-1">
          {(["fr", "es"] as const).map((l) => (
            <Button
              key={l}
              variant={lang === l ? "primary" : "secondary"}
              className="px-2 py-1 text-xs"
              onClick={() => void setLang(l)}
            >
              {t(`lang.${l}`)}
            </Button>
          ))}
        </div>
      </header>

      <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-sm">
        {isLoadingMe ? (
          <span className="text-muted-foreground">{t("session.loading")}</span>
        ) : me ? (
          <>
            <span className="font-medium">{t("session.connected", { name: me.user.name ?? me.user.email })}</span>
            {me.pharmacy && (
              <span className="text-muted-foreground">{t("session.pharmacy", { name: me.pharmacy.name })}</span>
            )}
            <Button onClick={() => void startFullExport()} disabled={isStarting || !me.pharmacy}>
              {t("full.start")}
            </Button>
            <span className="text-xs text-muted-foreground">{t("full.hint")}</span>
          </>
        ) : (
          <>
            <span>
              {meError && meError.code !== "sessionExpired"
                ? errorText(t, { code: meError.code, detail: meError.detail })
                : t("session.none")}
            </span>
            <Button onClick={() => void openApp("/login")}>{t("session.login")}</Button>
          </>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("jobs.title")}</h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("jobs.none")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} onCancel={() => void cancelImport(job.id)} isCancelling={isCancelling} />
            ))}
          </ul>
        )}
        <Button variant="secondary" onClick={() => void openApp("/imports")}>
          {t("jobs.seeAll")}
        </Button>
      </section>
    </main>
  );
}
