/** One editable value of the product sheet (owner's « Modifier »).
 *  - View: the value; when the owner changed it, « modifié », the imported value and (owner)
 *    « Revenir à la valeur importée ».
 *  - Edit mode: its input (text, price, whole number). */
import { useContext, type ReactNode } from "react";
import { useFormState } from "react-hook-form";

import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import { formatMADStr, formatNumStr } from "@/utils/format";

import type { FormField } from "../hooks";
import { SheetEditContext } from "./editContext";

export type EditKind = "text" | "price" | "int";

const INPUT =
  "w-full rounded-md border bg-surface-subtle px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";

function useSheetEdit() {
  const ctx = useContext(SheetEditContext);
  if (!ctx) throw new Error("Editable must be used inside <SheetEditContext>");
  return ctx;
}

/** The imported value, as text (shown under an edited value). */
function importedText(kind: EditKind, v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  if (kind === "price") return formatMADStr(Number(v));
  if (kind === "int") return formatNumStr(Number(v));
  return String(v);
}

function EditInput({ field, kind, label }: { field: FormField; kind: EditKind; label: string }) {
  const { editor } = useSheetEdit();
  const { register, control } = editor.form;
  const { errors } = useFormState({ control, name: field });
  const error = errors[field]?.message;
  return (
    <span className="flex w-full flex-col items-start gap-1">
      <input
        aria-label={label}
        aria-invalid={error ? true : undefined}
        inputMode={kind === "price" ? "decimal" : kind === "int" ? "numeric" : undefined}
        className={cn(
          INPUT,
          "h-9 max-w-[260px]",
          kind === "text" ? "text-left" : "text-right font-mono",
          error ? "border-error" : "border-input",
        )}
        {...register(field)}
      />
      {error && <span className="text-xs font-normal text-error">{error}</span>}
    </span>
  );
}

export function Editable({
  field,
  kind = "text",
  label,
  children,
}: {
  field: FormField;
  kind?: EditKind;
  /** Names the input in edit mode (screen readers, tests). */
  label: string;
  /** The value as shown in view mode. */
  children: ReactNode;
}) {
  const t = useT();
  const { editor, sheet } = useSheetEdit();
  if (editor.editing) return <EditInput field={field} kind={kind} label={label} />;

  const edited = field in sheet.imported;
  return (
    <span className="flex flex-col items-start gap-1">
      <span>{children}</span>
      {edited && (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-normal">
          <span className="rounded bg-warning-subtle px-1.5 py-px font-semibold text-warning-subtle-foreground">
            {t("products.edited")}
          </span>
          <span className="text-muted-foreground">
            {t("products.importedValue", { value: importedText(kind, sheet.imported[field]) })}
          </span>
          {editor.canEdit && (
            <button
              type="button"
              onClick={() => void editor.revert(field)}
              disabled={editor.isSaving}
              className="cursor-pointer font-semibold text-primary hover:text-primary-hover hover:underline disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("products.revert")}
            </button>
          )}
        </span>
      )}
    </span>
  );
}
