import { UploadCloud } from "lucide-react";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import type { DocType } from "@/types";
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import { Callout } from "@/_components/molecules/Callout";

interface DropZoneProps {
  docType: DocType;
  example: string;
  /** Achats / Ventes: several files at once (stock: one). */
  multiple: boolean;
  onAccept: (files: File[]) => void;
  errorMsg: string | null;
  onClearError: () => void;
}

/**
 * Step-2 drag-drop zone. Tinted with the matching --color-doc-* on drag-over.
 * Click to open the native file picker. Native file input is hidden inside
 * the zone so the entire surface is clickable.
 */

export function DropZone({ docType, example, multiple, onAccept, errorMsg, onClearError }: DropZoneProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const ring = `var(--color-doc-${docType})`;

  const pick = () => inputRef.current?.click();

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onAccept(files);
    e.target.value = ""; // allow re-picking the same file after a rejection
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) onAccept(multiple ? files : files.slice(0, 1));
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        onClick={pick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") pick();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-all",
          over ? "scale-[1.01] shadow-md" : "hover:bg-surface-subtle/50",
        )}
        style={{
          borderColor: over ? ring : "var(--border)",
          background: over ? `var(--color-doc-${docType}-bg)` : undefined,
        }}
      >
        <div
          className="flex size-12 items-center justify-center rounded-2xl"
          style={{ background: `var(--color-doc-${docType}-bg)`, color: ring }}
        >
          <UploadCloud className="size-6" aria-hidden />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-base font-semibold text-foreground">
            {t(multiple ? "uploadFile.dropHereMany" : "uploadFile.dropHere")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("uploadFile.or")}{" "}
            <span className="font-semibold underline" style={{ color: ring }}>
              {t("uploadFile.browse")}
            </span>
          </p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("uploadFile.csvHint")}</p>
        <p className="font-mono text-[11px] text-muted-foreground">{example}</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          multiple={multiple}
          onChange={onChange}
          className="sr-only"
          tabIndex={-1}
        />
      </div>

      {errorMsg && (
        <Callout tone="error" onDismiss={onClearError}>
          {errorMsg}
        </Callout>
      )}
    </div>
  );
}
