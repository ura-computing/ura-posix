/** One editable value of the product sheet (owner's « Modifier » on its block).
 *  - View: the value; when the owner changed it, « modifié », the imported value and (owner)
 *    « Revenir à la valeur importée ».
 *  - Its block edited: its input (text, price, whole number, date « JJ/MM/AAAA » typed or picked in
 *    the calendar next to it).
 *  `SectionEditActions` = the block's « Modifier », then « Annuler » + « Enregistrer », right there. */
import { useContext, type ReactNode } from "react";
import { useFormState, useWatch } from "react-hook-form";
import { Pencil, Save, X } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { Input } from "@/_components/atoms/Input";
import { DatePickerButton } from "@/_components/molecules/DatePickerButton";
import { useT } from "@/i18n/I18nProvider";
import { formatDate, formatMADStr, formatNumStr } from "@/utils/format";

import { isoToTyped, typedToIso, type EditSection, type FormField } from "../hooks";
import { SheetEditContext } from "./editContext";

export type EditKind = "text" | "price" | "int" | "date";

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
  if (kind === "date") return formatDate(String(v));
  return String(v);
}

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The calendar next to a date field: a day picked = the field's date (« JJ/MM/AAAA »). */
function CalendarButton({ field, label }: { field: FormField; label: string }) {
  const t = useT();
  const { editor } = useSheetEdit();
  const { control, setValue } = editor.form;
  const typed = useWatch({ control, name: field });
  const iso = typedToIso(typed ?? "");
  return (
    <DatePickerButton
      selected={iso ? new Date(`${iso}T00:00:00`) : undefined}
      onPick={(d) => setValue(field, isoToTyped(isoOf(d)), { shouldDirty: true })}
      label={t("products.pickDate", { label })}
    />
  );
}

function EditInput({ field, kind, label }: { field: FormField; kind: EditKind; label: string }) {
  const t = useT();
  const { editor } = useSheetEdit();
  const { register, control } = editor.form;
  const { errors } = useFormState({ control, name: field });
  const error = errors[field]?.message;
  return (
    <span className="flex w-full flex-col items-start gap-1">
      <span className="flex w-full max-w-[260px] items-center gap-2">
        <Input
          aria-label={label}
          invalid={!!error}
          inputMode={kind === "price" ? "decimal" : kind === "int" ? "numeric" : undefined}
          placeholder={kind === "date" ? t("products.datePlaceholder") : undefined}
          className={kind === "text" ? "text-left" : kind === "date" ? "text-left font-mono" : "text-right font-mono"}
          {...register(field)}
        />
        {kind === "date" && <CalendarButton field={field} label={label} />}
      </span>
      {error && <span className="text-xs font-normal text-error">{error}</span>}
    </span>
  );
}

/** Owner: « Modifier » (one block at a time), then « Annuler » + « Enregistrer ». Employee:
 *  « Modifier » shown, disabled, with the reason under it. */
export function SectionEditActions({ section }: { section: EditSection }) {
  const t = useT();
  const { editor } = useSheetEdit();
  if (editor.section === section) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={editor.cancel} disabled={editor.isSaving}>
          <X className="size-4" />
          {t("common.cancel")}
        </Button>
        <Button
          variant="primary"
          onClick={() => void editor.save()}
          isLoading={editor.isSaving}
          loadingText={t("products.saving")}
        >
          <Save className="size-4" />
          {t("common.save")}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        onClick={() => editor.start(section)}
        disabled={!editor.canEdit || editor.section !== null}
      >
        <Pencil className="size-4" />
        {t("common.edit")}
      </Button>
      {!editor.canEdit && <span className="text-xs text-muted-foreground">{t("products.ownerOnly")}</span>}
    </div>
  );
}

/** While its block is edited: what the owner's values change. */
export function EditHint({ section }: { section: EditSection }) {
  const t = useT();
  const { editor } = useSheetEdit();
  if (editor.section !== section) return null;
  return (
    <p className="rounded-lg border border-border bg-surface-subtle px-4 py-3 text-sm text-foreground">
      {t("products.editHint")}
    </p>
  );
}

export function Editable({
  field,
  kind = "text",
  label,
  section,
  children,
}: {
  field: FormField;
  kind?: EditKind;
  /** Names the input in edit mode (screen readers, tests). */
  label: string;
  /** Its block: an input while that block is edited. */
  section: EditSection;
  /** The value as shown in view mode. */
  children: ReactNode;
}) {
  const t = useT();
  const { editor, sheet } = useSheetEdit();
  if (editor.section === section) return <EditInput field={field} kind={kind} label={label} />;

  const edited = field in sheet.imported;
  return (
    <span className="flex flex-col items-start gap-1">
      <span>{children}</span>
      {edited && (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-xs font-normal tracking-normal">
          <span className="rounded bg-warning-subtle px-1.5 py-px font-semibold text-warning-subtle-foreground">
            {t("products.edited")}
          </span>
          <span className="text-muted-foreground">
            {t("products.importedValue", { value: importedText(kind, sheet.imported[field]) })}
          </span>
          {editor.canEdit && (
            <Button
              variant="link"
              className="font-semibold"
              onClick={() => void editor.revert(field)}
              disabled={editor.isSaving}
            >
              {t("products.revert")}
            </Button>
          )}
        </span>
      )}
    </span>
  );
}
