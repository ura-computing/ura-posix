import { CheckCircle2, UploadCloud, AlertCircle } from "lucide-react";
import { useT } from "@/i18n/I18nProvider";
import { type PickedFile } from "../hooks";
import { formatDate, formatNumStr } from "@/utils/format";
import { Button } from "@/_components/atoms/Button";
import { Card } from "@/_components/atoms/Card";

/** Several files picked: one line each (period from its name, lines), a wrong one in red with
 *  why it is left out; « Importer les N fichiers » imports the good ones. */
export function PickedFiles({ files, onImport }: { files: PickedFile[]; onImport: () => void }) {
  const t = useT();
  const good = files.filter((f) => f.error === null);
  const total = good.reduce((n, f) => n + f.rows.length, 0);
  return (
    <div className="flex flex-col gap-4">
      <Card as="div" padding="none">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
          <h3 className="text-base font-semibold text-foreground">{t("uploadFile.manyTitle", { n: files.length })}</h3>
          <span className="text-sm text-muted-foreground">{t("uploadFile.manyTotal", { n: formatNumStr(total) })}</span>
        </div>
        <ul className="divide-y divide-border">
          {files.map((f) => (
            <li key={f.name} className="flex items-start gap-3 px-5 py-3">
              {f.error ? (
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-error" aria-hidden />
              ) : (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-mono text-sm text-foreground">{f.name}</span>
                {f.error ? (
                  <span className="text-sm text-error">{t("uploadFile.manySkipped", { reason: f.error })}</span>
                ) : (
                  f.dates && (
                    <span className="text-xs text-muted-foreground">
                      {t("uploadFile.manyPeriod", { from: formatDate(f.dates.from), to: formatDate(f.dates.to) })}
                    </span>
                  )
                )}
              </div>
              {!f.error && (
                <span className="shrink-0 font-mono text-sm text-foreground">
                  {t("uploadFile.manyLines", { n: formatNumStr(f.rows.length) })}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <div className="flex justify-end">
        <Button onClick={onImport} disabled={good.length === 0}>
          <UploadCloud className="size-4" />
          {t("uploadFile.manyImport", { n: good.length })}
        </Button>
      </div>
    </div>
  );
}
