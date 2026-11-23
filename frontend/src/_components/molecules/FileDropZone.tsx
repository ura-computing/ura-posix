/** A big dashed zone to drop a file on, or click to pick one: « Importer un fichier » (CSV, tinted with the file
 *  type's color), the store editor's logo (primary). `tint`: a CSS color var, `tintBg`: its light background.
 *
 *    <FileDropZone title="Déposez votre logo ici" hint="PNG, JPG… 2 Mo max" accept="image/png" onFiles={([f]) => …} /> */
import { UploadCloud } from "lucide-react";
import { useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";

import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";

export function FileDropZone({
  title,
  hint,
  example,
  accept,
  multiple = false,
  onFiles,
  tint = "var(--primary)",
  tintBg = "color-mix(in srgb, var(--primary) 10%, transparent)",
  preview,
}: {
  title: string;
  hint?: string;
  /** A file name example, small mono under the hint. */
  example?: string;
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  tint?: string;
  tintBg?: string;
  /** In place of the upload icon (e.g. the current logo). */
  preview?: ReactNode;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const pick = () => inputRef.current?.click();

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onFiles(files);
    e.target.value = ""; // the same file can be picked again after a refusal
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
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
        // relative: the sr-only input stays inside (else it escapes the scrolling <main> and the window scrolls too).
        "relative flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-all",
        over ? "scale-[1.01] shadow-md" : "hover:bg-surface-subtle/50",
      )}
      style={{ borderColor: over ? tint : "var(--border)", background: over ? tintBg : undefined }}
    >
      {preview ?? (
        <div
          className="flex size-12 items-center justify-center rounded-2xl"
          style={{ background: tintBg, color: tint }}
        >
          <UploadCloud className="size-6" aria-hidden />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">
          {t("uploadFile.or")}{" "}
          <span className="font-semibold underline" style={{ color: tint }}>
            {t("uploadFile.browse")}
          </span>
        </p>
      </div>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
      {example && <p className="font-mono text-[11px] text-muted-foreground">{example}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
        className="sr-only"
        tabIndex={-1}
      />
    </div>
  );
}
