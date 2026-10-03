import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  ShoppingBasket,
  ShoppingCart,
  UploadCloud,
  X,
  AlertCircle,
  Ban,
  Clock,
  Info,
  Loader2,
  RotateCcw,
  Check,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useSearchParams } from "react-router-dom";

import { useMe } from "@/hooks/useMe";
import { ROLES } from "@/types";
import type { DocType, Feature, UploadStockResult } from "@/types";
import { useT, type TFn } from "@/i18n/I18nProvider";

import { useUpload }    from "./hooks";
import { cn } from "@/utils/cn";
import { formatNumStr, formatQty } from "@/utils/format";
import type { UploadPhase, UploadProgress } from "@/hooks/UploadContext";
import type { ReactNode } from "react";

interface DropZoneProps {
  docType:  DocType;
  example:  string;
  onAccept: (file: File) => void;
  errorMsg: string | null;
  onClearError: () => void;
}

/**
 * Step-2 drag-drop zone. Tinted with the matching --color-doc-* on drag-over.
 * Click to open the native file picker. Native file input is hidden inside
 * the zone so the entire surface is clickable.
 */

function DropZone({ docType, example, onAccept, errorMsg, onClearError }: DropZoneProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const ring = `var(--color-doc-${docType})`;

  const pick = () => inputRef.current?.click();

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onAccept(f);
    e.target.value = "";   // allow re-picking the same file after a rejection
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onAccept(f);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        onClick={pick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") pick(); }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-all",
          over ? "scale-[1.01] shadow-md" : "hover:bg-surface-subtle/50",
        )}
        style={{
          borderColor: over ? ring : "var(--border)",
          background:  over ? `var(--color-doc-${docType}-bg)` : undefined,
        }}
      >
        <div
          className="flex size-12 items-center justify-center rounded-2xl"
          style={{ background: `var(--color-doc-${docType}-bg)`, color: ring }}
        >
          <UploadCloud className="size-6" aria-hidden />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold text-foreground">{t("uploadFile.dropHere")}</p>
          <p className="text-sm text-muted-foreground">
            {t("uploadFile.or")} <span className="font-semibold underline" style={{ color: ring }}>{t("uploadFile.browse")}</span>
          </p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("uploadFile.csvHint")}
        </p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {example}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={onChange}
          className="sr-only"
          tabIndex={-1}
        />
      </div>

      {errorMsg && (
        <div className="flex items-start gap-3 rounded-md border border-error-border bg-error-subtle px-3 py-2 text-sm text-error-subtle-foreground">
          <span className="flex-1">{errorMsg}</span>
          <button
            type="button"
            onClick={onClearError}
            aria-label={t("common.close")}
            className="cursor-pointer text-error-subtle-foreground/70 hover:text-error-subtle-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

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

function ImportState({
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

interface PreviewTableProps {
  headers:    string[];
  rows:       Record<string, string>[];      // up to 8
  totalRows:  number;
  filename:   string;
  fileDates:  { from: string; to: string } | null;
}

/**
 * Step-3 preview. Shows the parsed Sobrus CSV's header + first 8 rows so the
 * user can sanity-check before clicking Import. Date range from the filename
 * is shown in a Calendar pill above the table.
 */

function PreviewTable({ headers, rows, totalRows, filename, fileDates }: PreviewTableProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-foreground">
            Aperçu — {Math.min(rows.length, 8)} lignes affichées sur {formatQty(totalRows)}
          </h2>
          <span className="rounded-md bg-surface-subtle px-2 py-0.5 font-mono text-[11px] text-muted-foreground self-start">
            {filename}
          </span>
        </div>
        {fileDates && (
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground">
            <CalendarIcon />
            Période : {fmtFR(fileDates.from)} → {fmtFR(fileDates.to)}
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-surface-subtle text-muted-foreground">
            <tr>
              {headers.map((h) => (
                <th key={h} className="border-b border-border px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-background" : "bg-surface-subtle/40"}>
                {headers.map((h) => (
                  <td key={h} className="max-w-[160px] truncate whitespace-nowrap border-b border-border px-3 py-1.5 text-foreground">
                    {row[h] || <span className="text-muted-foreground">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalRows > 8 && (
        <p className="text-xs text-muted-foreground">
          … et {formatQty(totalRows - 8)} lignes supplémentaires seront importées.
        </p>
      )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

const FR = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
function fmtFR(iso: string): string {
  try { return FR.format(new Date(iso)); } catch { return iso; }
}

/**
 * 3-dot stepper. Each dot is numbered when pending/active, replaced with a
 * checkmark when complete. Connectors fill in primary as steps advance.
 */

const STEPS = [
  { n: 1, label: "uploadFile.step1" },
  { n: 2, label: "uploadFile.step2" },
  { n: 3, label: "uploadFile.step3" },
] as const;

function Stepper({ current }: { current: 1 | 2 | 3 }) {
  const t = useT();
  return (
    <ol className="flex w-full items-center justify-between gap-3">
      {STEPS.map((s, i) => {
        const done    = current > s.n;
        const active  = current === s.n;
        return (
          <li key={s.n} className="flex flex-1 items-center gap-3">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums",
                  done   && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary bg-primary/10 text-primary",
                  !done && !active && "border-border bg-card text-muted-foreground",
                )}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="size-4" aria-hidden /> : s.n}
              </span>
              <span
                className={cn(
                  "hidden text-sm font-medium sm:inline",
                  (done || active) ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {t(s.label)}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={cn(
                  "ml-2 h-[2px] flex-1 rounded-full transition-colors",
                  done ? "bg-primary" : "bg-border",
                )}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

interface TypeCardProps {
  type:        DocType;
  title:       string;
  description: string;
  icon:        ReactNode;
  columns:     string[];      // first 5 column-name chips
  totalCols:   number;        // for "+N autres"
  selected:    boolean;
  onSelect:    () => void;
}

/**
 * Step-1 card. One per doc-type. Tinted with the matching --color-doc-*-bg
 * when selected; bordered card otherwise. Hover lifts a couple of pixels.
 */

function TypeCard({
  type, title, description, icon, columns, totalCols, selected, onSelect,
}: TypeCardProps) {
  const ringColor = `var(--color-doc-${type})`;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group flex cursor-pointer flex-col gap-3 rounded-2xl border-2 p-5 text-left transition-all",
        selected
          ? "shadow-md"
          : "border-border bg-card hover:-translate-y-0.5 hover:shadow-md",
      )}
      style={selected ? { borderColor: ringColor, background: `var(--color-doc-${type}-bg)` } : undefined}
    >
      <div className="flex items-center justify-between">
        <div
          className="flex size-11 items-center justify-center rounded-xl"
          style={{ background: `var(--color-doc-${type}-bg)`, color: ringColor }}
        >
          {icon}
        </div>
        {selected && (
          <span
            className="flex size-5 items-center justify-center rounded-full text-white"
            style={{ background: ringColor }}
          >
            <CheckIcon />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {columns.slice(0, 5).map((c) => (
          <span key={c} className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {c}
          </span>
        ))}
        {totalCols > 5 && (
          <span className="rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            +{totalCols - 5} autres
          </span>
        )}
      </div>
    </button>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * Upload-file 3-step wizard. Type → Drag-drop → Preview + import.
 *
 * Query-param deep link: ?type=achat|vente|stock skips to step 2 with that
 * doc-type preselected. Used by the Stock CTA on /rapport (?type=stock).
 */

const buildTypeMeta = (t: TFn) => ({
  achat: {
    title:       t("uploadFile.achatTitle"),
    description: t("uploadFile.achatDesc"),
    icon:        ShoppingCart,
    columns:     ["PID", t("col.produit"), t("col.reference"), t("col.fournisseur"), t("uploadFile.quantite"), t("uploadFile.prixUnitaire"), t("col.total"), t("col.dateBL"), t("col.peremption")],
  },
  vente: {
    title:       t("uploadFile.venteTitle"),
    description: t("uploadFile.venteDesc"),
    icon:        ShoppingBasket,
    columns:     ["PID", t("col.produit"), t("col.date"), t("col.transaction"), t("col.client"), t("uploadFile.quantite"), t("col.remise"), t("uploadFile.prixUnitaire")],
  },
  stock: {
    title:       t("uploadFile.stockTitle"),
    description: t("uploadFile.stockDesc"),
    icon:        Boxes,
    columns:     ["PID", t("col.produit"), t("col.stock"), t("stock.stockMin"), t("stock.stockMax"), t("col.peremption"), t("uploadFile.zone"), t("col.categorie"), "PPV", "PPH", "TVA"],
  },
}) satisfies Record<DocType, { title: string; description: string; icon: typeof Boxes; columns: string[] }>;


/** Which per-type feature gates each DocType. The upload endpoint requires
 *  BOTH `import` AND the doc-type feature, so the picker must hide types
 *  the caller can't actually submit. */
const TYPE_FEATURE: Record<DocType, Feature> = {
  achat: "achats",
  vente: "ventes",
  stock: "stock",
};


export default function UploadFilePage() {
  const t = useT();
  const typeMeta = buildTypeMeta(t);
  const [searchParams, setSearchParams] = useSearchParams();
  const typeFromUrl = parseTypeParam(searchParams.get("type"));

  const {
    acceptFile,
    pickType,
    backToType,
    cancel,
    changeFile,
    clearFilenameError,
    docType,
    error,
    examples,
    file,
    fileDates,
    filename,
    filenameError,
    headers,
    phase,
    previewRows,
    progress,
    reset,
    startImport,
    step,
    stockResult,
    totalRows,
  } = useUpload(typeFromUrl);

  // Card-click handler: pick the type AND mirror it into ?type=... so the URL
  // stays a shareable deep-link to the active step. `replace: true` avoids
  // polluting the browser back-stack with every card toggle.
  const handlePickType = (dt: DocType) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("type", dt);
      return next;
    }, { replace: true });
    pickType(dt);
  };

  // Back-to-step-1 also clears ?type= so the URL doesn't lie about the
  // active step. Pairs with handlePickType to keep URL ↔ wizard in sync.
  const handleBackToType = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("type");
      return next;
    }, { replace: true });
    backToType();
  };

  const { me } = useMe();
  const allowedTypes = useMemo<DocType[]>(() => {
    const all: DocType[] = ["achat", "vente", "stock"];
    if (me?.role === ROLES.ADMIN) return all;          // admin bypass
    return all.filter((dt) => me?.permissions.includes(TYPE_FEATURE[dt]));
  }, [me]);

  // Re-sync when the ?type=... param changes (user navigates from another tab card).
  // `pickType` is useCallback'd with [] in useUpload, so its identity is stable —
  // the effect only re-fires on real URL changes. Idempotent: setting the same
  // docType twice is a no-op (React bails on identical state).
  useEffect(() => {
    if (typeFromUrl) pickType(typeFromUrl);
  }, [typeFromUrl, pickType]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FileSpreadsheet className="size-5" aria-hidden />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {t("uploadFile.pageTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("uploadFile.pageDesc")}
          </p>
        </div>
      </header>

      <Stepper current={step} />

      {/* ─── STEP 1 — Type ─── */}
      {step === 1 && (
        <section className="flex flex-col gap-4">
          {allowedTypes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {t("uploadFile.noTypeAvailable")}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {allowedTypes.map((dt) => {
                const meta = typeMeta[dt];
                const Icon = meta.icon;
                return (
                  <TypeCard
                    key={dt}
                    type={dt}
                    title={meta.title}
                    description={meta.description}
                    icon={<Icon className="size-5" />}
                    columns={meta.columns}
                    totalCols={meta.columns.length}
                    selected={docType === dt}
                    onSelect={() => handlePickType(dt)}
                  />
                );
              })}
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => docType && handlePickType(docType)}
              disabled={!docType}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("uploadFile.continue")}
              <ChevronRight className="size-4" />
            </button>
          </div>
        </section>
      )}

      {/* ─── STEP 2 — File ─── */}
      {step === 2 && docType && (
        <section className="flex flex-col gap-4">
          <button
            type="button"
            onClick={handleBackToType}
            className="inline-flex cursor-pointer items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {t("uploadFile.changeType")}
          </button>
          <DropZone
            docType={docType}
            example={examples[docType]}
            onAccept={(f) => acceptFile(f, docType!)}
            errorMsg={filenameError}
            onClearError={clearFilenameError}
          />
        </section>
      )}

      {/* ─── STEP 3 — Preview + import + state cards ─────────────────────
           Three mutually-exclusive states, and it must NEVER render empty:
            • file + idle   → preview table + "Importer" button
            • active job    → the matching state card (queued/running/…/success)
            • else (no file, no job) → the success card auto-dismissed (4s) and
              left us parked on step 3 → show a persistent "Import terminé"
              confirmation instead of a blank page.
      */}
      {step === 3 && docType && (
        <section className="flex flex-col gap-4">
          {(file || phase !== "idle") && (
            <button
              type="button"
              onClick={file ? changeFile : reset}
              className="inline-flex cursor-pointer items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              {file ? t("uploadFile.chooseAnother") : t("uploadFile.newImport")}
            </button>
          )}

          {file && phase === "idle" ? (
            <>
              <PreviewTable
                headers={headers}
                rows={previewRows}
                totalRows={totalRows}
                filename={file.name}
                fileDates={fileDates}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={startImport}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
                >
                  <UploadCloud className="size-4" />
                  {t("uploadFile.importToDb")}
                </button>
              </div>
            </>
          ) : phase !== "idle" ? (
            <ImportState
              docType={docType}
              phase={phase}
              progress={progress}
              error={error}
              filename={filename ?? file?.name ?? null}
              stockResult={stockResult}
              onCancel={cancel}
              onReset={reset}
            />
          ) : (
            <ImportDoneFallback docType={docType} onNewImport={reset} />
          )}
        </section>
      )}
    </div>
  );
}


function parseTypeParam(s: string | null): DocType | null {
  if (s === "achat" || s === "vente" || s === "stock") return s;
  return null;
}


/** Shown on step 3 once the detailed success card has auto-dismissed (4 s) but
 *  the wizard is still parked on step 3 with no file — previously a blank page.
 *  Reaching this state always means an import just succeeded (only "success"
 *  jobs auto-dismiss), so a completion confirmation is safe and accurate. */
function ImportDoneFallback({ docType, onNewImport }: { docType: DocType; onNewImport: () => void }) {
  const t = useT();
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-2xl border p-8 text-center"
      style={{ borderColor: `var(--color-doc-${docType}-border)`, background: `var(--color-doc-${docType}-bg)` }}
    >
      <div
        className="flex size-12 items-center justify-center rounded-full"
        style={{ background: `color-mix(in srgb, var(--color-doc-${docType}) 15%, transparent)`, color: `var(--color-doc-${docType})` }}
      >
        <CheckCircle2 className="size-6" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-foreground">{t("uploadFile.done")}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        {t("uploadFile.doneDesc")}
      </p>
      <button
        type="button"
        onClick={onNewImport}
        className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        <UploadCloud className="size-4" />
        {t("uploadFile.newImport")}
      </button>
    </div>
  );
}