/** /admin/categories — Catégories → suffixes mapping (admin only).
 *
 *  Header + DataTable + create/edit dialog + confirm-delete dialog. Uses the
 *  shared DataTable primitive so empty/loading/sort states stay consistent
 *  with the rest of the app. */
import { useState, useEffect } from "react";
import { Loader2, Pencil, Plus, RefreshCw, Trash2, Check, Minus } from "lucide-react";

import { AsyncButton } from "@/_components/AsyncButton";
import { ConfirmDialog } from "@/_components/ConfirmDialog";
import { DataTable } from "@/_components/DataTable";
import { SuffixBadge } from "@/_components/SuffixBadge";
import { useT } from "@/i18n/I18nProvider";
import type { ColumnDef } from "@/_components/DataTable";
import type { CategorySuffixOut, CategorySuffixIn, SuffixColor } from "@/types";

import {
  useCategorySuffixes,
  useCreateCategorySuffix,
  useDeleteCategorySuffix,
  useUpdateCategorySuffix,
} from "./hooks";
import { Dialog, DialogContent } from "@/_components/dialog";
import { SUFFIX_COLORS } from "@/types";

/** Create / edit dialog for a CategorySuffix. Mirrors the handoff design via
 *  our shared primitives (Dialog, AsyncButton, SuffixBadge). The category is
 *  saved as typed (spaces tidied); the backend matches it ignoring accents,
 *  case and the « (x%) » part (`csv_parse.suffix_key`). */

/** Hex for the swatch fill — solids matching the SuffixBadge palette tone. */
const SWATCH_SOLID: Record<SuffixColor, string> = {
  teal:    "#0E9E8C",
  blue:    "#1D6FB8",
  purple:  "#7C3AED",
  amber:   "#B7791F",
  rose:    "#D6447B",
  emerald: "#1E9E63",
  orange:  "#E07F1F",
  pink:    "#E84A7B",
};

interface CategorySuffixDialogProps {
  open:     boolean;
  onClose:  () => void;
  /** Pass an item to edit; omit to create. */
  item?:    CategorySuffixOut | null;
  isSaving?: boolean;
  onSubmit: (values: CategorySuffixIn) => Promise<unknown>;
}

function CategorySuffixDialog({ open, onClose, item, isSaving, onSubmit }: CategorySuffixDialogProps) {
  const t = useT();
  const [values, setValues] = useState<CategorySuffixIn>({
    category: item?.category ?? "",
    suffix:   item?.suffix ?? "",
    color:    item?.color ?? "teal",
  });

  // Reset fields when the dialog opens for a different item.
  useEffect(() => {
    if (open) {
      setValues({
        category: item?.category ?? "",
        suffix:   item?.suffix ?? "",
        color:    item?.color ?? "teal",
      });
    }
  }, [open, item]);

  const set = <K extends keyof CategorySuffixIn>(k: K, v: CategorySuffixIn[K]) =>
    setValues((p) => ({ ...p, [k]: v }));

  const previewSuffix = values.suffix || "-?";
  const previewCategory = values.category ? normalizeCategory(values.category) : t("categories.previewCategoryFallback");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ ...values, category: normalizeCategory(values.category) });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-[17px] font-semibold text-foreground">
            {item ? t("categories.editMapping") : t("categories.newMapping")}
          </h3>
        </div>

        {/* Live preview */}
        <div className="flex items-center gap-3 border-b border-border bg-surface-subtle px-5 py-3.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("categories.preview")}</span>
          <SuffixBadge text={previewSuffix} color={values.color ?? "teal"} />
          <span className="ml-auto font-mono text-xs text-muted-foreground">{previewCategory}</span>
        </div>

        <form className="flex flex-col gap-4 p-5" onSubmit={handleSubmit}>
          <Field label={t("col.categorie")} required>
            <Input
              value={values.category}
              onChange={(v) => set("category", v)}
              placeholder={t("categories.categoryPlaceholderEx")}
              required
              autoFocus
            />
          </Field>

          <Field label={t("categories.suffix")} required hint={t("categories.suffixHint")}>
            <Input
              value={values.suffix}
              onChange={(v) => set("suffix", v)}
              placeholder="-1"
              maxLength={6}
              required
              className="max-w-[140px] font-mono"
            />
          </Field>

          <Field label={t("categories.color")}>
            <div className="flex flex-wrap items-center gap-2">
              {SUFFIX_COLORS.map((c) => {
                const selected = values.color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => set("color", c)}
                    className="flex size-7 cursor-pointer items-center justify-center rounded-md border-2 transition-transform hover:scale-110"
                    style={{
                      background: SWATCH_SOLID[c],
                      borderColor: selected ? "var(--foreground)" : "transparent",
                    }}
                  >
                    {selected && <Check className="size-3.5 text-white" />}
                  </button>
                );
              })}
              <button
                type="button"
                aria-label={t("categories.colorNone")}
                onClick={() => set("color", null)}
                className="flex size-7 cursor-pointer items-center justify-center rounded-md border-2 bg-surface-subtle transition-transform hover:scale-110"
                style={{ borderColor: values.color === null ? "var(--foreground)" : "transparent" }}
              >
                <Minus className="size-3.5 text-muted-foreground" />
              </button>
            </div>
          </Field>

          <div className="-mx-5 -mb-5 mt-1 flex items-center justify-end gap-2.5 border-t border-border bg-surface-subtle px-5 py-3.5">
            <AsyncButton type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
              {t("common.cancel")}
            </AsyncButton>
            <AsyncButton type="submit" variant="primary" isLoading={isSaving} loadingText={t("categories.saving")}>
              {t("common.save")}
            </AsyncButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tiny inline form primitives (same pattern as CreateUserDialog) ───────────

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-error">*</span>}
      </span>
      {children}
      {hint && <span className="text-[11.5px] leading-snug text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Input({
  value, onChange, className, ...rest
}: { value: string; onChange: (v: string) => void; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  return (
    <input
      {...rest}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-9 w-full rounded-md border border-input bg-surface-subtle px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 ${className ?? ""}`}
    />
  );
}

function normalizeCategory(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}


export default function AdminCategoriesPage() {
  const t = useT();
  const {
    suffixes,
    isLoading,
    isError,
    reload,
  } = useCategorySuffixes();
  const {
    createSuffix,
    isCreating,
  } = useCreateCategorySuffix();
  const {
    updateSuffix,
    isUpdating,
  } = useUpdateCategorySuffix();
  const {
    deleteSuffix,
    isDeleting,
  } = useDeleteCategorySuffix();

  const [editing,        setEditing]        = useState<CategorySuffixOut | null>(null);
  const [createOpen,     setCreateOpen]     = useState(false);
  const [removeTarget,   setRemoveTarget]   = useState<CategorySuffixOut | null>(null);

  const items = suffixes;

  const columns: ColumnDef<CategorySuffixOut>[] = [
    {
      key: "category",
      label: t("col.categorie"),
      sortable: false,
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{row.category}</span>
          <span className="font-mono text-[11px] text-muted-foreground">{normalizeCategory(row.category)}</span>
        </div>
      ),
    },
    {
      key: "suffix",
      label: t("categories.suffix"),
      sortable: false,
      render: (row) => <SuffixBadge text={row.suffix} color={row.color} />,
    },
    {
      key: "actions",
      label: t("categories.actions"),
      align: "right",
      sortable: false,
      width: 110,
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setEditing(row)}
            aria-label={t("common.edit")}
            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-surface-subtle hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setRemoveTarget(row)}
            aria-label={t("common.delete")}
            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-error-subtle hover:text-error"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto flex max-w-[920px] flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("categories.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("categories.subtitle")}</p>
        </div>
        <AsyncButton variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          {t("categories.newMapping")}
        </AsyncButton>
      </header>

      {isError ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-error-border bg-error-subtle px-4 py-3.5 text-error-subtle-foreground">
          <span className="text-sm font-medium">{t("categories.loadError")}</span>
          <AsyncButton variant="secondary" onClick={reload}>
            <RefreshCw className="size-3.5" />
            {t("common.retry")}
          </AsyncButton>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable
          rows={items}
          columns={columns}
          rowKey={(r) => r.id}
          emptyTitle={t("categories.emptyTitle")}
          emptyHint={t("categories.emptyHint")}
        />
      )}

      {/* Create */}
      <CategorySuffixDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        isSaving={isCreating}
        onSubmit={async (values) => {
          await createSuffix(values);
          setCreateOpen(false);
        }}
      />

      {/* Edit */}
      <CategorySuffixDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        item={editing}
        isSaving={isUpdating}
        onSubmit={async (values) => {
          if (!editing) return;
          await updateSuffix({ id: editing.id, body: values });
          setEditing(null);
        }}
      />

      {/* Delete */}
      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={async () => {
          if (!removeTarget) return;
          await deleteSuffix(removeTarget.id);
          setRemoveTarget(null);
        }}
        title={removeTarget ? t("categories.deleteTitle", { category: removeTarget.category }) : ""}
        description={t("categories.deleteDesc")}
        variant="destructive"
        confirmLabel={t("common.delete")}
        loadingLabel={t("categories.deleting")}
        isLoading={isDeleting}
      />
    </div>
  );
}
