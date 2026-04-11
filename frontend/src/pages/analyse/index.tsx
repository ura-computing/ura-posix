import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, BarChart3, UploadCloud } from "lucide-react";

import { ListView } from "@/components/shared/listView";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/datePicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchAutocomplete } from "@/components/searchAutocomplete";
import * as transactionsApi from "@/api/transactions";
import * as statsApi from "@/api/stats";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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

  // Liste mode: store imported product names, re-query when filters change
  const [listeProducts, setListeProducts] = useState<string[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleListeFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) return;
      const sep = lines[0].includes(";") ? ";" : ",";
      const headers = lines[0].split(sep).map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
      const prodIdx = headers.findIndex((h) => h.includes("produit") || h === "product");
      if (prodIdx === -1) { alert("Colonne 'Produit' introuvable dans le CSV"); return; }
      const products = lines.slice(1)
        .map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, "")))
        .map((cols) => cols[prodIdx])
        .filter((p) => p && p.length > 0);
      setListeProducts(products);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  const isListeMode = margeMode === "bl";
  const { data: listeData, isLoading: listeLoading } = useQuery({
    queryKey: ["analyse-liste", listeProducts, dateFrom, dateTo, categoryType],
    queryFn: () => statsApi.analyseListe(listeProducts!, dateFrom || undefined, dateTo || undefined, categoryType),
    enabled: isListeMode && !!listeProducts && listeProducts.length > 0,
  });

  const effectiveData = isListeMode ? (listeData ?? null) : margeData;
  const effectiveLoading = isListeMode ? listeLoading : margeLoading;
  const effectiveRows = (effectiveData?.rows ?? []) as Record<string, unknown>[];

  const globalK = effectiveData?.kpis;
  const hasSelection = kpis.count > 0;
  // When products are selected, show selection-based KPIs; otherwise global
  const k = hasSelection ? {
    total_ventes_dh: kpis.ca,
    total_ventes_unites: kpis.qty,
    marge_pct_avg: kpis.margePctAvg,
    marge_pct_min: kpis.margePctMin,
    marge_pct_max: kpis.margePctMax,
    marge_dh_avg: kpis.margeDhAvg,
    marge_dh_min: kpis.margeDhMin,
    marge_dh_max: kpis.margeDhMax,
    difference_gain_dh: globalK?.difference_gain_dh ?? null,
    total_units_available: kpis.unitsAvailable,
    total_pu_purchased: kpis.totalPuPurchased,
    ppv_total_available: kpis.ppvTotalAvailable,
  } : globalK;

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
                <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="Début" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Au</Label>
                <DatePicker value={dateTo} onChange={setDateTo} placeholder="Fin" />
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

      {/* ── Search + actions bar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <SearchAutocomplete
            value={search}
            onChange={setSearch}
            fetchSuggestions={transactionsApi.venteSuggestions}
            placeholder="Rechercher un produit, catégorie, fournisseur..."
            groupLabels={{ products: "Produit", clients: "Client", refs: "N° Transaction" }}
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

      {/* ── Selection KPI summary ── */}
      {kpis.count > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{kpis.count} sélectionné{kpis.count > 1 ? "s" : ""} sur {allRows.length}</span>
          <span>CA: <strong className="text-foreground">{fmt(kpis.ca)} MAD</strong></span>
          <span>Qté: <strong className="text-foreground">{kpis.qty.toFixed(0)}</strong></span>
          {kpis.margePctAvg != null && <span>Marge: <strong className="text-foreground">{kpis.margePctAvg.toFixed(1)}%</strong></span>}
        </div>
      )}

      {/* ── Data table / Liste mode ── */}
      {isListeMode ? (
        <>
          <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleListeFile} />
          {!listeData && !listeLoading && (
            <div
              className="flex flex-col items-center gap-4 py-16 text-center border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="h-12 w-12 text-muted-foreground/40" />
              <div>
                <p className="text-base font-semibold">Importer un fichier CSV</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Importez un catalogue produit (PID, Produit, Catégorie, TVA...) pour le comparer avec vos données.
                </p>
              </div>
              <Button size="sm" className="gap-2" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <UploadCloud className="h-4 w-4" />
                Choisir un fichier
              </Button>
            </div>
          )}
          {listeLoading && <Skeleton className="h-64 w-full" />}
          {listeData && !listeLoading && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {effectiveRows.length} produit{effectiveRows.length > 1 ? "s" : ""} analysé{effectiveRows.length > 1 ? "s" : ""}
                  {" — "}
                  <span className="text-green-600 font-medium">{effectiveRows.filter((r) => r.match_status === "found").length} trouvés</span>
                  {" / "}
                  <span className="text-red-600 font-medium">{effectiveRows.filter((r) => r.match_status === "not_found").length} non trouvés</span>
                </p>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setListeProducts(null); }}>
                  Nouvelle analyse
                </Button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase">Statut</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase">Produit</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-muted-foreground uppercase">Stock dispo</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-muted-foreground uppercase">Ventes</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-muted-foreground uppercase">PPV</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-muted-foreground uppercase">PU moy.</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-muted-foreground uppercase">Marge %</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-muted-foreground uppercase">Marge DH</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase">Catégorie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...effectiveRows].sort((a, b) => {
                      const aFound = a.match_status === "found" ? 1 : 0;
                      const bFound = b.match_status === "found" ? 1 : 0;
                      return aFound - bFound;
                    }).map((row, i) => {
                      const found = row.match_status === "found";
                      return (
                        <tr key={i} className={cn("border-b border-border last:border-0", found ? "hover:bg-muted/30" : "bg-red-50/50")}>
                          <td className="px-3 py-2">
                            <Badge variant={found ? "default" : "destructive"} className="text-[10px]">
                              {found ? "Trouvé" : "Non trouvé"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 font-medium whitespace-nowrap">{String(row.product ?? "")}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.stock_dispo != null ? String(row.stock_dispo) : "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{Number(row.qty) ? fmt(Number(row.qty)) : "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.ppv != null ? fmt(Number(row.ppv)) : "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.pu != null ? fmt(Number(row.pu)) : "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.marge_pct != null ? `${Number(row.marge_pct).toFixed(1)}%` : "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.marge_dh != null ? fmt(Number(row.marge_dh)) : "—"}</td>
                          <td className="px-3 py-2 text-xs">{row.category ? String(row.category) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      ) : effectiveLoading ? (
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
