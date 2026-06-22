import { useState } from "react";
import { Plus, Undo2 } from "lucide-react";

import { AsyncButton } from "@/components/shared/AsyncButton";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { FilterBar, type ActiveFilter } from "@/components/shared/filterBar";
import type { SpecialProduct } from "@/types";

import { ExcludeProductDialog } from "./_components/ExcludeProductDialog";
import { useProduitsSpeciaux } from "./_hooks/useProduitsSpeciaux";


function formatRelative(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}


export default function ProduitsSpeciauxPage() {
  const p = useProduitsSpeciaux();
  const [excluding, setExcluding] = useState(false);

  const activeFilters: ActiveFilter[] = p.search
    ? [{ key: "search", label: <>Recherche : {p.search}</>, onClear: () => p.setSearch("") }]
    : [];

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
    { key: "created_at", label: "Exclus le", width: 130, sortable: false,
      render: (sp) => <span className="text-xs text-muted-foreground">{formatRelative(sp.created_at)}</span> },
    { key: "actions", label: "", width: 130, align: "right", sortable: false,
      render: (sp) => (
        <AsyncButton
          variant="ghost"
          onClick={() => p.handleReintegrate(sp.medicament_id)}
          isLoading={p.reintegrating}
          loadingText="…"
          className="!h-7 !px-2 !text-xs text-warning hover:!bg-warning/10"
        >
          <Undo2 className="mr-1 size-3.5" /> Réintégrer
        </AsyncButton>
      ) },
  ];

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
            label:   "Exclure un produit",
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
        emptyHint={p.search ? "Aucun résultat pour cette recherche." : "Cliquez sur Exclure un produit pour commencer."}
        rowKey={(sp) => sp.medicament_id}
      />

      <ExcludeProductDialog
        open={excluding}
        onClose={() => setExcluding(false)}
        onSubmit={(id) => { p.handleExclude(id); setExcluding(false); }}
        isLoading={p.excluding}
        suggestions={p.suggestions}
        suggestionsLoading={p.suggestionsLoading}
        query={p.suggestQ}
        onQueryChange={p.setSuggestQ}
      />
    </div>
  );
}
