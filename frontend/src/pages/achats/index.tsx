import { useEffect } from "react";
import { Download, Upload } from "lucide-react";

import { FilterBar, type ActiveFilter } from "@/components/shared/filterBar";
import { ROUTES } from "@/types";
import { formatMAD } from "@/utils/format";

import { AchatsTable }     from "./_components/AchatsTable";
import { SupplierGauge }   from "./_components/SupplierGauge";
import { useAchatsPage }   from "./_hooks/useAchatsPage";


export default function AchatsPage() {
  const p = useAchatsPage();

  // Wire search → suggestions debounce trigger. Same pattern as Ventes.
  useEffect(() => { p.setSuggestQ(p.filters.search); }, [p.filters.search, p]);

  const summary    = p.list?.summary;
  const totalRows  = p.list?.pagination.total ?? 0;

  // Build active filter pills array — empty when no filter set, FilterBar hides the row.
  const activeFilters: ActiveFilter[] = [
    p.filters.search ? {
      key: "search",
      label: <>Recherche : {p.filters.search}</>,
      onClear: () => p.setSearch(""),
    } : null,
    (p.filters.date_from || p.filters.date_to) ? {
      key: "dates",
      label: <>{p.filters.date_from ?? "…"} → {p.filters.date_to ?? "…"}</>,
      onClear: () => p.setDateRange(null, null),
    } : null,
    p.filters.category.length > 0 ? {
      key: "category",
      label: <>Catégorie : {p.filters.category[0]}{p.filters.category.length > 1 ? `, +${p.filters.category.length - 1}` : ""}</>,
      onClear: () => p.setCategories([]),
    } : null,
    p.filters.tva.length > 0 ? {
      key: "tva",
      label: <>TVA : {p.filters.tva.length}</>,
      onClear: () => p.setTva([]),
    } : null,
  ].filter(Boolean) as ActiveFilter[];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Achats</h1>
        <p className="text-sm text-muted-foreground">Historique des bons de livraison fournisseurs.</p>
      </header>

      <FilterBar
        search={{
          value:       p.filters.search,
          onChange:    p.setSearch,
          placeholder: "Produit, fournisseur, référence…",
          suggestions: p.suggestions ? { Produit: p.suggestions.products, Fournisseur: p.suggestions.suppliers, Référence: p.suggestions.refs } : null,
          onPick:      (label) => { p.setSearch(label); p.setSuggestQ(""); },
          isLoading:   p.suggestionsLoading,
        }}
        dateRange={{
          from:     p.filters.date_from,
          to:       p.filters.date_to,
          onChange: p.setDateRange,
        }}
        multiSelects={[
          { label: "Catégorie", options: p.categories, selected: p.filters.category, onChange: p.setCategories },
          { label: "TVA",       options: p.tvaRates,   selected: p.filters.tva,      onChange: p.setTva },
        ]}
        rightActions={[
          { label: "Exporter Excel", icon: <Download className="size-4" />, variant: "outline", onClick: p.handleExport },
          { label: "Importer",       icon: <Upload   className="size-4" />, variant: "primary", href: `${ROUTES.UPLOAD_FILE}?type=achat` },
        ]}
        activeFilters={activeFilters}
        onResetAll={p.reset}
      />

      <SupplierGauge data={p.supplierSummary} isLoading={p.supplierLoading} />

      <AchatsTable
        rows={p.list?.data ?? []}
        isLoading={p.isLoading}
        sortBy={p.filters.sort_by}
        sortOrder={p.filters.sort_order}
        onSort={p.setSort}
        pagination={{
          page:       p.filters.page,
          pageSize:   p.filters.limit,
          total:      totalRows,
          onPage:     p.setPage,
          onPageSize: p.setPageSize,
        }}
      />

      {/* Summary footer — TVA payé + CA total over the FULL filtered set */}
      {(p.list?.data ?? []).length > 0 && summary && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 px-4 py-2 text-xs">
          <span className="text-muted-foreground">
            TVA payé <span className="text-foreground/60">(filtres actifs)</span> :
            <span className="ml-1 font-mono tabular-nums font-semibold text-foreground">{formatMAD(summary.tva_payee)}</span>
            <span className="mx-2 text-foreground/40">·</span>
            Total achats :
            <span className="ml-1 font-mono tabular-nums font-semibold text-foreground">{formatMAD(summary.grand_total)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
