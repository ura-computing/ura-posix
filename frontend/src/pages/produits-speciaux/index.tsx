import { useState } from "react";
import { Plus, Undo2 } from "lucide-react";

import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { FilterBar, type ActiveFilter } from "@/components/shared/filterBar";
import type { SpecialProduct } from "@/types";

import { ExcludeProductDialog } from "./_components/ExcludeProductDialog";
import { ReintegrateProductsDialog } from "./_components/ReintegrateProductsDialog";
import { useProduitsSpeciaux } from "./_hooks/useProduitsSpeciaux";


function formatRelative(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}


const COLUMNS: ColumnDef<SpecialProduct>[] = [
  { key: "product", label: "Produit", width: 320,
    render: (sp) => (
      <div className="flex flex-col">
        <span className="truncate text-sm" title={sp.product}>{sp.product}</span>
        <span className="truncate font-mono text-[10px] text-muted-foreground">{sp.pid}</span>
      </div>
    ) },
  { key: "category", label: "Catégorie", width: 200, sortable: false,
    render: (sp) => sp.category
      ? <span className="block max-w-[190px] truncate text-xs text-muted-foreground">{sp.category}</span>
      : <span className="text-muted-foreground">—</span> },
  { key: "created_at", label: "Exclus le", width: 160, sortable: false,
    render: (sp) => <span className="text-xs text-muted-foreground">{formatRelative(sp.created_at)}</span> },
];


export default function ProduitsSpeciauxPage() {
  const p = useProduitsSpeciaux();
  const [excluding, setExcluding] = useState(false);
  const [reintegrating, setReintegrating] = useState(false);

  const activeFilters: ActiveFilter[] = p.search
    ? [{ key: "search", label: <>Recherche : {p.search}</>, onClear: () => p.setSearch("") }]
    : [];

  const hasSpeciaux = p.specialProducts.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Produits spéciaux</h1>
        <p className="text-sm text-muted-foreground">
          Excluez un produit de vos rapports en un clic. Réversible à tout moment — aucune validation administrateur.
        </p>
      </header>

      <FilterBar
        search={{
          value:       p.search,
          onChange:    p.setSearch,
          placeholder: "Rechercher dans vos exclusions…",
          suggestions: null,
        }}
        rightActions={[
          {
            label:    "Réintégrer des produits",
            icon:     <Undo2 className="size-4" />,
            variant:  "outline",
            onClick:  () => setReintegrating(true),
            disabled: !hasSpeciaux,
          },
          {
            label:   "Exclure des produits",
            icon:    <Plus className="size-4" />,
            variant: "primary",
            onClick: () => setExcluding(true),
          },
        ]}
        activeFilters={activeFilters}
        onResetAll={() => p.setSearch("")}
      />

      <DataTable<SpecialProduct>
        rows={p.filteredProducts}
        columns={COLUMNS}
        isLoading={p.isLoading}
        emptyTitle="Aucun produit exclu"
        emptyHint={p.search ? "Aucun résultat pour cette recherche." : "Cliquez sur Exclure des produits pour commencer."}
        rowKey={(sp) => sp.medicament_id}
      />

      <ExcludeProductDialog
        open={excluding}
        onClose={() => setExcluding(false)}
        onSubmit={(ids) => { p.handleExclude(ids); setExcluding(false); }}
        isLoading={p.excluding}
        suggestions={p.suggestions}
        suggestionsLoading={p.suggestionsLoading}
        query={p.suggestQ}
        onQueryChange={p.setSuggestQ}
      />

      <ReintegrateProductsDialog
        open={reintegrating}
        onClose={() => setReintegrating(false)}
        onSubmit={(ids) => { p.handleReintegrate(ids); setReintegrating(false); }}
        isLoading={p.reintegrating}
        specialProducts={p.specialProducts}
      />
    </div>
  );
}
