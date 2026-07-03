/** CSV upload card for /analyse → Liste mode.
 *
 *  Pharmacist uploads a CSV → frontend parses (`;` or `,` separator, first line headers,
 *  detects "Produit" / "PID" / "Code barre" columns) → submits via useAnalyseListe.
 *  Backend matches against catalogue by name → barcode → PID and returns a split of
 *  found / not-found rows.
 */
import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";

import { KpiTile } from "@/components/shared/KpiTile";
import { cn } from "@/utils/cn";
import type { ListeItem } from "@/types";


export interface ListeUploadCardProps {
  onSubmit:  (items: ListeItem[]) => void;
  isLoading: boolean;
  submitted: boolean;
}


function detectColumn(headers: string[], aliases: string[]): number {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_-]/g, "");
  const normalizedHeaders = headers.map(norm);
  for (const a of aliases) {
    const idx = normalizedHeaders.indexOf(norm(a));
    if (idx >= 0) return idx;
  }
  return -1;
}


function parseCsv(text: string): ListeItem[] {
  // Detect delimiter from the first line (`;` wins over `,`).
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = lines[0].split(delim).map((s) => s.trim().replace(/^"|"$/g, ""));
  const nameIdx     = detectColumn(headers, ["produit", "product", "designation", "désignation"]);
  const pidIdx      = detectColumn(headers, ["pid", "id", "code"]);
  const barcode1Idx = detectColumn(headers, ["codebarre1", "barcode1", "ean", "codebarre"]);
  const barcode2Idx = detectColumn(headers, ["codebarre2", "barcode2"]);

  // If no "Produit" column detected, fall back to first column.
  const effectiveNameIdx = nameIdx >= 0 ? nameIdx : 0;

  const items: ListeItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delim).map((s) => s.trim().replace(/^"|"$/g, ""));
    const name  = cells[effectiveNameIdx] || "";
    if (!name) continue;
    items.push({
      name,
      pid:      pidIdx      >= 0 ? cells[pidIdx]      || undefined : undefined,
      barcode1: barcode1Idx >= 0 ? cells[barcode1Idx] || undefined : undefined,
      barcode2: barcode2Idx >= 0 ? cells[barcode2Idx] || undefined : undefined,
    });
  }
  return items;
}


export function ListeUploadCard({ onSubmit, isLoading, submitted }: ListeUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [parsedCount, setParsedCount] = useState<number>(0);

  function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const items = parseCsv(String(reader.result ?? ""));
        if (items.length === 0) {
          setError("Aucun produit détecté dans le fichier.");
          return;
        }
        setParsedCount(items.length);
        onSubmit(items);
      } catch (e) {
        setError("Impossible de lire le fichier CSV.");
        setParsedCount(0);
        // eslint-disable-next-line no-console
        console.error(e);
      }
    };
    reader.onerror = () => setError("Erreur de lecture du fichier.");
    reader.readAsText(file);
  }

  return (
    <KpiTile
      label="Liste de produits"
      icon={<Upload className="size-5" />}
      iconTone="primary"
    >
      <p className="text-sm text-muted-foreground">
        Importez un fichier <span className="font-semibold text-foreground">.csv</span> avec une
        colonne <span className="font-semibold text-foreground">Produit</span>. PID et codes-barres
        sont optionnels.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isLoading}
          className={cn(
            "inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover",
            isLoading && "cursor-wait opacity-60",
          )}
        >
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {isLoading ? "Analyse…" : (submitted ? "Importer une autre liste" : "Choisir un fichier")}
        </button>
        {fileName && (
          <span className="text-xs text-muted-foreground">
            {fileName} {parsedCount > 0 && <>· {parsedCount} produits</>}
          </span>
        )}
      </div>
      {error && <p className="text-xs font-semibold text-error">{error}</p>}
    </KpiTile>
  );
}
