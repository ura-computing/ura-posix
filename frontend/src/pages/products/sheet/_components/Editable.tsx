/** One editable value of the product sheet (owner's « Modifier »).
 *  - View: the value; when the owner changed it, « modifié », the imported value and (owner)
 *    « Revenir à la valeur importée ».
 *  - Edit mode: its input (text, price, whole number, date « JJ/MM/AAAA » typed or picked in the
 *    calendar next to it). */
import { useContext, useState, type ReactNode } from "react";
import { useFormState, useWatch } from "react-hook-form";
import { DayPicker } from "react-day-picker";
import { fr } from "date-fns/locale";
import { autoUpdate, flip, offset, shift, useDismiss, useFloating, useInteractions } from "@floating-ui/react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { DAY_PICKER_CLASSES, DAY_PICKER_MODIFIERS } from "@/_components/dayPicker";
import { useMonths } from "@/i18n/dates";
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import { formatDate, formatMADStr, formatNumStr } from "@/utils/format";

import { isoToTyped, typedToIso, type FormField } from "../hooks";
import { SheetEditContext } from "./editContext";

export type EditKind = "text" | "price" | "int" | "date";

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
  if (kind === "date") return formatDate(String(v));
  return String(v);
}

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The calendar next to a date field: a day picked = the field's date (« JJ/MM/AAAA »). Year
 *  buttons above it: an expiry is often 1–3 years away. */
// One header row « « ‹ Novembre 2026 › » »: year and month arrows around the month shown.
const CALENDAR_CLASSES = { ...DAY_PICKER_CLASSES, month_caption: "hidden" };

function CalendarButton({ field, label }: { field: FormField; label: string }) {
  const t = useT();
  const months = useMonths();
  const { editor } = useSheetEdit();
  const { control, setValue } = editor.form;
  const typed = useWatch({ control, name: field });
  const iso = typedToIso(typed ?? "");
  const selected = iso ? new Date(`${iso}T00:00:00`) : undefined;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(selected ?? new Date());
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [panelEl, setPanelEl] = useState<HTMLElement | null>(null);
  const { floatingStyles, context } = useFloating({
    elements: { reference: anchorEl, floating: panelEl },
    open,
    onOpenChange: setOpen,
    placement: "bottom-start",
    middleware: [offset(8), flip({ padding: 16 }), shift({ padding: 16 })],
    whileElementsMounted: autoUpdate,
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([useDismiss(context)]);
  const toggle = () => {
    if (!open) setMonth(selected ?? new Date());
    setOpen(!open);
  };
  const moveMonths = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const arrow =
    "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary";
  return (
    <>
      <button
        ref={setAnchorEl}
        type="button"
        aria-label={t("products.pickDate", { label })}
        {...getReferenceProps({ onClick: toggle })}
        className={cn(
          "inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-input bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary",
          open && "border-primary text-primary",
        )}
      >
        <CalendarIcon className="size-4" />
      </button>
      {open && (
        <div
          ref={setPanelEl}
          {...getFloatingProps()}
          style={floatingStyles}
          className="z-50 flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-base font-normal shadow-2xl"
        >
          <div className="flex items-center justify-between gap-1 text-sm font-bold text-foreground">
            <span className="flex gap-1">
              <button
                type="button"
                onClick={() => moveMonths(-12)}
                aria-label={t("products.prevYear")}
                className={arrow}
              >
                <ChevronsLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => moveMonths(-1)}
                aria-label={t("products.prevMonth")}
                className={arrow}
              >
                <ChevronLeft className="size-4" />
              </button>
            </span>
            <span>
              {months[month.getMonth()]} {month.getFullYear()}
            </span>
            <span className="flex gap-1">
              <button
                type="button"
                onClick={() => moveMonths(1)}
                aria-label={t("products.nextMonth")}
                className={arrow}
              >
                <ChevronRight className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => moveMonths(12)}
                aria-label={t("products.nextYear")}
                className={arrow}
              >
                <ChevronsRight className="size-4" />
              </button>
            </span>
          </div>
          <div>
            <DayPicker
              mode="single"
              locale={fr}
              month={month}
              onMonthChange={setMonth}
              hideNavigation
              selected={selected}
              onSelect={(d) => {
                if (!d) return;
                setValue(field, isoToTyped(isoOf(d)), { shouldDirty: true });
                setOpen(false);
              }}
              weekStartsOn={1}
              showOutsideDays
              classNames={CALENDAR_CLASSES}
              modifiersClassNames={DAY_PICKER_MODIFIERS}
            />
          </div>
        </div>
      )}
    </>
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
        <input
          aria-label={label}
          aria-invalid={error ? true : undefined}
          inputMode={kind === "price" ? "decimal" : kind === "int" ? "numeric" : undefined}
          placeholder={kind === "date" ? t("products.datePlaceholder") : undefined}
          className={cn(
            INPUT,
            "h-9",
            kind === "text" ? "text-left" : kind === "date" ? "text-left font-mono" : "text-right font-mono",
            error ? "border-error" : "border-input",
          )}
          {...register(field)}
        />
        {kind === "date" && <CalendarButton field={field} label={label} />}
      </span>
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
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-xs font-normal tracking-normal">
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
