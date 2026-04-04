import { Download, Search, BarChart3, TrendingUp, Percent, Package } from "lucide-react";

import { ListView } from "@/components/shared/listView";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/cn";
import { fmt } from "@/utils/format";
import { eCategoryType } from "@/types";
import { useAnalysePage } from "@/hooks/useAnalysePage";
import { AnalyseMargeTable } from "@/pages/rapports/margeTable";

const MODE_LABELS = {
  produit: "Produit",
  categorie: "Catégorie",
  fournisseur: "Fournisseur",
  bl: "BL",
  laboratoire: "Laboratoire",
  operateur: "Opérateur",
  mois: "Mois",
} as const;

export default function AnalysePage() {
  const {
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    categoryType, setCategoryType,
    margeMode, setMargeMode,
    search, setSearch,
    margeData, margeLoading, allRows,
    selected, kpis,
    toggleRow, toggleAll, resetSelection,
    exportCsv,
  } = useAnalysePage();

  return (
    <ListView>
      <Breadcrumb />
      <h1 className="page-title">Analyse</h1>
      <p className="text-sm text-muted-foreground -mt-2">
        Sélectionnez des produits pour analyser vos marges et exporter les données.
      </p>

      {/* ── Sticky filter bar ── */}
      <div className="sticky top-16 z-10 bg-background pb-4">
        <Card className="border border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Du</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-40 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Au</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-40 text-sm" />
              </div>
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={() => { setDateFrom(""); setDateTo(""); }}>
                  Réinitialiser
                </Button>
              )}
              <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                <Button size="sm" variant={categoryType === eCategoryType.ALL ? "default" : "outline"} className="h-9" onClick={() => setCategoryType(eCategoryType.ALL)}>
                  Mixte
                </Button>
                <Button
                  size="sm"
                  className={cn("h-9 border", categoryType === eCategoryType.PHARMACIE
                    ? "bg-green-600 text-white border-green-600 hover:bg-green-700"
                    : "bg-transparent text-green-700 border-green-400 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950/30"
                  )}
                  onClick={() => setCategoryType(eCategoryType.PHARMACIE)}
                >
                  Pharmacie
                </Button>
                <Button
                  size="sm"
                  className={cn("h-9 border", categoryType === eCategoryType.PARAPHARMACIE
                    ? "bg-purple-600 text-white border-purple-600 hover:bg-purple-700"
                    : "bg-transparent text-purple-700 border-purple-400 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-700 dark:hover:bg-purple-950/30"
                  )}
                  onClick={() => setCategoryType(eCategoryType.PARAPHARMACIE)}
                >
                  Parapharmacie
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Mode tabs ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {(Object.keys(MODE_LABELS) as (keyof typeof MODE_LABELS)[]).map((m) => (
          <Button
            key={m}
            size="sm"
            variant="outline"
            className={cn("h-8 text-xs", margeMode === m ? "bg-primary text-primary-foreground hover:bg-primary/90" : "")}
            onClick={() => { setMargeMode(m); resetSelection(); }}
          >
            {MODE_LABELS[m]}
          </Button>
        ))}
      </div>

      {/* ── KPI cards (visible when rows selected) ── */}
      {kpis.count > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase">CA sélection</p>
                  <p className="text-lg font-bold">{fmt(kpis.ca)} MAD</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase">Quantité</p>
                  <p className="text-lg font-bold">{kpis.qty.toFixed(0)} unités</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase">Marge %</p>
                  <p className="text-lg font-bold">{kpis.margePctAvg != null ? `${kpis.margePctAvg.toFixed(1)}%` : "—"}</p>
                  <p className="text-[9px] text-muted-foreground/60 font-mono">(1 − PU÷PPV) × 100</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase">Marge DH</p>
                  <p className="text-lg font-bold">{kpis.margeDhAvg != null ? `${fmt(kpis.margeDhAvg)} MAD` : "—"}</p>
                  <p className="text-[9px] text-muted-foreground/60 font-mono">PPV − PU</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Search + actions bar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un produit, catégorie, fournisseur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-9 text-xs" onClick={toggleAll}>
            {selected.size === allRows.length && allRows.length > 0 ? "Tout désélectionner" : "Tout sélectionner"}
          </Button>
          {kpis.count > 0 && (
            <Button size="sm" className="h-9 text-xs gap-1.5" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5" />
              Exporter CSV ({kpis.count})
            </Button>
          )}
        </div>
      </div>

      {/* ── Selection summary ── */}
      {kpis.count > 0 && (
        <p className="text-xs text-muted-foreground">
          {kpis.count} élément{kpis.count > 1 ? "s" : ""} sélectionné{kpis.count > 1 ? "s" : ""} sur {allRows.length}
        </p>
      )}

      {/* ── Data table with checkboxes ── */}
      {margeLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : allRows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center border-2 border-dashed rounded-lg">
          <BarChart3 className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="text-base font-semibold">Aucune donnée</p>
            <p className="text-sm text-muted-foreground mt-1">
              Importez des achats et des ventes pour commencer votre analyse.
            </p>
          </div>
        </div>
      ) : (
        <AnalyseMargeTable
          mode={margeMode}
          data={margeData}
          loading={margeLoading}
          selectable
          selected={selected}
          onToggle={toggleRow}
        />
      )}
    </ListView>
  );
}
