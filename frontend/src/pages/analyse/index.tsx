import { Download, Search, BarChart3 } from "lucide-react";

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
  fournisseur: "Fournisseur",
  operateur: "Opérateur",
  laboratoire: "Laboratoire",
  mois: "Mois / année",
  categorie: "Catégorie",
  bl: "Liste",
} as const;

/* ── Optimisation gauge ──────────────────────────────────────────────────── */

function OptimisationGauge({ gain }: { gain: number | null }) {
  const val = gain ?? 0;
  const pct = Math.min(100, Math.max(0, val > 0 ? 70 : 30));

  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-[10px] text-muted-foreground font-medium uppercase">Optimisation marge</p>
      <div className="relative w-full h-5 rounded-full overflow-hidden bg-gradient-to-r from-red-500 via-yellow-400 to-green-500">
        <div
          className="absolute top-0 h-full w-1 bg-white border border-black/30 rounded-full"
          style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
        />
      </div>
      <div className="flex justify-between w-full text-[9px] text-muted-foreground">
        <span>détériorer</span>
        <span>grossièrement</span>
      </div>
    </div>
  );
}

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

  const k = margeData?.kpis;

  return (
    <ListView>
      <Breadcrumb />
      <h1 className="page-title">Analyses</h1>

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
                <Button size="sm" variant={categoryType === eCategoryType.ALL ? "default" : "outline"} className="h-9" onClick={() => setCategoryType(eCategoryType.ALL)}>Mixte</Button>
                <Button size="sm" className={cn("h-9 border", categoryType === eCategoryType.PHARMACIE ? "bg-green-600 text-white border-green-600 hover:bg-green-700" : "bg-transparent text-green-700 border-green-400 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950/30")} onClick={() => setCategoryType(eCategoryType.PHARMACIE)}>Pharmacie</Button>
                <Button size="sm" className={cn("h-9 border", categoryType === eCategoryType.PARAPHARMACIE ? "bg-purple-600 text-white border-purple-600 hover:bg-purple-700" : "bg-transparent text-purple-700 border-purple-400 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-700 dark:hover:bg-purple-950/30")} onClick={() => setCategoryType(eCategoryType.PARAPHARMACIE)}>Parapharmacie</Button>
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

      {/* ── KPI Section (matching screen8) ── */}
      {k && !margeLoading && (
        <Card className="border border-border">
          <CardContent className="p-4">
            <div className="grid grid-cols-4 gap-4">
              {/* Column 1: Totals */}
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase">Total vente MAD</p>
                  <p className="text-base font-bold tabular-nums">{fmt(k.total_ventes_dh)} MAD</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase">Total vente unités</p>
                  <p className="text-base font-bold tabular-nums">{fmt(k.total_ventes_unites)}</p>
                </div>
              </div>

              {/* Column 2: Marge % */}
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase">Marge X en %</p>
                  <p className="text-base font-bold tabular-nums">{k.marge_pct_avg != null ? `${k.marge_pct_avg.toFixed(1)}%` : "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase">Marge X plus faible %</p>
                  <p className="text-sm font-semibold tabular-nums text-red-600">{k.marge_pct_min ? `${k.marge_pct_min.value.toFixed(1)}%` : "—"}</p>
                  {k.marge_pct_min && <p className="text-[9px] text-muted-foreground truncate">{k.marge_pct_min.label}</p>}
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase">Marge X plus forte %</p>
                  <p className="text-sm font-semibold tabular-nums text-green-600">{k.marge_pct_max ? `${k.marge_pct_max.value.toFixed(1)}%` : "—"}</p>
                  {k.marge_pct_max && <p className="text-[9px] text-muted-foreground truncate">{k.marge_pct_max.label}</p>}
                </div>
              </div>

              {/* Column 3: Marge DH */}
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase">Marge X en MAD</p>
                  <p className="text-base font-bold tabular-nums">{k.marge_dh_avg != null ? `${fmt(k.marge_dh_avg)} MAD` : "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase">Marge X plus faible en MAD</p>
                  <p className="text-sm font-semibold tabular-nums text-red-600">{k.marge_dh_min ? `${fmt(k.marge_dh_min.value)} MAD` : "—"}</p>
                  {k.marge_dh_min && <p className="text-[9px] text-muted-foreground truncate">{k.marge_dh_min.label}</p>}
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase">Marge X plus forte MAD</p>
                  <p className="text-sm font-semibold tabular-nums text-green-600">{k.marge_dh_max ? `${fmt(k.marge_dh_max.value)} MAD` : "—"}</p>
                  {k.marge_dh_max && <p className="text-[9px] text-muted-foreground truncate">{k.marge_dh_max.label}</p>}
                </div>
              </div>

              {/* Column 4: Optimisation gauge */}
              <div className="flex items-center">
                <OptimisationGauge gain={k.difference_gain_dh} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Sub-KPIs ── */}
      {k && !margeLoading && (
        <div className="grid grid-cols-4 gap-2">
          <Card className="border border-border bg-muted/30">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground font-medium uppercase">Unités total vendues</p>
              <p className="text-sm font-semibold tabular-nums">{fmt(k.total_ventes_unites)}</p>
            </CardContent>
          </Card>
          <Card className="border border-border bg-muted/30">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground font-medium uppercase">Unités total disponibles</p>
              <p className="text-sm font-semibold tabular-nums">{fmt(k.total_units_available)}</p>
            </CardContent>
          </Card>
          <Card className="border border-border bg-muted/30">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground font-medium uppercase">Prix unitaires total achetées</p>
              <p className="text-sm font-semibold tabular-nums">{fmt(k.total_pu_purchased)} MAD</p>
            </CardContent>
          </Card>
          <Card className="border border-border bg-muted/30">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground font-medium uppercase">PPV total disponibles</p>
              <p className="text-sm font-semibold tabular-nums">{fmt(k.ppv_total_available)} MAD</p>
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

      {/* ── Selection KPI summary ── */}
      {kpis.count > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{kpis.count} sélectionné{kpis.count > 1 ? "s" : ""} sur {allRows.length}</span>
          <span>CA: <strong className="text-foreground">{fmt(kpis.ca)} MAD</strong></span>
          <span>Qté: <strong className="text-foreground">{kpis.qty.toFixed(0)}</strong></span>
          {kpis.margePctAvg != null && <span>Marge: <strong className="text-foreground">{kpis.margePctAvg.toFixed(1)}%</strong></span>}
        </div>
      )}

      {/* ── Data table ── */}
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
