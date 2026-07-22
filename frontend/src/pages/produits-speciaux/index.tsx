import { useState } from "react";
import { FileText, Package, Plus, Undo2 } from "lucide-react";

import { AsyncButton } from "@/components/shared/AsyncButton";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { FilterBar, type ActiveFilter } from "@/components/shared/filterBar";
import { cn } from "@/utils/cn";
import { formatMAD, formatQty } from "@/utils/format";
import type { BlExclusion, SpecialProduct } from "@/types";

import { ExcludeBlDialog } from "./_components/ExcludeBlDialog";
import { ExcludeProductDialog } from "./_components/ExcludeProductDialog";
import { ReintegrateProductsDialog } from "./_components/ReintegrateProductsDialog";
import { useBlExclusions } from "./_hooks/useBlExclusions";
import { useProduitsSpeciaux } from "./_hooks/useProduitsSpeciaux";
import { useT, type TFn } from "@/i18n/I18nProvider";


function formatRelative(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}


const buildProductColumns = (t: TFn): ColumnDef<SpecialProduct>[] => [
  { key: "product", label: t("col.produit"), width: 320,
    render: (sp) => (
      <div className="flex flex-col">
        <span className="truncate text-sm" title={sp.product}>{sp.product}</span>
        <span className="truncate font-mono text-[10px] text-muted-foreground">{sp.pid}</span>
      </div>
    ) },
  { key: "category", label: t("col.categorie"), width: 200, sortable: false,
    render: (sp) => sp.category
      ? <span className="block max-w-[190px] truncate text-xs text-muted-foreground">{sp.category}</span>
      : <span className="text-muted-foreground">—</span> },
  { key: "created_at", label: t("ps.exclusLe"), width: 160, sortable: false,
    render: (sp) => <span className="text-xs text-muted-foreground">{formatRelative(sp.created_at)}</span> },
];


type Tab = "produits" | "bl";


export default function ProduitsSpeciauxPage() {
  const t = useT();
  const p  = useProduitsSpeciaux();
  const bl = useBlExclusions();
  const [tab, setTab] = useState<Tab>("produits");
  const [excluding, setExcluding]         = useState(false);
  const [reintegrating, setReintegrating] = useState(false);
  const [excludingBl, setExcludingBl]     = useState(false);

  const blColumns: ColumnDef<BlExclusion>[] = [
    { key: "delivery_ref", label: t("col.reference"), width: 200, sortable: false,
      render: (b) => <span className="font-mono text-sm font-medium text-foreground">{b.delivery_ref}</span> },
    { key: "supplier", label: t("col.fournisseur"), width: 200, sortable: false,
      render: (b) => <span className="block max-w-[190px] truncate text-sm text-muted-foreground" title={b.supplier ?? ""}>{b.supplier ?? "—"}</span> },
    { key: "delivery_date", label: t("col.dateBL"), width: 120, sortable: false,
      render: (b) => <span className="text-xs text-muted-foreground">{formatRelative(b.delivery_date ?? "")}</span> },
    { key: "nb_lines", label: t("ps.lignes"), width: 80, align: "right", sortable: false,
      render: (b) => <span className="tabular-nums text-sm">{formatQty(b.nb_lines)}</span> },
    { key: "total", label: t("col.total"), width: 120, align: "right", sortable: false,
      render: (b) => <span className="font-mono text-sm tabular-nums">{formatMAD(b.total)}</span> },
    { key: "notes", label: t("ps.note"), width: 220, sortable: false,
      render: (b) => b.notes
        ? <span className="block max-w-[210px] truncate text-xs text-muted-foreground" title={b.notes}>{b.notes}</span>
        : <span className="text-muted-foreground">—</span> },
    { key: "created_at", label: t("ps.exclusLe"), width: 130, sortable: false,
      render: (b) => <span className="text-xs text-muted-foreground">{formatRelative(b.created_at)}</span> },
    { key: "_action", label: "", width: 130, sortable: false, align: "right",
      render: (b) => (
        <AsyncButton
          variant="ghost"
          type="button"
          isLoading={bl.reintegrating}
          onClick={() => bl.handleReintegrate([b.delivery_ref])}
        >
          <Undo2 className="size-3.5" /> {t("ps.reintegrer")}
        </AsyncButton>
      ) },
  ];

  const productFilters: ActiveFilter[] = p.search
    ? [{ key: "search", label: <>{t("common.recherche")} {p.search}</>, onClear: () => p.setSearch("") }]
    : [];
  const blFilters: ActiveFilter[] = bl.search
    ? [{ key: "search", label: <>{t("common.recherche")} {bl.search}</>, onClear: () => bl.setSearch("") }]
    : [];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("nav.produitsSpeciaux")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("ps.subtitle")}
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          { id: "produits" as const, label: t("ps.tabProduits"), icon: <Package className="size-4" /> },
          { id: "bl" as const,       label: t("ps.tabBL"), icon: <FileText className="size-4" /> },
        ]).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px inline-flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Produits tab ─────────────────────────────────────────────────── */}
      {tab === "produits" && (
        <>
          <FilterBar
            search={{
              value:       p.search,
              onChange:    p.setSearch,
              placeholder: t("ps.searchProdPh"),
              suggestions: null,
            }}
            rightActions={[
              { label: t("ps.reintegrerProduits"), icon: <Undo2 className="size-4" />, variant: "outline",
                onClick: () => setReintegrating(true), disabled: p.specialProducts.length === 0 },
              { label: t("ps.exclureProduits"), icon: <Plus className="size-4" />, variant: "primary",
                onClick: () => setExcluding(true) },
            ]}
            activeFilters={productFilters}
            onResetAll={() => p.setSearch("")}
          />

          <DataTable<SpecialProduct>
            rows={p.filteredProducts}
            columns={buildProductColumns(t)}
            isLoading={p.isLoading}
            emptyTitle={t("ps.emptyProduits")}
            emptyHint={p.search ? t("ps.emptySearchHint") : t("ps.emptyProduitsHint")}
            rowKey={(sp) => sp.medicament_id}
          />
        </>
      )}

      {/* ── Bons de livraison tab ────────────────────────────────────────── */}
      {tab === "bl" && (
        <>
          <FilterBar
            search={{
              value:       bl.search,
              onChange:    bl.setSearch,
              placeholder: t("ps.searchBlPh"),
              suggestions: null,
            }}
            rightActions={[
              { label: t("ps.exclureBl"), icon: <Plus className="size-4" />, variant: "primary",
                onClick: () => setExcludingBl(true) },
            ]}
            activeFilters={blFilters}
            onResetAll={() => bl.setSearch("")}
          />

          <DataTable<BlExclusion>
            rows={bl.filtered}
            columns={blColumns}
            isLoading={bl.isLoading}
            emptyTitle={t("ps.emptyBl")}
            emptyHint={bl.search ? t("ps.emptySearchHint") : t("ps.emptyBlHint")}
            rowKey={(b) => b.delivery_ref}
          />
        </>
      )}

      {/* Dialogs */}
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

      <ExcludeBlDialog
        open={excludingBl}
        onClose={() => setExcludingBl(false)}
        onSubmit={(ref, notes) => { bl.handleExclude(ref, notes); setExcludingBl(false); }}
        isLoading={bl.excluding}
        results={bl.results}
        resultsLoading={bl.resultsLoading}
        searchQ={bl.searchQ}
        onSearchChange={bl.setSearchQ}
      />
    </div>
  );
}
