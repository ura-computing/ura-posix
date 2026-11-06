/** Catalogue « Produits depuis Sobrus »: one button reads the products of one owner's Sobrus account (the next one if
 *  Sobrus refuses it): new products added, empty fields filled. While it runs: what the robot does + « Arrêter »;
 *  after: each account tried and how it ended. The CSV import stays for when Sobrus fails. */
import { CloudDownload, Square } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { Card } from "@/_components/atoms/Card";
import { SectionTitle } from "@/_components/atoms/SectionTitle";
import type { SobrusRun } from "@/types";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import { formatDateTime } from "@/utils/format";
import { currentStep, runResult } from "@/utils/sobrus";

import { useSobrusProductsImport } from "../hooks";

const RESULT_TONE: Record<SobrusRun["status"], string> = {
  queued: "text-muted-foreground",
  running: "text-foreground",
  success: "text-success",
  error: "text-error",
  cancelled: "text-muted-foreground",
};

/** Sobrus refused this owner's account (the next one is tried), or did not answer (the CSV import stays). */
const REFUSED = ["sobrusNoAccess", "sobrusBadCredentials", "sobrusNeedsAction"];
const failure = (t: TFn, run: SobrusRun) =>
  t(REFUSED.includes(run.error_code ?? "") ? "catalogue.sobrusRefused" : "catalogue.sobrusFailed");

export function SobrusImportCard() {
  const t = useT();
  const { sobrusImport, isLoading, isRunning, startImport, isStarting, stopImport, isCancelling } =
    useSobrusProductsImport();
  const connected = sobrusImport?.connected ?? 0;
  const runs = sobrusImport?.runs ?? [];
  const reason = connected === 0 ? t("catalogue.sobrusNoneConnected") : isRunning ? t("catalogue.sobrusBusy") : null;
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-3xl flex-col gap-1">
          <SectionTitle>{t("catalogue.sobrusTitle")}</SectionTitle>
          <p className="text-sm text-muted-foreground">{t("catalogue.sobrusHint", { n: connected })}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex flex-wrap items-center gap-2">
            {isRunning && (
              <Button variant="secondary" onClick={() => void stopImport()} isLoading={isCancelling}>
                <Square className="size-4" />
                {t("sobrus.stop")}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => void startImport()}
              disabled={isLoading || reason !== null}
              isLoading={isStarting}
            >
              <CloudDownload className="size-4" />
              {t("catalogue.sobrusImport")}
            </Button>
          </div>
          {reason && <span className="text-xs text-muted-foreground">{reason}</span>}
        </div>
      </div>
      {runs.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {runs.map(({ pharmacy_name, run }) => {
            const active = run.status === "queued" || run.status === "running";
            return (
              <li key={run.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5">
                <span className="text-sm font-medium text-foreground">
                  {t("catalogue.sobrusAccount", { name: pharmacy_name })}
                </span>
                <span className={cn("text-sm", RESULT_TONE[run.status])}>
                  {active ? currentStep(t, run) : run.status === "error" ? failure(t, run) : runResult(t, run)}
                  {run.ended_at && (
                    <span className="ml-2 text-xs text-muted-foreground">{formatDateTime(run.ended_at)}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
