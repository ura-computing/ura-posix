import { UploadCloud, X } from "lucide-react";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { cn } from "@/utils/cn";
import type { DocType } from "@/types";


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

export function DropZone({ docType, example, onAccept, errorMsg, onClearError }: DropZoneProps) {
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
          <p className="text-base font-semibold text-foreground">Glissez votre fichier ici</p>
          <p className="text-sm text-muted-foreground">
            ou <span className="font-semibold underline" style={{ color: ring }}>cliquez pour parcourir</span>
          </p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          CSV exporté depuis Sobrus, délimiteur « ; »
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
            aria-label="Fermer"
            className="cursor-pointer text-error-subtle-foreground/70 hover:text-error-subtle-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}