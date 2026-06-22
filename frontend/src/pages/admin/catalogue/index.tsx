import { useState } from "react";
import { Pencil, Trash2, Plus, UploadCloud } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { FilterBar, type ActiveFilter } from "@/components/shared/filterBar";
import { cn } from "@/utils/cn";
import { formatMAD } from "@/utils/format";
import type { Medicament, MedicamentInput, ProductType } from "@/types";

import { ImportCsvDialog } from "./_components/ImportCsvDialog";
import { MedicamentFormDialog } from "./_components/MedicamentFormDialog";
import { useCatalogPage } from "./_hooks/useCatalogPage";


function TypeBadge({ type }: { type: ProductType | null }) {
  if (!type) return <span className="text-muted-foreground">—</span>;
  const isPharma = type === "pharmacie";
  return (
    <span className={cn(
      "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium",
      isPharma
        ? "bg-pharmacie-bg text-pharmacie-fg border border-pharmacie-border"
        : "bg-parapharmacie-bg text-parapharmacie-fg border border-parapharmacie-border",
    )}>
      {isPharma ? "Pharmacie" : "Parapharmacie"}
    </span>
  );
}


export default function CataloguePage() {
  const p = useCatalogPage();

  const [editing,  setEditing]  = useState<Medicament | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Medicament | null>(null);
  const [importing, setImporting] = useState(false);

  const activeFilters: ActiveFilter[] = [
    p.filters.search ? {
      key: "search",
      label: <>Recherche : {p.filters.search}</>,
      onClear: () => p.setSearch(""),
    } : null,
    p.filters.category.length > 0 ? {
      key: "category",
      label: <>Catégorie : {p.filters.category[0]}{p.filters.category.length > 1 ? `, +${p.filters.category.length - 1}` : ""}</>,
      onClear: () => p.setCategories([]),
    } : null,
    p.filters.type ? {
      key: "type",
      label: <>Type : {p.filters.type === "pharmacie" ? "Pharmacie" : p.filters.type === "parapharmacie" ? "Parapharmacie" : "Non classés"}</>,
      onClear: () => p.setType(null),
    } : null,
  ].filter(Boolean) as ActiveFilter[];

  const COLUMNS: ColumnDef<Medicament>[] = [
    { key: "product", label: "Produit", width: 280,
      render: (m) => (
        <div className="flex flex-col">
          <span className="truncate text-sm" title={m.product}>{m.product}</span>
          <span className="truncate font-mono text-[10px] text-muted-foreground">{m.pid}</span>
        </div>
      ) },
    { key: "category", label: "Catégorie", width: 180,
      render: (m) => <span className="block max-w-[170px] truncate text-xs text-muted-foreground">{m.category ?? "—"}</span> },
    { key: "type", label: "Type", width: 120, sortable: false,
      render: (m) => <TypeBadge type={m.product_type} /> },
    { key: "tva", label: "TVA", width: 90,
      render: (m) => m.tva ? <span className="font-mono text-[11px] text-muted-foreground">{m.tva}</span> : <span className="text-muted-foreground">—</span> },
    { key: "pph", label: "PPH", width: 100, align: "right",
      render: (m) => <span className="text-muted-foreground">{m.pph != null ? formatMAD(m.pph) : "—"}</span> },
    { key: "ppv", label: "PPV", width: 100, align: "right",
      render: (m) => m.ppv != null ? formatMAD(m.ppv) : "—" },
    { key: "laboratoire", label: "Laboratoire", width: 170,
      render: (m) => m.laboratoire ? <span className="truncate text-xs" title={m.laboratoire}>{m.laboratoire}</span> : <span className="text-muted-foreground">—</span> },
    { key: "actions", label: "", width: 90, align: "right", sortable: false,
      render: (m) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            aria-label="Modifier"
            onClick={() => setEditing(m)}
            className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-surface-subtle hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Supprimer"
            onClick={() => setRemoving(m)}
            className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-error-subtle hover:text-error"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Catalogue médicaments</h1>
        <p className="text-sm text-muted-foreground">Gérez le catalogue partagé des médicaments.</p>
      </header>

      <FilterBar
        search={{
          value:       p.filters.search,
          onChange:    p.setSearch,
          placeholder: "Nom, catégorie, code-barres, laboratoire…",
          suggestions: null,
        }}
        multiSelects={[
          { label: "Catégorie", options: p.categories, selected: p.filters.category, onChange: p.setCategories },
        ]}
        singleSelect={{
          label:    "Type",
          options:  [
            { value: "",              label: "Tous types" },
            { value: "pharmacie",     label: "Pharmacie" },
            { value: "parapharmacie", label: "Parapharmacie" },
            { value: "unclassified",  label: "Non classés" },
          ],
          value:    p.filters.type ?? "",
          onChange: (v) => p.setType((v === "" ? null : v) as ProductType | "unclassified" | null),
        }}
        rightActions={[
          { label: "Importer CSV", icon: <UploadCloud className="size-4" />, variant: "outline", onClick: () => setImporting(true) },
          { label: "Ajouter",      icon: <Plus className="size-4" />,        variant: "primary", onClick: () => setCreating(true) },
        ]}
        activeFilters={activeFilters}
        onResetAll={p.reset}
      />

      <DataTable<Medicament>
        rows={p.list?.data ?? []}
        columns={COLUMNS}
        isLoading={p.isLoading}
        sortBy={p.filters.sort_by}
        sortOrder={p.filters.sort_order}
        onSort={p.setSort}
        pagination={{
          page:       p.filters.page,
          pageSize:   p.filters.limit,
          total:      p.list?.pagination.total ?? 0,
          onPage:     p.setPage,
          onPageSize: p.setPageSize,
          pageSizes:  [25, 50, 100],
        }}
        emptyTitle="Aucun médicament trouvé"
        emptyHint="Ajustez les filtres ou importez un fichier CSV."
        rowKey={(m) => m.id}
      />

      {/* Create dialog */}
      <MedicamentFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        initial={null}
        isLoading={p.creating}
        onSubmit={(body: MedicamentInput) => {
          p.create(body);
          setCreating(false);
        }}
      />

      {/* Edit dialog */}
      <MedicamentFormDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        initial={editing}
        isLoading={p.updating}
        onSubmit={(body) => {
          if (editing) p.update(editing.id, body);
          setEditing(null);
        }}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => { if (removing) { p.remove(removing.id); setRemoving(null); } }}
        title="Supprimer ce médicament ?"
        description={removing ? `« ${removing.product} » sera supprimé du catalogue. Les achats et ventes existants conservent leur référence.` : undefined}
        variant="destructive"
        confirmLabel="Supprimer"
        loadingLabel="Suppression…"
        isLoading={p.removing}
      />

      {/* Import CSV */}
      <ImportCsvDialog
        open={importing}
        onClose={() => setImporting(false)}
        onSubmit={(f) => p.importCsv(f)}
        isLoading={p.importing}
        lastResult={p.lastImport}
      />
    </div>
  );
}
