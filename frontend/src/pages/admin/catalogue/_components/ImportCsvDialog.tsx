/** CSV import dialog for the admin catalog. File picker → submit → result toast. */
import { useState } from "react";
import { FileSpreadsheet, UploadCloud } from "lucide-react";

import { AsyncButton } from "@/components/shared/AsyncButton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import type { CatalogImportResponse } from "@/types";


export interface ImportCsvDialogProps {
  open:        boolean;
  onClose:     () => void;
  onSubmit:    (file: File) => void;
  isLoading:   boolean;
  lastResult?: CatalogImportResponse;
}


export function ImportCsvDialog({ open, onClose, onSubmit, isLoading, lastResult }: ImportCsvDialogProps) {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.toLowerCase().endsWith(".csv")) setFile(f);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isLoading && onClose()}>
      <DialogContent className="max-w-xl">
        <div className="flex flex-col gap-4 p-5">
          <header>
            <h2 className="text-base font-semibold tracking-tight text-foreground">{t("catalogue.importTitle")}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("catalogue.importHelp", { headers: "Nom, Categorie, TVA, PPV, PPH, Code barre 1, Code barre 2, Laboratoire" })}
            </p>
          </header>

          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-border bg-surface-subtle/40 hover:bg-surface-subtle",
            )}
          >
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <>
                <FileSpreadsheet className="size-8 text-primary" aria-hidden />
                <span className="text-sm font-semibold text-foreground">{file.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
              </>
            ) : (
              <>
                <UploadCloud className="size-8 text-muted-foreground" aria-hidden />
                <span className="text-sm font-medium text-foreground">{t("catalogue.dropPrompt")}</span>
                <span className="text-xs text-muted-foreground">{t("catalogue.csvOnly")}</span>
              </>
            )}
          </label>

          {lastResult && (
            <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-card p-3 text-sm sm:grid-cols-4">
              <Stat label={t("catalogue.statRead")}      value={lastResult.total_rows} />
              <Stat label={t("catalogue.statInserted")}  value={lastResult.inserted} tone="success" />
              <Stat label={t("catalogue.statUpdated")} value={lastResult.updated} tone="info" />
              <Stat label={t("catalogue.statSkipped")}  value={lastResult.skipped} tone={lastResult.skipped > 0 ? "warning" : "muted"} />
              {lastResult.errors.length > 0 && (
                <div className="sm:col-span-4 mt-1 max-h-32 overflow-auto rounded-md bg-warning/10 p-2 text-xs text-warning">
                  {lastResult.errors.map((e, i) => <div key={i}>• {e}</div>)}
                </div>
              )}
            </div>
          )}

          <footer className="mt-1 flex justify-end gap-2 border-t border-border pt-3">
            <AsyncButton variant="ghost" type="button" onClick={onClose} disabled={isLoading}>
              {lastResult ? t("common.close") : t("common.cancel")}
            </AsyncButton>
            <AsyncButton
              type="button"
              variant="primary"
              disabled={!file}
              isLoading={isLoading}
              loadingText={t("catalogue.importing")}
              onClick={() => file && onSubmit(file)}
            >
              {t("common.import")}
            </AsyncButton>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function Stat({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "success" | "info" | "warning" | "muted" }) {
  const cls = {
    default: "text-foreground",
    success: "text-success",
    info:    "text-info",
    warning: "text-warning",
    muted:   "text-muted-foreground",
  }[tone];
  return (
    <div className="flex flex-col items-center">
      <span className={cn("font-mono text-xl font-bold tabular-nums", cls)}>{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}
