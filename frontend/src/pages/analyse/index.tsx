import { useState, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Boxes, Coins, Download, BarChart3, Percent, ShoppingCart, TrendingDown, TrendingUp, UploadCloud, Wallet } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { ListView } from "@/components/shared/listView";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { PageFilter } from "@/components/pageFilter";
import { Button } from "@/components/ui/button";
import * as statsApi from "@/api/stats";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/cn";
import { fmt, fmtInt } from "@/utils/format";
import { OptimisationGauge } from "@/components/optimisationGauge";
import { cleanHeader, fixMojibake } from "@/utils/encoding";
import { useAnalysePage } from "@/hooks/useAnalysePage";
import { AnalyseMargeTable, type MargeMode } from "@/pages/rapports/margeTable";

// PG-017 — order pharmacists actually work in: product-side analyses first
// (Produit, Catégorie), then supplier-side (Laboratoire, Grossistes), then
// Client, then time (Mois, Année), then the special Liste mode.
const MODE_LABELS = {
  produit: "Produit",
  categorie: "Catégorie",
  laboratoire: "Laboratoire",
  grossiste: "Grossistes",
  operateur: "Client",
  mois: "Mois",
  annee: "Année (pivot)",
  bl: "Liste",
} as const;

const MODE_SEARCH_KEY: Record<MargeMode, string> = {
  produit: "product",
  categorie: "category",
  grossiste: "grossiste",
  laboratoire: "laboratoire",
  operateur: "client",
  mois: "mois",
  annee: "annee",
  bl: "delivery_ref",
};

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
    exportXlsx,
  } = useAnalysePage();

  // Liste mode: store imported product names, re-query when filters change
  const [listeProducts, setListeProducts] = useState<statsApi.ListeItem[] | null>(null);
  // PG-014: per-column sort for the Liste mode table (hand-rolled — separate from
  // the DataTable-driven margeTable). Null means default ordering (not_found first).
  const [listeSort, setListeSort] = useState<{ key: string; order: "asc" | "desc" } | null>(null);
  const toggleListeSort = useCallback((key: string) => {
    setListeSort((prev) => {
      if (prev?.key === key) {
        return { key, order: prev.order === "asc" ? "desc" : "asc" };
      }
      return { key, order: "asc" };
    });
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mode-aware search suggestions: pull distinct values from currently-loaded rows
  // based on the selected mode's primary column.
  const suggest = useCallback(async (q: string) => {
    const key = MODE_SEARCH_KEY[margeMode];
    const needle = q.toLowerCase();
    const vals = Array.from(
      new Set(allRows.map((r) => String(r[key] ?? "")).filter(Boolean)),
    )
      .filter((v) => v.toLowerCase().includes(needle))
      .slice(0, 10);
    return { results: vals };
  }, [allRows, margeMode]);

  const handleListeFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Sobrus exports are often windows-1252 — try UTF-8 first, fall back.
      const buf = await file.arrayBuffer();
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
      } catch {
        text = new TextDecoder("windows-1252").decode(buf);
      }
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) return;
      const sep = lines[0].includes(";") ? ";" : ",";
      // Headers: clean mojibake + apply alias (Caégorie → Catégorie), then lowercase for matching.
      const headers = lines[0].split(sep).map((h) => cleanHeader(h).toLowerCase());
      const prodIdx = headers.findIndex((h) => h.includes("produit") || h === "product");
      if (prodIdx === -1) { alert("Colonne 'Produit' introuvable dans le CSV"); return; }
      const pidIdx = headers.findIndex((h) => h === "pid" || h.includes("pid"));
      // Locate optional barcode columns. Tolerant to "Code barre 1", "code-barre-1", "code_barre1", etc.
      const findBcIdx = (suffix: "1" | "2") =>
        headers.findIndex((h) => /code[\s\-_]?barre[\s\-_]?/i.test(h) && h.includes(suffix));
      const bc1Idx = findBcIdx("1");
      const bc2Idx = findBcIdx("2");

      // Keep only digit-like strings of length >= 8 — discard "8,47E+12" Excel garbage
      const sanitizeBarcode = (s: string | undefined): string | undefined => {
        if (!s) return undefined;
        const cleaned = s.replace(/[^\d]/g, "");
        return cleaned.length >= 8 ? cleaned : undefined;
      };

      const items = lines.slice(1)
        .map((l) => l.split(sep).map((c) => fixMojibake(c.trim().replace(/^"|"$/g, ""))))
        .map((cols) => ({
          name: cols[prodIdx] ?? "",
          pid: pidIdx >= 0 ? (cols[pidIdx] || undefined) : undefined,
          barcode1: bc1Idx >= 0 ? sanitizeBarcode(cols[bc1Idx]) : undefined,
          barcode2: bc2Idx >= 0 ? sanitizeBarcode(cols[bc2Idx]) : undefined,
        }))
        .filter((it) => it.name.length > 0 || it.barcode1 || it.barcode2 || it.pid);
      setListeProducts(items);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  const isListeMode = margeMode === "bl";
  const listeKey = useMemo(
    () => listeProducts ? listeProducts.map((it) => `${it.name}|${it.pid ?? ""}|${it.barcode1 ?? ""}|${it.barcode2 ?? ""}`).join(";") : "",
    [listeProducts],
  );
  const { data: listeData, isLoading: listeLoading } = useQuery({
    queryKey: ["analyse-liste", listeKey, dateFrom, dateTo, categoryType],
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

      <PageFilter
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        categoryType={categoryType}
        onCategoryTypeChange={setCategoryType}
        search={{
          query: search,
          onChange: setSearch,
          placeholder: `Rechercher ${MODE_LABELS[margeMode]}...`,
          fetchSuggestions: suggest,
          suggestionGroupLabels: { results: MODE_LABELS[margeMode] },
        }}
        rightSlot={
          <>
            <Button size="sm" variant="outline" className="h-9 text-xs" onClick={toggleAll}>
              {selected.size === allRows.length && allRows.length > 0 ? "Tout désélectionner" : "Tout sélectionner"}
            </Button>
            {kpis.count > 0 && (
              <Button size="sm" variant="outline" className="h-9 text-xs gap-1.5" onClick={exportXlsx}>
                <Download className="h-3.5 w-3.5" />
                Exporter Excel ({kpis.count})
              </Button>
            )}
            <button
              type="button"
              onClick={() => { setMargeMode("bl"); setTimeout(() => fileInputRef.current?.click(), 0); }}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              Importer une liste
            </button>
          </>
        }
      />

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

      {/* ── KPI Section ── */}
      {k && !margeLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Chiffre d'affaires */}
          <Card className="border border-border">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Chiffre d'affaires</p>
                  <p className="text-3xl font-bold mt-1 leading-tight tabular-nums">{fmt(k.total_ventes_dh)} MAD</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmtInt(k.total_ventes_unites)} unités vendues</p>
                  {/* <p className="text-[10px] opacity-50 mt-1 font-mono">PPV × qté vendue</p> */}
                </div>
                <Wallet className="h-8 w-8 opacity-60 shrink-0 text-primary" />
              </div>
            </CardContent>
          </Card>

          {/* Marge moyenne % */}
          <Card className="border border-border">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Marge moyenne</p>
                  <p className="text-3xl font-bold mt-1 leading-tight tabular-nums">{k.marge_pct_avg != null ? `${k.marge_pct_avg.toFixed(1)}%` : "—"}</p>
                  {/* <p className="text-[10px] opacity-50 font-mono">moyenne pondérée (1 − PU÷PPV)</p> */}
                  <div className="mt-2 space-y-0.5 text-[11px]">
                    {k.marge_pct_min && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="flex items-center gap-1 text-red-600 truncate cursor-default">
                            <TrendingDown className="h-3 w-3 shrink-0" />
                            <span className="font-semibold">{k.marge_pct_min.value.toFixed(1)}%</span>
                            <span className="text-muted-foreground truncate">· {k.marge_pct_min.label}</span>
                          </p>
                        </TooltipTrigger>
                        <TooltipContent>{k.marge_pct_min.label}</TooltipContent>
                      </Tooltip>
                    )}
                    {k.marge_pct_max && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="flex items-center gap-1 text-green-600 truncate cursor-default">
                            <TrendingUp className="h-3 w-3 shrink-0" />
                            <span className="font-semibold">{k.marge_pct_max.value.toFixed(1)}%</span>
                            <span className="text-muted-foreground truncate">· {k.marge_pct_max.label}</span>
                          </p>
                        </TooltipTrigger>
                        <TooltipContent>{k.marge_pct_max.label}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
                <Percent className="h-8 w-8 opacity-60 shrink-0 text-primary" />
              </div>
            </CardContent>
          </Card>

          {/* Marge moyenne DH */}
          <Card className="border border-border">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Marge moyenne (DH)</p>
                  <p className="text-3xl font-bold mt-1 leading-tight tabular-nums">{k.marge_dh_avg != null ? `${fmt(k.marge_dh_avg)} DH` : "—"}</p>
                  <div className="mt-2 space-y-0.5 text-[11px]">
                    {k.marge_dh_min && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="flex items-center gap-1 text-red-600 truncate cursor-default">
                            <TrendingDown className="h-3 w-3 shrink-0" />
                            <span className="font-semibold">{fmt(k.marge_dh_min.value)} DH</span>
                            <span className="text-muted-foreground truncate">· {k.marge_dh_min.label}</span>
                          </p>
                        </TooltipTrigger>
                        <TooltipContent>{k.marge_dh_min.label}</TooltipContent>
                      </Tooltip>
                    )}
                    {k.marge_dh_max && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="flex items-center gap-1 text-green-600 truncate cursor-default">
                            <TrendingUp className="h-3 w-3 shrink-0" />
                            <span className="font-semibold">{fmt(k.marge_dh_max.value)} DH</span>
                            <span className="text-muted-foreground truncate">· {k.marge_dh_max.label}</span>
                          </p>
                        </TooltipTrigger>
                        <TooltipContent>{k.marge_dh_max.label}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
                <Coins className="h-8 w-8 opacity-60 shrink-0 text-primary" />
              </div>
            </CardContent>
          </Card>

          {/* Optimisation gauge */}
          <Card className="border border-border">
            <CardContent className="p-6 flex items-center justify-center">
              <OptimisationGauge gain={k.difference_gain_dh} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Sub-KPIs ── */}
      {k && !margeLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Unités vendues</p>
                  <p className="text-xl font-bold mt-1 tabular-nums">{fmtInt(k.total_ventes_unites)}</p>
                  {/* <p className="text-[10px] opacity-50 mt-1 font-mono">Σ qté vendue</p> */}
                </div>
                <ShoppingCart className="h-6 w-6 opacity-60 shrink-0 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Unités disponibles</p>
                  <p className="text-xl font-bold mt-1 tabular-nums">{fmtInt(k.total_units_available)}</p>
                  {/* <p className="text-[10px] opacity-50 mt-1 font-mono">Σ stock actuel</p> */}
                </div>
                <Boxes className="h-6 w-6 opacity-60 shrink-0 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Prix unitaires achetés</p>
                  <p className="text-xl font-bold mt-1 tabular-nums">{fmt(k.total_pu_purchased)} MAD</p>
                  {/* <p className="text-[10px] opacity-50 mt-1 font-mono">Σ PU × qté achetée</p> */}
                </div>
                <Coins className="h-6 w-6 opacity-60 shrink-0 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">PPV disponibles</p>
                  <p className="text-xl font-bold mt-1 tabular-nums">{fmt(k.ppv_total_available)} MAD</p>
                  {/* <p className="text-[10px] opacity-50 mt-1 font-mono">Σ PPV × stock</p> */}
                </div>
                <BarChart3 className="h-6 w-6 opacity-60 shrink-0 text-muted-foreground" />
              </div>
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
                      {([
                        { key: "match_status", label: "Statut",      align: "left"  },
                        { key: "product",      label: "Produit",     align: "left"  },
                        { key: "stock_dispo",  label: "Stock dispo", align: "right" },
                        { key: "qty",          label: "Ventes",      align: "right" },
                        { key: "ppv",          label: "PPV",         align: "right" },
                        { key: "pu",           label: "PU moy.",     align: "right" },
                        { key: "marge_pct",    label: "Marge %",     align: "right" },
                        { key: "marge_dh",     label: "Marge DH",    align: "right" },
                        { key: "category",     label: "Catégorie",   align: "left"  },
                      ] as const).map((col) => {
                        const active = listeSort?.key === col.key;
                        const arrow = active ? (listeSort?.order === "asc" ? "↑" : "↓") : "";
                        return (
                          <th
                            key={col.key}
                            onClick={() => toggleListeSort(col.key)}
                            className={cn(
                              "px-3 py-2.5 text-[11px] font-semibold uppercase select-none cursor-pointer hover:text-foreground",
                              active ? "text-foreground" : "text-muted-foreground",
                              col.align === "right" ? "text-right" : "text-left",
                            )}
                          >
                            <span className={cn(
                              "inline-flex items-center gap-1",
                              col.align === "right" && "justify-end w-full",
                            )}>
                              {col.label}
                              {arrow && <span className="text-[10px] opacity-70">{arrow}</span>}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {[...effectiveRows].sort((a, b) => {
                      if (listeSort) {
                        const va = a[listeSort.key as keyof typeof a];
                        const vb = b[listeSort.key as keyof typeof b];
                        // Nulls always last regardless of order.
                        if (va == null && vb == null) return 0;
                        if (va == null) return 1;
                        if (vb == null) return -1;
                        const cmp = typeof va === "number" && typeof vb === "number"
                          ? va - vb
                          : String(va).localeCompare(String(vb), "fr", { numeric: true });
                        return listeSort.order === "asc" ? cmp : -cmp;
                      }
                      // Default: not-found rows first so they're visible at the top.
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
                          <td className="px-3 py-2 text-right tabular-nums">{Number(row.qty) ? fmtInt(Number(row.qty)) : "—"}</td>
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
