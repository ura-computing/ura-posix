import { useCallback, useRef, useState } from "react";
import {
  ShoppingCart, ShoppingBasket, UploadCloud, FileSpreadsheet,
  CheckCircle2, X, ChevronRight, AlertCircle, RotateCcw, Calendar,
  Loader2, Ban,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useUploadCsvBatched } from "@/hooks/useUpload";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type DocType = "achat" | "vente";

const DOC_CONFIG = {
  achat: {
    label: "Achats",
    description: "Bons de livraison fournisseurs",
    icon: ShoppingCart,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    border: "border-violet-500/40",
    activeBorder: "border-violet-500",
    badge: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    columns: ["Date BL", "Référence", "Fournisseur", "Produit", "Qté", "PPH", "PPV", "Total"],
    csvCols:  ["Date Bon de Livraison", "Référence de livraison", "Fournisseur", "Produit", "Quantité", "PPH", "PPV", "Total"],
  },
  vente: {
    label: "Ventes",
    description: "Transactions de vente clients",
    icon: ShoppingBasket,
    color: "text-[#14b8a6]",
    bg: "bg-[#14b8a6]/10",
    border: "border-[#14b8a6]/40",
    activeBorder: "border-[#14b8a6]",
    badge: "bg-[#14b8a6]/15 text-[#0d9488]",
    columns: ["Date", "N° Transaction", "Client", "Produit", "Qté", "Remise", "PPV", "Total"],
    csvCols:  ["Date", "Numéro de transaction", "Client", "Produit", "Quantité", "Remise", "PPV", "Total"],
  },
} as const;

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDot({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold border-2 transition-colors",
        done  ? "bg-[#14b8a6] border-[#14b8a6] text-white" :
        active ? "border-[#14b8a6] text-[#14b8a6] bg-transparent" :
                 "border-border text-muted-foreground bg-transparent"
      )}>
        {done ? <CheckCircle2 className="h-4 w-4" /> : n}
      </div>
      <span className={cn("text-sm font-medium hidden sm:block", active || done ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
    </div>
  );
}

function StepConnector({ done }: { done: boolean }) {
  return (
    <div className={cn("h-px flex-1 mx-2 transition-colors", done ? "bg-[#14b8a6]" : "bg-border")} />
  );
}

// ─── Step 1: choose type ──────────────────────────────────────────────────────

function TypeCard({ type, selected, onClick }: { type: DocType; selected: boolean; onClick: () => void }) {
  const cfg = DOC_CONFIG[type];
  const Icon = cfg.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-start gap-4 rounded-2xl border-2 p-6 text-left transition-all duration-200 w-full cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? `${cfg.activeBorder} shadow-md bg-card`
          : "border-border bg-card hover:border-muted-foreground/30"
      )}
    >
      <div className="absolute top-3 right-3">
        {selected ? (
          <CheckCircle2 className="h-5 w-5 text-[#14b8a6]" />
        ) : (
          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
        )}
      </div>

      <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", cfg.bg)}>
        <Icon className={cn("h-6 w-6", cfg.color)} />
      </div>
      <div>
        <p className="text-lg font-semibold text-foreground">{cfg.label}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{cfg.description}</p>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {cfg.columns.slice(0, 5).map((col) => (
          <span key={col} className={cn("rounded-md px-2 py-0.5 text-xs font-medium", cfg.badge)}>
            {col}
          </span>
        ))}
        <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", cfg.badge)}>
          +{cfg.columns.length - 5} autres
        </span>
      </div>
    </button>
  );
}

// ─── Filename validation ───────────────────────────────────────────────────────

const SOBRUS_FILENAME_PATTERN: Record<DocType, RegExp> = {
  achat:  /^Sobrus - Achats \d{4}-\d{2}-\d{2} - \d{4}-\d{2}-\d{2}( \(\d+\))?\.csv$/i,
  vente:  /^Sobrus - Ventes \d{4}-\d{2}-\d{2} - \d{4}-\d{2}-\d{2}( \(\d+\))?\.csv$/i,
};

const SOBRUS_FILENAME_EXAMPLE: Record<DocType, string> = {
  achat:  "Sobrus - Achats YYYY-MM-DD - YYYY-MM-DD.csv",
  vente:  "Sobrus - Ventes YYYY-MM-DD - YYYY-MM-DD.csv",
};

// ─── Step 2: file drop zone ───────────────────────────────────────────────────

function DropZone({ docType, onFile }: { docType: DocType; onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Seuls les fichiers CSV sont acceptés");
      return;
    }
    if (!SOBRUS_FILENAME_PATTERN[docType].test(file.name)) {
      toast.error(
        `Nom de fichier invalide. Format attendu : ${SOBRUS_FILENAME_EXAMPLE[docType]}`,
        { duration: 6000 }
      );
      return;
    }
    onFile(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) accept(file);
  }, [accept]);

  const cfg = DOC_CONFIG[docType];
  const Icon = cfg.icon;

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed px-6 py-14 cursor-pointer transition-all duration-200 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        dragging
          ? `${cfg.activeBorder} ${cfg.bg}`
          : "border-border bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/40"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) accept(f); }}
      />
      <div className={cn("flex h-16 w-16 items-center justify-center rounded-2xl", cfg.bg)}>
        <UploadCloud className={cn("h-8 w-8", cfg.color)} />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-foreground">Glissez votre fichier ici</p>
        <p className="text-sm text-muted-foreground mt-1">
          ou <span className={cn("font-semibold underline", cfg.color)}>cliquez pour parcourir</span>
        </p>
        <p className="text-xs text-muted-foreground mt-3">
          Fichier CSV exporté depuis Sobrus · Délimiteur&nbsp;
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">;</code>
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1 font-mono">
          {SOBRUS_FILENAME_EXAMPLE[docType]}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", cfg.color)} />
        <span className={cn("text-sm font-medium", cfg.color)}>
          Format : Sobrus — {cfg.label}
        </span>
      </div>
    </div>
  );
}

// ─── Step 3: preview table ────────────────────────────────────────────────────

function parseCSVPreview(text: string, cols: readonly string[]): string[][] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(";").map((h) => h.replace(/^"|"$/g, "").trim());
  const indices = cols.map((c) => header.indexOf(c));
  return lines.slice(1, 9).map((line) => {
    const cells = line.split(";").map((c) => c.replace(/^"|"$/g, "").trim());
    return indices.map((i) => (i >= 0 ? cells[i] ?? "" : "—"));
  });
}

function PreviewTable({ file, docType }: { file: File; docType: DocType }) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [totalRows, setTotalRows] = useState(0);
  const cfg = DOC_CONFIG[docType];

  useState(() => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter(Boolean);
      setTotalRows(Math.max(0, lines.length - 1));
      setRows(parseCSVPreview(text, cfg.csvCols));
    };
    reader.readAsText(file, "UTF-8");
  });

  if (!rows) return <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">Chargement…</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          Aperçu — <span className="text-muted-foreground">{rows.length} lignes sur {totalRows}</span>
        </p>
        <Badge variant="secondary" className="font-mono text-xs">{file.name}</Badge>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/60 border-b border-border">
              {cfg.columns.map((col) => (
                <th key={col} className="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-foreground/80">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={cn("border-b border-border last:border-0", i % 2 === 0 ? "bg-background" : "bg-muted/20")}>
                {row.map((cell, j) => (
                  <td key={j} className="max-w-[160px] truncate px-3 py-2 text-foreground/70">
                    {cell || <span className="text-muted-foreground/50">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalRows > 8 && (
        <p className="text-center text-xs text-muted-foreground">
          … et {totalRows - 8} lignes supplémentaires seront importées
        </p>
      )}
    </div>
  );
}

// ─── Date parsing from filename ───────────────────────────────────────────────

function parseDatesFromFilename(name: string): { start: string; end: string } | null {
  const match = name.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  return { start: match[1], end: match[2] };
}

// ─── Date range indicator ─────────────────────────────────────────────────────

function DateRangeIndicator({
  start, end, onStartChange, onEndChange,
}: {
  start: string; end: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-sm text-muted-foreground shrink-0">Période :</span>
      <input
        type="date"
        value={start}
        onChange={(e) => onStartChange(e.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <span className="text-muted-foreground text-sm">→</span>
      <input
        type="date"
        value={end}
        onChange={(e) => onEndChange(e.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function UploadProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">Importation en cours…</span>
        <span className="text-muted-foreground tabular-nums">Lot {current} / {total}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-[#14b8a6] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-center">{pct}% complété</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardUploadFile() {
  const [docType, setDocType] = useState<DocType | null>(null);
  const [file, setFile]       = useState<File | null>(null);
  const [step, setStep]       = useState<1 | 2 | 3>(1);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd]     = useState("");

  const { state, upload, cancel, reset: resetUpload } = useUploadCsvBatched();

  const isUploading = state.status === "uploading";
  const isSuccess   = state.status === "success";
  const isError     = state.status === "error";
  const isCancelled = state.status === "cancelled";

  const reset = () => {
    setDocType(null);
    setFile(null);
    setStep(1);
    setDateStart("");
    setDateEnd("");
    resetUpload();
  };

  const handleFileChosen = (f: File) => {
    setFile(f);
    const parsed = parseDatesFromFilename(f.name);
    setDateStart(parsed?.start ?? "");
    setDateEnd(parsed?.end ?? "");
    setStep(3);
    resetUpload();
  };

  const handleImport = () => {
    if (!docType || !file) return;
    upload(file, docType);
  };

  const cfg = docType ? DOC_CONFIG[docType] : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-[#14b8a6]" />
          <h1 className="text-2xl font-bold text-foreground">Importer un fichier</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Importez vos exports Sobrus (Achats ou Ventes) au format CSV.
        </p>
      </div>

      {/* Steps */}
      <div className="flex items-center">
        <StepDot n={1} label="Type de document" active={step === 1} done={step > 1} />
        <StepConnector done={step > 1} />
        <StepDot n={2} label="Fichier CSV" active={step === 2} done={step > 2} />
        <StepConnector done={step > 2} />
        <StepDot n={3} label="Aperçu & Import" active={step === 3} done={isSuccess} />
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-foreground">Quel type de document souhaitez-vous importer ?</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <TypeCard type="achat" selected={docType === "achat"} onClick={() => setDocType("achat")} />
            <TypeCard type="vente" selected={docType === "vente"} onClick={() => setDocType("vente")} />
          </div>
          <div className="flex justify-end pt-2">
            <Button
              onClick={() => setStep(2)}
              disabled={!docType}
              className="bg-[#14b8a6] hover:bg-[#0d9488] text-white border-0 gap-2"
            >
              Continuer <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && cfg && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setStep(1)} className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              ← Changer de type
            </button>
            <span className={cn("rounded-full px-3 py-0.5 text-xs font-semibold", cfg.badge)}>
              {cfg.label}
            </span>
          </div>
          <DropZone docType={docType!} onFile={handleFileChosen} />
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && file && cfg && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setFile(null); setStep(2); resetUpload(); }}
                disabled={isUploading}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                ← Choisir un autre fichier
              </button>
              <span className={cn("rounded-full px-3 py-0.5 text-xs font-semibold", cfg.badge)}>
                {cfg.label}
              </span>
            </div>
          </div>

          {/* Upload progress */}
          {isUploading && state.status === "uploading" && (
            <div className="rounded-2xl border border-[#14b8a6]/30 bg-[#14b8a6]/5 px-6 py-6 space-y-4">
              <UploadProgressBar current={state.progress.current} total={state.progress.total} />
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-destructive border-destructive/40 hover:bg-destructive/10"
                  onClick={cancel}
                >
                  <Ban className="h-3.5 w-3.5" />
                  Annuler l'import
                </Button>
              </div>
            </div>
          )}

          {/* Success state */}
          {isSuccess && state.status === "success" && (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#14b8a6]/30 bg-[#14b8a6]/5 px-6 py-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#14b8a6]/15">
                <CheckCircle2 className="h-8 w-8 text-[#14b8a6]" />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{state.inserted} lignes importées</p>
                {state.skipped > 0 && (
                  <p className="text-sm text-muted-foreground mt-0.5">{state.skipped} doublons ignorés</p>
                )}
                <p className="text-sm text-muted-foreground mt-1">
                  Le fichier <span className="font-medium">{file.name}</span> a été importé avec succès.
                </p>
              </div>
              <Button onClick={reset} variant="outline" className="gap-2 mt-2">
                <RotateCcw className="h-4 w-4" /> Nouvel import
              </Button>
            </div>
          )}

          {/* Cancelled state */}
          {isCancelled && state.status === "cancelled" && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/30 px-4 py-4">
              <Ban className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Import annulé</p>
                <p className="text-xs text-amber-600/80 dark:text-amber-500 mt-0.5">
                  {state.inserted > 0
                    ? `${state.inserted} lignes ont déjà été importées avant l'annulation.`
                    : "Aucune ligne n'a été importée."}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={reset} className="gap-1.5 shrink-0">
                <RotateCcw className="h-3.5 w-3.5" /> Recommencer
              </Button>
            </div>
          )}

          {/* Error state */}
          {isError && state.status === "error" && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-destructive">Erreur d'importation</p>
                <p className="text-xs text-destructive/80 mt-0.5">{state.message}</p>
              </div>
              <button type="button" onClick={resetUpload} className="cursor-pointer text-destructive hover:text-destructive/70">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Preview + import button */}
          {!isUploading && !isSuccess && (
            <>
              <DateRangeIndicator
                start={dateStart}
                end={dateEnd}
                onStartChange={setDateStart}
                onEndChange={setDateEnd}
              />
              <PreviewTable file={file} docType={docType!} />
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Vérifiez les données avant d'importer
                </p>
                <Button
                  onClick={handleImport}
                  className="bg-[#14b8a6] hover:bg-[#0d9488] text-white border-0 gap-2"
                >
                  <UploadCloud className="h-4 w-4" />
                  Importer dans la base
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
