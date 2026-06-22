import { useEffect } from "react";
import { Download, Upload } from "lucide-react";

import { FilterBar, type ActiveFilter } from "@/components/shared/filterBar";
import { ROUTES } from "@/types";
import { formatMAD } from "@/utils/format";

import { SurveillanceTabs } from "./_components/SurveillanceTabs";
import { VentesTable }      from "./_components/VentesTable";
import { useVentesPage }    from "./_hooks/useVentesPage";


export default function VentesPage() {
  const p = useVentesPage();

  // Wire search → suggestions debounce trigger. Keeps SearchAutocomplete decoupled from the API layer.
  useEffect(() => { p.setSuggestQ(p.filters.search); }, [p.filters.search, p]);

  const summary   = p.list?.summary;
  const totalRows = p.list?.pagination.total ?? 0;

  // Active filter pills (surveillance has its own dedicated tab row, so it stays out of this array).
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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Ventes</h1>
        <p className="text-sm text-muted-foreground">Historique des transactions de vente.</p>
      </header>

      <FilterBar
        search={{
          value:       p.filters.search,
          onChange:    p.setSearch,
          placeholder: "Produit, client, N° transaction…",
          suggestions: p.suggestions ? { Produit: p.suggestions.products, Client: p.suggestions.clients, "N° Transaction": p.suggestions.refs } : null,
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
          { label: "Importer",       icon: <Upload   className="size-4" />, variant: "primary", href: `${ROUTES.UPLOAD_FILE}?type=vente` },
        ]}
        activeFilters={activeFilters}
        onResetAll={p.reset}
      />

      {/* Surveillance tabs */}
      <SurveillanceTabs active={p.filters.surveillance} counts={p.counts} onSelect={p.setSurveillance} />

      {/* Table — pagination now lives inside the shared DataTable footer */}
      <VentesTable
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

      {/* SummaryFooter — TVA encaissée from backend aggregate (full filtered set, pagination-ignored) */}
      {(p.list?.data ?? []).length > 0 && summary && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 px-4 py-2 text-xs">
          <span className="text-muted-foreground">
            TVA encaissée <span className="text-foreground/60">(filtres actifs)</span> :
            <span className="ml-1 font-mono tabular-nums font-semibold text-foreground">{formatMAD(summary.tva_collected)}</span>
            <span className="mx-2 text-foreground/40">·</span>
            CA total :
            <span className="ml-1 font-mono tabular-nums font-semibold text-foreground">{formatMAD(summary.grand_total)}</span>
          </span>
        </div>
      )}
    </div>
  );
}

