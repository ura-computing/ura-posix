/** /admin/categories — Catégories → suffixes mapping (admin only).
 *
 *  Header + DataTable + create/edit dialog + confirm-delete dialog. Uses the
 *  shared DataTable primitive so empty/loading/sort states stay consistent
 *  with the rest of the app. */
import { useState } from "react";
import { Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

import { AsyncButton } from "@/components/shared/AsyncButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable } from "@/components/shared/DataTable";
import { SuffixBadge } from "@/components/shared/SuffixBadge";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { CategorySuffixOut } from "@/types";

import { CategorySuffixDialog } from "./_components/CategorySuffixDialog";
import {
  useCategorySuffixes,
  useCreateCategorySuffix,
  useDeleteCategorySuffix,
  useUpdateCategorySuffix,
} from "./_hooks/useCategorySuffixes";


function normalizeCategory(input: string): string {
  return input.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}


export default function AdminCategoriesPage() {
  const list = useCategorySuffixes();
  const createMut = useCreateCategorySuffix();
  const updateMut = useUpdateCategorySuffix();
  const deleteMut = useDeleteCategorySuffix();

  const [editing,        setEditing]        = useState<CategorySuffixOut | null>(null);
  const [createOpen,     setCreateOpen]     = useState(false);
  const [removeTarget,   setRemoveTarget]   = useState<CategorySuffixOut | null>(null);

  const items = list.data ?? [];

  const columns: ColumnDef<CategorySuffixOut>[] = [
    {
      key: "category",
      label: "Catégorie",
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
      label: "Suffixe",
      sortable: false,
      render: (row) => (
        // SuffixBadge returns null when color is null — render a fallback gray pill so
        // the cell isn't empty for un-colored mappings.
        row.color
          ? <SuffixBadge text={row.suffix} color={row.color} />
          : <span className="inline-flex items-center rounded-md border border-border bg-muted px-1.5 py-px font-mono text-[10px] font-semibold text-muted-foreground">{row.suffix}</span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      sortable: false,
      width: 110,
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setEditing(row)}
            aria-label="Modifier"
            className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-surface-subtle hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setRemoveTarget(row)}
            aria-label="Supprimer"
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Catégories</h1>
          <p className="text-sm text-muted-foreground">Suffixes de référence par catégorie de produit.</p>
        </div>
        <AsyncButton variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Nouveau mapping
        </AsyncButton>
      </header>

      {list.isError ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-error-border bg-error-subtle px-4 py-3.5 text-error-subtle-foreground">
          <span className="text-sm font-medium">Impossible de charger les mappings.</span>
          <AsyncButton variant="secondary" onClick={() => list.refetch()}>
            <RefreshCw className="size-3.5" />
            Réessayer
          </AsyncButton>
        </div>
      ) : list.isLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable
          rows={items}
          columns={columns}
          rowKey={(r) => r.id}
          emptyTitle="Aucun mapping configuré"
          emptyHint="Cliquez sur Nouveau mapping pour commencer."
        />
      )}

      {/* Create */}
      <CategorySuffixDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        isSaving={createMut.isPending}
        onSubmit={async (values) => {
          await createMut.mutateAsync(values);
          setCreateOpen(false);
        }}
      />

      {/* Edit */}
      <CategorySuffixDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        item={editing}
        isSaving={updateMut.isPending}
        onSubmit={async (values) => {
          if (!editing) return;
          await updateMut.mutateAsync({ id: editing.id, body: values });
          setEditing(null);
        }}
      />

      {/* Delete */}
      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={async () => {
          if (!removeTarget) return;
          await deleteMut.mutateAsync(removeTarget.id);
          setRemoveTarget(null);
        }}
        title={removeTarget ? `Supprimer le mapping « ${removeTarget.category} » ?` : ""}
        description="Les ventes liées à cette catégorie n'afficheront plus de suffixe coloré."
        variant="destructive"
        confirmLabel="Supprimer"
        loadingLabel="Suppression…"
        isLoading={deleteMut.isPending}
      />
    </div>
  );
}
