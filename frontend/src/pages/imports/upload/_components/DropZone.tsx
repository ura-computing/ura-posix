import type { DocType } from "@/types";
import { useT } from "@/i18n/I18nProvider";
import { Callout } from "@/_components/molecules/Callout";
import { FileDropZone } from "@/_components/molecules/FileDropZone";

interface DropZoneProps {
  docType: DocType;
  example: string;
  /** Achats / Ventes: several files at once (stock: one). */
  multiple: boolean;
  onAccept: (files: File[]) => void;
  errorMsg: string | null;
  onClearError: () => void;
}

/** Step-2 drop zone (`FileDropZone`), tinted with the file type's --color-doc-*, + the refusal message. */
export function DropZone({ docType, example, multiple, onAccept, errorMsg, onClearError }: DropZoneProps) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <FileDropZone
        title={t(multiple ? "uploadFile.dropHereMany" : "uploadFile.dropHere")}
        hint={t("uploadFile.csvHint")}
        example={example}
        accept=".csv"
        multiple={multiple}
        onFiles={onAccept}
        tint={`var(--color-doc-${docType})`}
        tintBg={`var(--color-doc-${docType}-bg)`}
      />
      {errorMsg && (
        <Callout tone="error" onDismiss={onClearError}>
          {errorMsg}
        </Callout>
      )}
    </div>
  );
}
