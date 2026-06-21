import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Ban, CheckCircle2, FileSpreadsheet, Loader2, X } from "lucide-react";

import { useUploadCtx } from "@/contexts/UploadContext";
import { formatQty } from "@/utils/format";
import { ROUTES } from "@/types";
import type { DocType } from "@/types";


/**
 * Fixed bottom-right widget — only renders when an upload is active or just
 * finished. Source of truth lives in the global UploadContext so the widget
 * keeps reporting accurate progress regardless of which route is mounted.
 *
 * Auto-dismiss: success state fades after 4 s. Cancelled/Error stay until
 * the user closes them so they can read the message.
 *
 * Click the body (not the buttons) → navigate to /upload-file so the wizard
 * rehydrates at step 3 with the matching state card.
 */

const TYPE_LABEL: Record<DocType, string> = {
  achat: "Achats", vente: "Ventes", stock: "Stock",
};


export function UploadProgressWidget() {
  const upload  = useUploadCtx();
  const nav     = useNavigate();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(false);

  // Auto-dismiss success after 4s
  useEffect(() => {
    if (upload.phase !== "success") return;
    const t = setTimeout(() => { upload.reset(); }, 4000);
    return () => clearTimeout(t);
  }, [upload]);

  // Re-enable visibility when a new upload starts
  useEffect(() => {
    if (upload.phase === "uploading") setDismissed(false);
  }, [upload.phase]);

  // Hide while user is already on the wizard page — the page itself shows the state card.
  // `!docType` is structurally impossible when phase !== "idle" (the context sets both
  // together) but guards the typescript narrowing without inventing a fallback value.
  const onWizard = pathname === ROUTES.UPLOAD_FILE;
  if (upload.phase === "idle" || dismissed || onWizard || !upload.docType) return null;

  const { docType } = upload;
  const tint    = `var(--color-doc-${docType})`;
  const tintBg  = `var(--color-doc-${docType}-bg)`;
  const pct     = upload.progress.total
    ? Math.round((upload.progress.current / upload.progress.total) * 100)
    : 0;

  const goToWizard = () => nav(ROUTES.UPLOAD_FILE);
  const dismiss    = () => { upload.reset(); setDismissed(true); };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 w-[300px] rounded-2xl border bg-card shadow-lg"
      style={{ borderColor: `var(--color-doc-${docType}-border)` }}
    >
      <button
        type="button"
        onClick={goToWizard}
        className="flex w-full cursor-pointer items-center gap-3 px-4 pt-3 text-left"
      >
        <div className="flex size-9 items-center justify-center rounded-xl" style={{ background: tintBg, color: tint }}>
          {upload.phase === "uploading" ? <Loader2 className="size-4 animate-spin" />
            : upload.phase === "success" ? <CheckCircle2 className="size-4" />
            : <FileSpreadsheet className="size-4" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {TYPE_LABEL[docType]}
            </span>
            {upload.phase === "uploading" && (
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                Lot {upload.progress.current}/{upload.progress.total}
              </span>
            )}
          </div>
          <span className="truncate text-sm font-medium text-foreground" title={upload.filename ?? ""}>
            {upload.filename ?? "Import"}
          </span>
        </div>
      </button>

      {upload.phase === "uploading" && (
        <div className="space-y-2 px-4 pb-3 pt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-subtle">
            <span
              className="block h-full rounded-full transition-[width] duration-300"
              style={{ width: `${pct}%`, background: tint }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{pct}% · {formatQty(upload.progress.inserted)} insérées</span>
            <button
              type="button"
              onClick={upload.cancel}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-destructive/30 px-2 py-0.5 font-semibold text-destructive hover:bg-destructive/5"
            >
              <Ban className="size-3" />
              Annuler
            </button>
          </div>
        </div>
      )}

      {upload.phase === "success" && (
        <p className="px-4 pb-3 text-xs text-muted-foreground">
          {formatQty(upload.progress.inserted)} lignes importées
          {upload.progress.skipped > 0 ? <> · {formatQty(upload.progress.skipped)} ignorées</> : null}
        </p>
      )}

      {upload.phase === "cancelled" && (
        <div className="flex items-center justify-between px-4 pb-3 text-xs">
          <span className="text-warning">Import annulé. Données supprimées.</span>
          <button type="button" onClick={dismiss} aria-label="Fermer" className="cursor-pointer text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {upload.phase === "error" && (
        <div className="flex items-start justify-between gap-2 px-4 pb-3 text-xs">
          <span className="text-error">{upload.error ?? "Erreur d'importation."}</span>
          <button type="button" onClick={dismiss} aria-label="Fermer" className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}