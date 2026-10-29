/** /admin/categories — Catégories → suffixes mapping (admin only).
 *
 *  Header + DataTable + create/edit dialog + confirm-delete dialog. Uses the
 *  shared DataTable primitive so empty/loading/sort states stay consistent
 *  with the rest of the app. */
import { useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2, Check, Minus } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { FormField, FormInput } from "@/_components/FormField";
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
import { Page } from "@/_components/Page";
import { Spinner } from "@/_components/atoms/Spinner";
import { Card } from "@/_components/atoms/Card";

/** Create / edit dialog for a CategorySuffix. Mirrors the handoff design via
 *  our shared primitives (Dialog, Button, SuffixBadge). The category is
 *  saved as typed (spaces tidied); the backend matches it ignoring accents,
 *  case and the « (x%) » part (`csv_parse.suffix_key`). */

/** Hex for the swatch fill — solids matching the SuffixBadge palette tone. */
const SWATCH_SOLID: Record<SuffixColor, string> = {
  teal: "#0E9E8C",
  blue: "#1D6FB8",
  purple: "#7C3AED",
  amber: "#B7791F",
  rose: "#D6447B",
  emerald: "#1E9E63",
  orange: "#E07F1F",
  pink: "#E84A7B",
};

interface CategorySuffixDialogProps {
  open: boolean;
  onClose: () => void;
  /** Pass an item to edit; omit to create. */
  item?: CategorySuffixOut | null;
  isSaving?: boolean;
  onSubmit: (values: CategorySuffixIn) => Promise<unknown>;
}

/** Mounted only while open, once per item: the fields start from `item`. */
function CategorySuffixDialog(props: CategorySuffixDialogProps) {
  return props.open ? <CategorySuffixBody key={props.item?.id ?? "new"} {...props} /> : null;
}

function CategorySuffixBody({ open, onClose, item, isSaving, onSubmit }: CategorySuffixDialogProps) {
  const t = useT();
  const [values, setValues] = useState<CategorySuffixIn>({
    category: item?.category ?? "",
    suffix: item?.suffix ?? "",
    color: item?.color ?? "teal",
  });

  const set = <K extends keyof CategorySuffixIn>(k: K, v: CategorySuffixIn[K]) => setValues((p) => ({ ...p, [k]: v }));

  const previewSuffix = values.suffix || "-?";
  const previewCategory = values.category
    ? normalizeCategory(values.category)
    : t("categories.previewCategoryFallback");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ ...values, category: normalizeCategory(values.category) });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-[17px] font-semibold text-foreground">
            {item ? t("categories.editMapping") : t("categories.newMapping")}
          </h3>
        </div>

        {/* Live preview */}
        <div className="flex items-center gap-3 border-b border-border bg-surface-subtle px-5 py-3.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("categories.preview")}
          </span>
          <SuffixBadge text={previewSuffix} color={values.color ?? "teal"} />
          <span className="ml-auto font-mono text-xs text-muted-foreground">{previewCategory}</span>
        </div>

        <form className="flex flex-col gap-4 p-5" onSubmit={handleSubmit}>
          <FormField label={t("col.categorie")} required>
            <FormInput
              value={values.category}
              onChange={(v) => set("category", v)}
              placeholder={t("categories.categoryPlaceholderEx")}
              required
              autoFocus
            />
          </FormField>

          <FormField label={t("categories.suffix")} required hint={t("categories.suffixHint")}>
            <FormInput
              value={values.suffix}
              onChange={(v) => set("suffix", v)}
              placeholder="-1"
              maxLength={6}
              required
              className="max-w-[140px] font-mono"
            />
          </FormField>

          <FormField label={t("categories.color")}>
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
          </FormField>

          <div className="-mx-5 -mb-5 mt-1 flex items-center justify-end gap-2.5 border-t border-border bg-surface-subtle px-5 py-3.5">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving} loadingText={t("categories.saving")}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function normalizeCategory(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export default function AdminCategoriesPage() {
  const t = useT();
  const { suffixes, isLoading, isError, reload } = useCategorySuffixes();
  const { createSuffix, isCreating } = useCreateCategorySuffix();
  const { updateSuffix, isUpdating } = useUpdateCategorySuffix();
  const { deleteSuffix, isDeleting } = useDeleteCategorySuffix();

  const [editing, setEditing] = useState<CategorySuffixOut | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<CategorySuffixOut | null>(null);

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
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            onClick={() => setEditing(row)}
            aria-label={t("common.edit")}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:bg-error-subtle hover:text-error"
            onClick={() => setRemoveTarget(row)}
            aria-label={t("common.delete")}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Page
      title={t("categories.title")}
      subtitle={t("categories.subtitle")}
      actions={
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          {t("categories.newMapping")}
        </Button>
      }
    >
      {isError ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-error-border bg-error-subtle px-4 py-3.5 text-error-subtle-foreground">
          <span className="text-sm font-medium">{t("categories.loadError")}</span>
          <Button variant="secondary" onClick={reload}>
            <RefreshCw className="size-3.5" />
            {t("common.retry")}
          </Button>
        </div>
      ) : isLoading ? (
        <Card as="div" padding="none" className="flex items-center justify-center py-16">
          <Spinner size="lg" className="text-muted-foreground" />
        </Card>
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
    </Page>
  );
}
