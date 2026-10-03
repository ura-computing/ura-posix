/** /analyses — Analyse de marge with 8 modes + Liste CSV upload.
 *
 *  Mode picker: TabBar (scrolls sideways on narrow screens).
 *  Filter bar: date range + category segment + search + Exporter Excel, plus an
 *  "Importer une liste" action in Liste mode (right of Export).
 *  KPI strip: 4 KpiTile (CA / Marge % / Marge DH / Optimisation gauge).
 *  Body: per-mode table (Liste mode: slim import status line, then the table).
 */
import { useRef, useState } from "react";
import {
  Download,
  Upload,
  BarChart3,
  Boxes,
  Coins,
  Percent,
  ShoppingCart,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { useCategoryTypeOptions } from "@/_components/CategorySegment";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { FilterBar, type ActiveFilter, type RightAction } from "@/_components/filterBar";
import { MARGE_MODES } from "@/types";
import type {
  AnalyseFilters,
  MargeMode,
  AnalyseMargeKpis,
  AnalyseMargeRow,
  ListeItem,
} from "@/types";

import { useAnalysePage } from "./hooks";
import { KpiTile } from "@/_components/KpiTile";
import { TabBar } from "@/_components/TabBar";
import { NeedleGauge } from "@/_components/NeedleGauge";
import { Skeleton } from "@/_components/Skeleton";
import { formatMAD, formatPct, formatQty } from "@/utils/format";
import { DataTable, type ColumnDef, type DataTablePagination } from "@/_components/DataTable";
import { useMonthsShort } from "@/i18n/dates";
import { MARGE_COLS } from "./constants";

/** 8 KPI tiles for /analyse (old-app parity):
 *  Row 1 — CA, Marge moyenne %, Marge moyenne DH, Optimisation.
 *  Row 2 — Unités vendues, Unités disponibles, Prix unitaires achetés, PPV disponibles.
 *  Reuses shared KpiTile + NeedleGauge primitives. */

function AnalyseKpis({ kpis, isLoading }: { kpis?: AnalyseMargeKpis; isLoading?: boolean }) {
  const t = useT();
  if (isLoading && !kpis) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
    );
  }
  const ca       = kpis?.total_ventes_dh ?? 0;
  const unites   = kpis?.total_ventes_unites ?? 0;
  const margePct = kpis?.marge_pct_avg;
  const margeDh  = kpis?.marge_dh_avg;
  const gain     = kpis?.difference_gain_dh ?? 0;

  // Gauge 0-100 — clamp `difference_gain_dh` against an arbitrary scale (10k MAD).
  // The gauge is a relative signal: bigger gain → higher needle.
  const gaugeValue = Math.max(0, Math.min(100, Math.round((gain / 10_000) * 100)));

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        label={t("kpi.ca")}
        value={formatMAD(ca)}
        sub={<>{formatQty(unites)} {t("kpi.unites")}</>}
        icon={<Coins className="size-5" />}
        iconTone="primary"
      />
      <KpiTile
        label={t("kpi.margeMoyPct")}
        value={margePct != null ? formatPct(margePct) : "—"}
        sub={
          kpis?.marge_pct_max && kpis?.marge_pct_min ? (
            <>{t("kpi.max")} {formatPct(kpis.marge_pct_max.value)} · {t("kpi.min")} {formatPct(kpis.marge_pct_min.value)}</>
          ) : undefined
        }
        icon={<Percent className="size-5" />}
        iconTone="info"
      />
      <KpiTile
        label={t("kpi.margeMoyDh")}
        value={margeDh != null ? formatMAD(margeDh) : "—"}
        sub={
          kpis?.marge_dh_max && kpis?.marge_dh_min ? (
            <>{t("kpi.max")} {formatMAD(kpis.marge_dh_max.value)} · {t("kpi.min")} {formatMAD(kpis.marge_dh_min.value)}</>
          ) : undefined
        }
        icon={<TrendingUp className="size-5" />}
        iconTone="success"
      />
      <KpiTile
        label={t("kpi.optimisation")}
        value={kpis?.difference_gain_dh != null ? formatMAD(kpis.difference_gain_dh) : "—"}
        sub={t("kpi.optimisationSub")}
        icon={<Sparkles className="size-5" />}
        iconTone="warning"
      >
        <div className="mt-1 flex justify-center">
          <NeedleGauge value={gaugeValue} />
        </div>
      </KpiTile>

      {/* Row 2 — sub-KPIs (old-app parity). The stock/achat fields are only
          populated in produit + liste modes (pu also grossiste/laboratoire);
          elsewhere the backend sends null → "—". */}
      <KpiTile
        label={t("kpi.unitesVendues")}
        value={formatQty(unites)}
        sub={t("kpi.sumQtyVendues")}
        icon={<ShoppingCart className="size-5" />}
        iconTone="primary"
      />
      <KpiTile
        label={t("kpi.unitesDispo")}
        value={kpis?.total_units_available != null ? formatQty(kpis.total_units_available) : "—"}
        sub={t("kpi.sumStock")}
        icon={<Boxes className="size-5" />}
        iconTone="success"
      />
      <KpiTile
        label={t("kpi.prixUnitAchetes")}
        value={kpis?.total_pu_purchased != null ? formatMAD(kpis.total_pu_purchased) : "—"}
        sub={t("kpi.sumPuQty")}
        icon={<Coins className="size-5" />}
        iconTone="warning"
      />
      <KpiTile
        label={t("kpi.ppvDispo")}
        value={kpis?.ppv_total_available != null ? formatMAD(kpis.ppv_total_available) : "—"}
        sub={t("kpi.sumPpvStock")}
        icon={<BarChart3 className="size-5" />}
        iconTone="info"
      />
    </div>
  );
}

/** Per-mode table for /analyse. Wraps the shared DataTable primitive; column
 *  defs come from MARGE_COLS[mode]. Pagination state lives in useAnalysePage. */

interface AnalyseTableProps {
  mode:        MargeMode;
  rows:        AnalyseMargeRow[];
  loading:     boolean;
  pagination:  DataTablePagination;
  sortBy:      string | null;
  sortOrder:   "asc" | "desc";
  onSort:      (key: string) => void;
}

const MONTH_IDX: Record<string, number> = {
  m01: 0, m02: 1, m03: 2, m04: 3, m05: 4, m06: 5, m07: 6, m08: 7, m09: 8, m10: 9, m11: 10, m12: 11,
};

function AnalyseTable({ mode, rows, loading, pagination, sortBy, sortOrder, onSort }: AnalyseTableProps) {
  const t = useT();
  const monthsShort = useMonthsShort();

  // Map MARGE_COLS entries into ColumnDef. Labels are translation keys → t().
  // The Année-pivot month columns take their localized short name; the Liste
  // "Statut" cell translates found / not_found.
  const columns: ColumnDef<AnalyseMargeRow>[] = MARGE_COLS[mode].map((c) => ({
    key:      c.key,
    label:    c.key in MONTH_IDX ? monthsShort[MONTH_IDX[c.key]] : t(c.label),
    align:    c.align,
    sortable: !!c.raw,
    width:    c.width ? parseInt(c.width, 10) : undefined,
    render:   c.key === "match_status"
      ? (r: AnalyseMargeRow) => (
          r.match_status === "found"
            ? <span className="rounded-full bg-success-subtle px-2 py-0.5 text-xs font-semibold text-success">{t("analyse.trouve")}</span>
            : <span className="rounded-full bg-error-subtle px-2 py-0.5 text-xs font-semibold text-error">{t("analyse.introuvable")}</span>
        )
      : c.render,
  }));

  return (
    <DataTable<AnalyseMargeRow>
      rows={rows}
      columns={columns}
      isLoading={loading}
      pagination={pagination}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSort={onSort}
      emptyTitle={t("common.noResult")}
      emptyHint={t("analyse.tableEmptyHint")}
    />
  );
}

/** CSV parser for /analyses → Liste mode. Detects the delimiter (`;` or `,`),
 *  reads the header, and maps the Produit / PID / Code-barre columns to
 *  ListeItem. Strips a UTF-8 BOM (real ﻿ or mojibake "ï»¿") that Sobrus glues
 *  to the first header — otherwise the PID column is never detected. */

function detectColumn(headers: string[], aliases: string[]): number {
  const norm = (s: string) =>
    s.replace(/﻿|ï»¿/g, "").toLowerCase().replace(/[\s_-]/g, "");
  const normalizedHeaders = headers.map(norm);
  for (const a of aliases) {
    const idx = normalizedHeaders.indexOf(norm(a));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseCsv(text: string): ListeItem[] {
  // Drop a leading real BOM so it can't leak into the first data cell either.
  text = text.replace(/^﻿/, "");
  // Detect delimiter from the first line (`;` wins over `,`).
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = lines[0].split(delim).map((s) => s.trim().replace(/^"|"$/g, ""));
  const nameIdx     = detectColumn(headers, ["produit", "product", "designation", "désignation"]);
  const pidIdx      = detectColumn(headers, ["pid", "id", "code"]);
  const barcode1Idx = detectColumn(headers, ["codebarre1", "barcode1", "ean", "codebarre"]);
  const barcode2Idx = detectColumn(headers, ["codebarre2", "barcode2"]);

  // If no "Produit" column detected, fall back to first column.
  const effectiveNameIdx = nameIdx >= 0 ? nameIdx : 0;

  const items: ListeItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delim).map((s) => s.trim().replace(/^"|"$/g, ""));
    const name  = cells[effectiveNameIdx] || "";
    if (!name) continue;
    items.push({
      name,
      pid:      pidIdx      >= 0 ? cells[pidIdx]      || undefined : undefined,
      barcode1: barcode1Idx >= 0 ? cells[barcode1Idx] || undefined : undefined,
      barcode2: barcode2Idx >= 0 ? cells[barcode2Idx] || undefined : undefined,
    });
  }
  return items;
}

const CATEGORY_KEY: Record<string, string> = {
  all: "category.mixte", pharmacie: "category.pharmacie", parapharmacie: "category.parapharmacie",
};


function buildActiveFilters(
  filters: AnalyseFilters,
  setFilters: (f: AnalyseFilters) => void,
  t: TFn,
): ActiveFilter[] {
  return [
    (filters.date_from || filters.date_to) && {
      key: "dates",
      label: <>{t("dashboard.periode")} {filters.date_from ?? "…"} → {filters.date_to ?? "…"}</>,
      onClear: () => setFilters({ ...filters, date_from: null, date_to: null }),
    },
    filters.category_type !== "all" && {
      key: "category",
      label: <>{t("dashboard.categorieFilter")} {t(CATEGORY_KEY[filters.category_type])}</>,
      onClear: () => setFilters({ ...filters, category_type: "all" }),
    },
  ].filter(Boolean) as ActiveFilter[];
}


export default function AnalysePage() {
  const t = useT();
  const {
    clearAll,
    error,
    filters,
    handleExport,
    isLoading,
    kpis,
    listeSubmitted,
    mode,
    pagination,
    rows,
    search,
    setFilters,
    setMode,
    setSearch,
    sortBy,
    sortOrder,
    submitListe,
    suggestions,
    toggleSort,
  } = useAnalysePage();
  const categoryTypeOptions = useCategoryTypeOptions();
  const MODE_TABS = MARGE_MODES.map((id) => ({ id, label: t(`mode.${id}`) }));

  // Liste import moved into the FilterBar (right of "Exporter Excel"). The hidden
  // file input + a slim status line replace the old upload card.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [listeFile,  setListeFile]  = useState<string | null>(null);
  const [listeCount, setListeCount] = useState<number>(0);
  const [listeError, setListeError] = useState<string | null>(null);

  function handleListeFile(file: File) {
    setListeError(null);
    setListeFile(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const items = parseCsv(String(reader.result ?? ""));
        if (items.length === 0) {
          setListeCount(0);
          setListeError(t("analyse.noProductDetected"));
          return;
        }
        setListeCount(items.length);
        submitListe(items);
      } catch {
        setListeCount(0);
        setListeError(t("analyse.csvReadError"));
      }
    };
    reader.onerror = () => setListeError(t("analyse.fileReadError"));
    reader.readAsText(file);
  }

  const rightActions: RightAction[] = [
    {
      label:    t("common.export"),
      icon:     <Download className="size-4" />,
      variant:  "outline",
      onClick:  handleExport,
      disabled: rows.length === 0,
    },
    // Import lives here only in Liste mode — to the right of Exporter Excel.
    ...(mode === "liste" ? [{
      label:    isLoading ? t("analyse.analyseLoading") : t("analyse.importListe"),
      icon:     <Upload className="size-4" />,
      variant:  "primary" as const,
      onClick:  () => fileInputRef.current?.click(),
      disabled: isLoading,
    }] : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("analyse.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("analyse.subtitle")}
        </p>
      </header>

      <FilterBar<string>
        dateRange={{
          from:     filters.date_from,
          to:       filters.date_to,
          onChange: (from, to) => setFilters({ ...filters, date_from: from, date_to: to }),
        }}
        segment={{
          value:    filters.category_type,
          onChange: (v) => setFilters({ ...filters, category_type: v }),
          options:  categoryTypeOptions,
        }}
        search={{
          value:       search,
          onChange:    setSearch,
          placeholder: t("analyse.searchPh"),
          suggestions: suggestions,
          onPick:      (label) => setSearch(label),
        }}
        rightActions={rightActions}
        activeFilters={buildActiveFilters(filters, setFilters, t)}
        onResetAll={clearAll}
      />

      {/* Liste mode: hidden file input (triggered by the top-bar "Importer"
          button) + a slim status line — replaces the old upload card. */}
      {mode === "liste" && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleListeFile(f);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          <p className="text-sm text-muted-foreground">
            {listeError ? (
              <span className="font-semibold text-error">{listeError}</span>
            ) : listeFile ? (
              <>
                <span className="font-medium text-foreground">{listeFile}</span>
                {listeCount > 0 && <> · {listeCount} {t("stock.produitsWord")}</>}
              </>
            ) : (
              t("analyse.listeHint")
            )}
          </p>
        </>
      )}

      <TabBar<MargeMode> tabs={MODE_TABS} activeId={mode} onChange={setMode} />

      <AnalyseKpis kpis={kpis} isLoading={isLoading} />

      {/* Table: shows for all 8 modes (Liste shows it once items are submitted). */}
      {(mode !== "liste" || listeSubmitted) && (
        <AnalyseTable
          mode={mode}
          rows={rows}
          loading={isLoading}
          pagination={pagination}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={toggleSort}
        />
      )}

      {error && (
        <div className="rounded-md border border-error/40 bg-error-subtle px-4 py-3 text-sm text-error">
          {/* Surface the API detail when available — a bare "réessayez" hid real causes (e.g. 422). */}
          {t("analyse.loadError")}{" "}
          {error instanceof Error && error.message
            ? error.message
            : t("analyse.retryLater")}
        </div>
      )}
    </div>
  );
}
