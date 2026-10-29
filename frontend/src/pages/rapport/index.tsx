import { useState, useLayoutEffect, useRef } from "react";
import {
  Building2,
  Sparkles,
  Banknote,
  BarChart3,
  CalendarCheck,
  CalendarX,
  Coins,
  Package,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Wallet,
  Users,
  BookOpen,
  ClipboardCheck,
  Percent,
  UploadCloud,
  ShieldCheck,
  TrendingDown,
  AlertTriangle,
  Boxes,
  ArrowDownCircle,
  FileText,
} from "lucide-react";

import { useCategoryTypeOptions } from "@/_components/CategorySegment";
import { FilterBar, type ActiveFilter } from "@/_components/filterBar";
import { SingleSelectPopover } from "@/_components/SingleSelectPopover";
import { TabBar } from "@/_components/TabBar";
import { useMe } from "@/hooks/useMe";
import { useGlobalDateRange } from "@/hooks/useGlobalDateRange";
import { ROLES, ROUTES, type MarginAlertsResponse, type TvaSummary } from "@/types";
import type {
  CategoryType,
  Feature,
  MargeMode,
  StatsFilters,
  MonthlyTrendPoint,
  StatsResponse,
  AdminStatsResponse,
  TopCategoryRow,
  AdvancedKpis,
  MargeSummary,
  StockSummaryResponse,
  TrendGranularity,
} from "@/types";

import {
  useAdminPharmacyStats,
  useAdminStats,
  useStockSummary,
  useAdminPharmacyAnalyseMarge,
  useAdminPharmacyMarginAlerts,
  useAdminPharmacyStockSummary,
  useCategoryTint,
  useOptimisationGain,
} from "./hooks";
import { useAdminPharmaciesList, useMarginAlerts, useStats } from "@/hooks/sharedQueries";

import { useT, type TFn } from "@/i18n/I18nProvider";
import { DataTable } from "@/_components/DataTable";
import type { ColumnDef } from "@/_components/DataTable";
import { KpiTile, type IconTone } from "@/_components/KpiTile";
import { NeedleGauge } from "@/_components/NeedleGauge";
import { formatDate, formatQty, formatMAD, formatPct, formatNumStr, pctChange } from "@/utils/format";
import { Link } from "react-router-dom";
import { clamp, niceScale, smoothPath } from "@/utils/chart";
import { cn } from "@/utils/cn";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Page } from "@/_components/Page";
import { Card } from "@/_components/atoms/Card";
import { SectionTitle } from "@/_components/atoms/SectionTitle";

/** Section 2f — dual-bar trend chart. Ventes (info-blue) + Achats (muted) per
 *  month. Pure CSS bars — no chart lib dep. Reused styling vocabulary
 *  ("var(--info)" / "var(--muted-foreground)") so it tracks the theme. */

function AdminMonthlyTrendChart({ data, subtitle }: { data: MonthlyTrendPoint[]; subtitle: string }) {
  const t = useT();
  const max = Math.max(1, ...data.flatMap((d) => [d.ventes, d.achats]));

  return (
    <Card as="div" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">{t("rapportAdmin.evolutionMensuelle")}</span>
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        </div>
        <div className="flex items-center gap-3.5">
          <AdminLegend color="var(--info)" label={t("trend.ventes")} />
          <AdminLegend color="var(--muted-foreground)" label={t("trend.achats")} />
        </div>
      </div>

      <div className="flex h-44 items-end gap-2 pt-2">
        {data.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
            {t("rapportAdmin.aucuneDonneeMensuelle")}
          </div>
        ) : (
          data.map((d, i) => (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <div className="flex h-full w-full items-end justify-center gap-[3px]">
                <Bar heightPct={(d.ventes / max) * 100} color="var(--info)" />
                <Bar heightPct={(d.achats / max) * 100} color="var(--muted-foreground)" muted />
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">{d.label}</span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function Bar({ heightPct, color, muted }: { heightPct: number; color: string; muted?: boolean }) {
  return (
    <div
      className="w-[42%] max-w-3.5 rounded-t-[3px] transition-[height] duration-500"
      style={{ height: `${heightPct}%`, background: color, opacity: muted ? 0.55 : 1 }}
    />
  );
}

function AdminLegend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="size-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

/** Section 2e — Analyse de marge. Tabs switch the backend `mode` query param;
 *  each mode returns a different wide-row dict shape, so the column list is
 *  selected per tab. Built on the shared DataTable. */

const buildTabs = (t: TFn): { id: MargeMode; label: string }[] => [
  { id: "produit", label: t("rapportAdmin.tabParProduit") },
  { id: "categorie", label: t("rapportAdmin.tabParCategorie") },
  { id: "grossiste", label: t("rapportAdmin.tabParGrossiste") },
];

// Per-mode column projection — extracts a subset of the wide-row dict's
// fields. Cells render via the row's positional accessor; numeric cells use
// font-mono + tabular-nums via DataTable's `align: "right"` styling.

type Row = Record<string, unknown>;

/** Wide-row cell → number, or null (shown « — »). */
const cell = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function columnsFor(mode: MargeMode, t: TFn): ColumnDef<Row>[] {
  if (mode === "produit") {
    return [
      {
        key: "product",
        label: t("col.produit"),
        sortable: false,
        render: (r) => <span className="font-semibold text-foreground">{String(r["product"] ?? "—")}</span>,
      },
      {
        key: "category",
        label: t("col.categorie"),
        sortable: false,
        render: (r) => <span className="text-muted-foreground">{String(r["category"] ?? "—")}</span>,
      },
      { key: "qty", label: t("col.qte"), sortable: false, align: "right", render: (r) => formatQty(cell(r["qty"])) },
      {
        key: "ventes",
        label: t("rapportAdmin.ventesMad"),
        sortable: false,
        align: "right",
        render: (r) => formatMAD(cell(r["ca"])),
      },
      { key: "ppv", label: t("col.ppv"), sortable: false, align: "right", render: (r) => formatMAD(cell(r["ppv"])) },
      {
        key: "marge_pct",
        label: t("col.margePct"),
        sortable: false,
        align: "right",
        render: (r) => formatPct(cell(r["marge_pct"])),
      },
      {
        key: "marge_dh",
        label: t("col.margeDh"),
        sortable: false,
        align: "right",
        render: (r) => formatMAD(cell(r["marge_dh"])),
      },
      {
        key: "tva",
        label: t("col.tva"),
        sortable: false,
        render: (r) => <span className="text-muted-foreground">{String(r["tva"] ?? "—")}</span>,
      },
    ];
  }
  if (mode === "categorie") {
    return [
      {
        key: "category",
        label: t("col.categorie"),
        sortable: false,
        render: (r) => <span className="font-semibold text-foreground">{String(r["category"] ?? "—")}</span>,
      },
      { key: "qty", label: t("col.qte"), sortable: false, align: "right", render: (r) => formatQty(cell(r["qty"])) },
      {
        key: "ventes",
        label: t("rapportAdmin.caMad"),
        sortable: false,
        align: "right",
        render: (r) => formatMAD(cell(r["ca"])),
      },
      {
        key: "marge_pct",
        label: t("rapportAdmin.margePctMoy"),
        sortable: false,
        align: "right",
        render: (r) => formatPct(cell(r["marge_pct_avg"])),
      },
      {
        key: "marge_dh",
        label: t("rapportAdmin.margeDhMoy"),
        sortable: false,
        align: "right",
        render: (r) => formatMAD(cell(r["marge_dh_avg"])),
      },
    ];
  }
  // grossiste
  return [
    {
      key: "grossiste",
      label: t("col.grossiste"),
      sortable: false,
      render: (r) => <span className="font-semibold text-foreground">{String(r["grossiste"] ?? "—")}</span>,
    },
    { key: "qty", label: t("col.qte"), sortable: false, align: "right", render: (r) => formatQty(cell(r["qty"])) },
    {
      key: "ventes",
      label: t("rapportAdmin.caMad"),
      sortable: false,
      align: "right",
      render: (r) => formatMAD(cell(r["ca"])),
    },
    {
      key: "marge_pct",
      label: t("rapportAdmin.margePctMoy"),
      sortable: false,
      align: "right",
      render: (r) => formatPct(cell(r["marge_pct_avg"])),
    },
    {
      key: "marge_dh",
      label: t("rapportAdmin.margeDhMoy"),
      sortable: false,
      align: "right",
      render: (r) => formatMAD(cell(r["marge_dh_avg"])),
    },
  ];
}

interface MarginAnalysisTableProps {
  mode: MargeMode;
  onModeChange: (mode: MargeMode) => void;
  rows: Row[];
  isLoading?: boolean;
}

function MarginAnalysisTable({ mode, onModeChange, rows, isLoading }: MarginAnalysisTableProps) {
  const t = useT();
  const columns = columnsFor(mode, t);
  const tabs = buildTabs(t);
  // Every row is loaded; show them page by page (same as /analyses). The page is kept with
  // the (tab, rows) it was picked for: another tab, pharmacy or period shows page 1 again.
  const pageFor = `${mode}|${rows.length}`;
  const [picked, setPicked] = useState({ pageFor, page: 1 });
  const page = picked.pageFor === pageFor ? picked.page : 1;
  const [pageSize, setPageSize] = useState(25);
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="flex flex-col gap-3.5">
      <h2 className="text-base font-bold tracking-tight text-foreground">{t("rapportAdmin.analyseMarge")}</h2>
      <TabBar<MargeMode> tabs={tabs} activeId={mode} onChange={onModeChange} />
      <DataTable
        rows={pageRows}
        columns={columns}
        isLoading={isLoading}
        rowKey={(_r, i) => (page - 1) * pageSize + i}
        emptyTitle={t("rapportAdmin.aucuneLigne")}
        emptyHint={t("rapportAdmin.aucuneDonneeRegroupement")}
        scrollOnPage="table"
        pagination={{
          page,
          pageSize,
          total: rows.length,
          onPage: (next) => setPicked({ pageFor, page: next }),
          onPageSize: setPageSize,
        }}
      />
    </div>
  );
}

/** Per-pharmacy body for /rapport's admin view. Replaces the older
 *  `RapportSections` (KPIs / margin-alerts / stock summary) with a denser
 *  layout: 2a Indicateurs clés · 2b Indicateurs avancés · 2c TVA · 2d Marge
 *  · 2e Analyse de marge tabs+table · 2f Évolution mensuelle bars · 2g Top
 *  catégories. Moved from the old /admin/stats page when we merged the two
 *  surfaces into /rapport. */

const TOP_CAT_COLORS = ["#0E9E8C", "#1D6FB8", "#4F56C9", "#B7791F", "#D6447B"];

interface AdminPharmacyBodyProps {
  stats: StatsResponse;
  pharmacyLabel: string;
  categoryType: "all" | "pharmacie" | "parapharmacie";
  marginMode: MargeMode;
  onMarginMode: (m: MargeMode) => void;
  marginRows: Record<string, unknown>[];
  marginLoading: boolean;
  subtitleDates: string;
  alerts?: MarginAlertsResponse;
  stock?: StockSummaryResponse;
}

function AdminPharmacyBody({
  stats,
  pharmacyLabel,
  categoryType,
  marginMode,
  onMarginMode,
  marginRows,
  marginLoading,
  subtitleDates,
  alerts,
  stock,
}: AdminPharmacyBodyProps) {
  const t = useT();
  const catLabel =
    categoryType === "pharmacie"
      ? t("category.pharmacie")
      : categoryType === "parapharmacie"
        ? t("category.parapharmacie")
        : t("category.mixte");

  // Revenue delta vs previous period (simple %; backend doesn't pre-compute it).
  const rev = stats.kpis.ventes_total;
  const prevRev = stats.previous_kpis.ventes_total;
  const revDelta = prevRev > 0 ? ((rev - prevRev) / prevRev) * 100 : 0;

  return (
    <div className="flex flex-col gap-7">
      {/* Context strip echoing the active pharmacy + category */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-accent/30 px-4 py-2.5 text-sm font-semibold text-primary">
        <Building2 className="size-4" />
        {pharmacyLabel}
        <span className="opacity-60">·</span>
        <span className="opacity-85">{catLabel}</span>
      </div>

      {/* 2a — Indicateurs clés */}
      <section className="flex flex-col gap-3.5">
        <h2 className="text-base font-bold tracking-tight text-foreground">{t("rapportAdmin.indicateursCles")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTile
            label={t("rapportAdmin.chiffreAffaires")}
            value={formatMAD(rev)}
            sub={prevRev > 0 ? t("rapportAdmin.vsPeriodePrecedente") : undefined}
            delta={prevRev > 0 ? { value: revDelta } : null}
            icon={<TrendingUp className="size-4.5" />}
            iconTone="primary"
          />
          <KpiTile
            label={t("rapportAdmin.achatsTotaux")}
            value={formatMAD(stats.kpis.achats_total)}
            icon={<ShoppingCart className="size-4.5" />}
            iconTone="slate"
          />
          <KpiTile
            label={t("rapportAdmin.transactionsVentes")}
            value={formatQty(stats.kpis.ventes_count)}
            sub={t("rapportAdmin.operationsVente")}
            icon={<BarChart3 className="size-4.5" />}
            iconTone="slate"
          />
          <KpiTile
            label={t("rapportAdmin.transactionsAchats")}
            value={formatQty(stats.kpis.achats_count)}
            sub={t("rapportAdmin.lignesAchat")}
            icon={<Package className="size-4.5" />}
            iconTone="slate"
          />
        </div>
      </section>

      {/* 2b — Indicateurs avancés */}
      <section className="flex flex-col gap-3.5">
        <h2 className="text-base font-bold tracking-tight text-foreground">{t("rapportAdmin.indicateursAvances")}</h2>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          <KpiTile
            label={t("rapportAdmin.ticketMoyen")}
            value={formatMAD(stats.advanced_kpis.ticket_moyen)}
            sub={t("rapportAdmin.parTransaction")}
            icon={<Receipt className="size-4.5" />}
            iconTone="slate"
          />
          <KpiTile
            label={t("rapportAdmin.venteMoyenneJour")}
            value={formatMAD(stats.advanced_kpis.vente_moyenne_par_jour)}
            icon={<BarChart3 className="size-4.5" />}
            iconTone="slate"
          />
          <KpiTile
            label={t("rapportAdmin.meilleureJourneeDh")}
            value={formatMAD(stats.advanced_kpis.best_day_dh?.total)}
            sub={stats.advanced_kpis.best_day_dh?.date ?? "—"}
            icon={<CalendarCheck className="size-4.5" />}
            iconTone="emerald"
          />
          <KpiTile
            label={t("rapportAdmin.meilleureJourneeOpe")}
            value={
              stats.advanced_kpis.best_day_count ? (
                <>
                  {formatQty(stats.advanced_kpis.best_day_count.count)} {t("rapportAdmin.opeUnit")}
                </>
              ) : (
                "—"
              )
            }
            sub={stats.advanced_kpis.best_day_count?.date ?? "—"}
            icon={<CalendarCheck className="size-4.5" />}
            iconTone="emerald"
          />
          <KpiTile
            label={t("rapportAdmin.moinsBonneJourneeDh")}
            value={formatMAD(stats.advanced_kpis.worst_day_dh?.total)}
            sub={stats.advanced_kpis.worst_day_dh?.date ?? "—"}
            icon={<CalendarX className="size-4.5" />}
            iconTone="rose"
          />
          <KpiTile
            label={t("rapportAdmin.moinsBonneJourneeOpe")}
            value={
              stats.advanced_kpis.worst_day_count ? (
                <>
                  {formatQty(stats.advanced_kpis.worst_day_count.count)} {t("rapportAdmin.opeUnit")}
                </>
              ) : (
                "—"
              )
            }
            sub={stats.advanced_kpis.worst_day_count?.date ?? "—"}
            icon={<CalendarX className="size-4.5" />}
            iconTone="rose"
          />
        </div>
      </section>

      {/* 2c — TVA */}
      <section className="flex flex-col gap-3.5">
        <h2 className="text-base font-bold tracking-tight text-foreground">{t("rapportAdmin.declarationTva")}</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <KpiTile
            label={t("rapportAdmin.tvaEncaissee")}
            value={formatMAD(stats.tva.tva_encaissee)}
            icon={<Coins className="size-4.5" />}
            iconTone="info"
          />
          <KpiTile
            label={t("rapportAdmin.tvaPayee")}
            value={formatMAD(stats.tva.tva_payee)}
            icon={<Banknote className="size-4.5" />}
            iconTone="warning"
          />
          <KpiTile
            label={t("rapportAdmin.tvaADeclarer")}
            value={formatMAD(stats.tva.tva_a_declarer)}
            icon={<Wallet className="size-4.5" />}
            iconTone="primary"
            badge={{ label: t("rapportAdmin.estimation"), tone: "primary" }}
          />
        </div>
      </section>

      {/* 2d — Marge */}
      <section className="flex flex-col gap-3.5">
        <h2 className="text-base font-bold tracking-tight text-foreground">{t("rapportAdmin.marge")}</h2>
        <Card
          as="div"
          padding="none"
          className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0"
        >
          <MargeCell
            label={t("col.margePct")}
            value={formatPct(stats.marge.marge_pct)}
            sub={t("rapportAdmin.moyennePonderee")}
          />
          <MargeCell
            label={t("rapportAdmin.margeBruteDh")}
            value={formatMAD(stats.marge.marge_brute_dh)}
            sub={t("rapportAdmin.avantCharges")}
          />
          <MargeCell
            label={t("rapportAdmin.margeNetteDh")}
            value={formatMAD(stats.marge.marge_nette_dh)}
            sub={t("rapportAdmin.apresCharges")}
            emphasis
          />
        </Card>
      </section>

      {/* Alertes marges — same cards as the owner's Rapport, without links */}
      {alerts && (
        <section className="flex flex-col gap-3.5">
          <h2 className="text-base font-bold tracking-tight text-foreground">{t("rapportAdmin.alertesMarges")}</h2>
          <MarginAlertCards data={alerts} tint={categoryType} linked={false} />
        </section>
      )}

      {/* 2e — Analyse de marge */}
      <MarginAnalysisTable mode={marginMode} onModeChange={onMarginMode} rows={marginRows} isLoading={marginLoading} />

      {/* Stock — same tiles as the owner's Rapport, without links */}
      {stock && (
        <section className="flex flex-col gap-3.5">
          <h2 className="text-base font-bold tracking-tight text-foreground">{t("col.stock")}</h2>
          <StockSummaryTiles stock={stock} tint={categoryType} linked={false} />
        </section>
      )}

      {/* 2f — Évolution mensuelle */}
      <AdminMonthlyTrendChart data={stats.monthly_trend} subtitle={subtitleDates} />

      {/* 2g — Top catégories */}
      <Card as="div" className="flex flex-col gap-4">
        <span className="text-sm font-semibold text-foreground">{t("rapportAdmin.topCategories")}</span>
        {stats.top_categories.length === 0 ? (
          <span className="text-xs text-muted-foreground">{t("rapportAdmin.aucuneDonneeCategorie")}</span>
        ) : (
          <div className="flex flex-col gap-3.5">
            {stats.top_categories.slice(0, 5).map((c, i) => {
              const max = stats.top_categories[0]?.total || 1;
              const color = TOP_CAT_COLORS[i % TOP_CAT_COLORS.length];
              return (
                <div key={c.category} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2.5">
                    <span className="inline-flex min-w-0 items-center gap-2 text-[13px] font-medium text-foreground">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
                      <span className="truncate">{c.category}</span>
                    </span>
                    <span className="font-mono text-[13px] font-semibold tabular-nums">{formatMAD(c.total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-subtle">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${(c.total / max) * 100}%`, background: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function MargeCell({
  label,
  value,
  sub,
  emphasis,
}: {
  label: string;
  value: ReactNode;
  sub: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 p-5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className={`font-mono text-2xl font-bold tabular-nums tracking-tight ${emphasis ? "text-success" : "text-foreground"}`}
      >
        {value}
      </span>
      <span className="text-[11.5px] text-muted-foreground">{sub}</span>
    </div>
  );
}

function AdminSystemTiles({ stats }: { stats: AdminStatsResponse }) {
  const t = useT();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        label={t("rapportAdmin.pharmacies")}
        value={formatQty(stats.total_pharmacies)}
        icon={<Building2 className="size-5" />}
      />
      <KpiTile
        label={t("rapportAdmin.utilisateursActifs")}
        value={formatQty(stats.total_active_users)}
        icon={<Users className="size-5" />}
      />
      <KpiTile
        label={t("rapportAdmin.medicamentsCatalogue")}
        value={formatQty(stats.total_catalog_items)}
        icon={<BookOpen className="size-5" />}
      />
      <KpiTile
        label={t("rapportAdmin.demandesEnAttente")}
        value={formatQty(stats.pending_catalog_requests)}
        icon={<ClipboardCheck className="size-5" />}
      />
    </div>
  );
}

/**
 * Section 8 — Analyse de marge preview.
 *
 * 3 KPI tiles from /v1/stats, the Optimisation tile (same gain as /analyses),
 * plus a dashed CTA card linking out.
 */

function AnalyseMargePreview({
  stats,
  filters,
  tint = "all",
}: {
  stats: StatsResponse;
  filters: StatsFilters;
  tint?: CategoryType;
}) {
  const t = useT();
  const ca = stats.kpis.ventes_total;
  const margePct = stats.marge.marge_pct;
  // Single source of truth: the backend reconciles marge_brute_dh to the full CA
  // (marge_brute_dh / CA == marge_pct), so every margin display reads the same value.
  const margeDh = stats.marge.marge_brute_dh;

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>{t("preview.sectionTitle")}</SectionTitle>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label={t("kpi.ca")} value={formatMAD(ca)} icon={<Coins className="size-5" />} tint={tint} />
        <KpiTile
          label={t("kpi.margeMoyPct")}
          value={formatPct(margePct)}
          icon={<Percent className="size-5" />}
          tint={tint}
        />
        <KpiTile
          label={t("kpi.margeMoyDh")}
          value={formatMAD(margeDh)}
          icon={<TrendingUp className="size-5" />}
          tint={tint}
        />
        <OptimisationTile filters={filters} tint={tint} />
      </div>

      <CtaCard tint={tint} />
    </section>
  );
}

/** Optimisation: gain best ↔ worst product (DH), same value + gauge scale as /analyses. */
function OptimisationTile({ filters, tint }: { filters: StatsFilters; tint: CategoryType }) {
  const t = useT();
  const gain = useOptimisationGain(filters);
  const gauge = Math.max(0, Math.min(100, Math.round(((gain ?? 0) / 10_000) * 100)));
  return (
    <KpiTile
      label={t("kpi.optimisation")}
      value={gain != null ? formatMAD(gain) : "—"}
      sub={t("kpi.optimisationSub")}
      icon={<Sparkles className="size-5" />}
      tint={tint}
    >
      <div className="mt-1 flex justify-center">
        <NeedleGauge value={gauge} />
      </div>
    </KpiTile>
  );
}

function CtaCard({ tint }: { tint: CategoryType }) {
  const t = useT();
  // CtaCard keeps its dashed border but adopts the category's bg tint.
  const dashedTint =
    tint === "pharmacie"
      ? "border-pharmacie-border bg-pharmacie-bg/30"
      : tint === "parapharmacie"
        ? "border-parapharmacie-border bg-parapharmacie-bg/30"
        : "border-border bg-surface-subtle/30";
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border-2 border-dashed p-5 sm:flex-row sm:items-center sm:gap-4",
        dashedTint,
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <UploadCloud className="size-5" />
      </div>
      <div className="flex-1">
        <h3 className="text-base font-semibold text-foreground">{t("preview.personalTitle")}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("preview.personalDesc")}</p>
      </div>
      <Link
        to={ROUTES.ANALYSES}
        className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md bg-primary px-4 py-2 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        {t("preview.createAnalyse")}
      </Link>
    </div>
  );
}

/**
 * Section 4 — "Répartition du CA" : one card, donut (left) + category table (right).
 *
 * Hand-rolled SVG donut (no chart lib) using the --chart-1 … --chart-8 vars from
 * tokens.css, cycled by category index so the table dot always matches its slice.
 * The table lists ALL categories (scrolls if long) with columns:
 *   Catégorie · CA (MAD) · %   (share of total CA) · Part (proportional bar).
 * Center of the donut = total CA over every category.
 */

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

const SIZE = 220; // SVG viewport (square)
const CENTER = SIZE / 2;
const OUTER = 96; // outer radius
const INNER = 70; // inner radius (donut hole)
const GAP = 0.012; // gap between segments in radians (≈ 0.7°)

function CategoriesDonut({ categories, tint = "all" }: { categories: TopCategoryRow[]; tint?: CategoryType }) {
  const t = useT();
  if (categories.length === 0) {
    return (
      <KpiTile label={t("kpi.repartitionCA")} tint={tint}>
        <p className="py-12 text-center text-sm text-muted-foreground">{t("kpi.aucuneDonnee")}</p>
      </KpiTile>
    );
  }

  const total = categories.reduce((s, c) => s + c.total, 0);
  const maxTotal = Math.max(...categories.map((c) => c.total), 1);

  // Build donut arcs around the circle (start at 12 o'clock). Slices smaller than
  // the gap can't be drawn, so we skip their path but still advance the cursor —
  // they remain in the table with a matching colour. Reduce (not a mutated
  // closure) keeps the React Compiler happy.
  const arcs = categories.reduce<{ start: number; out: { i: number; draw: boolean; path: string }[] }>(
    (acc, c, i) => {
      const share = total ? c.total / total : 0;
      const full = share * Math.PI * 2;
      const sweep = Math.max(full - GAP, 0);
      const a0 = acc.start;
      acc.out.push({ i, draw: sweep > 0.003, path: arcPath(a0, a0 + sweep) });
      return {
        start: a0 + full,
        out: acc.out,
      };
    },
    { start: -Math.PI / 2, out: [] },
  ).out;

  return (
    <KpiTile label={t("kpi.repartitionCA")} tint={tint}>
      <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-center">
        {/* Donut */}
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="shrink-0" aria-hidden>
          {arcs.map(({ i, draw, path }) =>
            draw ? <path key={i} d={path} fill={PALETTE[i % PALETTE.length]} /> : null,
          )}
          <text
            x={CENTER}
            y={CENTER - 4}
            textAnchor="middle"
            fontSize="15"
            fontWeight="600"
            fill="var(--foreground)"
            fontFamily="JetBrains Mono, monospace"
          >
            {formatNumStr(total, 2)}
          </text>
          <text
            x={CENTER}
            y={CENTER + 15}
            textAnchor="middle"
            fontSize="11"
            fill="var(--muted-foreground)"
            fontFamily="Inter, sans-serif"
          >
            {t("dashboard.caTotal")}
          </text>
        </svg>

        {/* Table */}
        <div className="min-w-0 flex-1 self-stretch">
          <div className="max-h-[300px] w-full overflow-y-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 text-left font-semibold">{t("kpi.donutCategorie")}</th>
                  <th className="px-3 py-2 text-left font-semibold">{t("dashboard.caMad")}</th>
                  <th className="px-3 py-2 text-left font-semibold">{t("kpi.donutMarge")}</th>
                  <th className="px-3 py-2 text-left font-semibold">%</th>
                  <th className="w-32 py-2 pl-3 text-left font-semibold">{t("kpi.donutPart")}</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c, i) => {
                  const color = PALETTE[i % PALETTE.length];
                  const share = total ? c.total / total : 0;
                  const barW = Math.max((c.total / maxTotal) * 100, 2);
                  return (
                    <tr key={c.category} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
                          <span className="truncate text-foreground">{c.category}</span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono font-semibold tabular-nums text-foreground">
                        {formatNumStr(c.total, 2)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono tabular-nums text-foreground">
                        {c.marge_pct != null ? (
                          formatPct(c.marge_pct)
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono font-semibold tabular-nums text-foreground">
                        {formatPct(share * 100)}
                      </td>
                      <td className="py-2.5 pl-3">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                          <div className="h-full rounded-full" style={{ width: `${barW}%`, background: color }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </KpiTile>
  );
}

/** SVG path for an annular sector between angles a0 → a1 (clockwise). */
function arcPath(a0: number, a1: number): string {
  const x0o = CENTER + OUTER * Math.cos(a0);
  const y0o = CENTER + OUTER * Math.sin(a0);
  const x1o = CENTER + OUTER * Math.cos(a1);
  const y1o = CENTER + OUTER * Math.sin(a1);
  const x0i = CENTER + INNER * Math.cos(a1);
  const y0i = CENTER + INNER * Math.sin(a1);
  const x1i = CENTER + INNER * Math.cos(a0);
  const y1i = CENTER + INNER * Math.sin(a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return [
    `M ${x0o.toFixed(2)} ${y0o.toFixed(2)}`,
    `A ${OUTER} ${OUTER} 0 ${large} 1 ${x1o.toFixed(2)} ${y1o.toFixed(2)}`,
    `L ${x0i.toFixed(2)} ${y0i.toFixed(2)}`,
    `A ${INNER} ${INNER} 0 ${large} 0 ${x1i.toFixed(2)} ${y1i.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function IndicateursAvances({ kpis, tint = "all" }: { kpis: AdvancedKpis; tint?: CategoryType }) {
  const t = useT();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        label={t("kpi.ticketMoyen")}
        value={formatMAD(kpis.ticket_moyen)}
        icon={<Receipt className="size-5" />}
        tint={tint}
      />
      <KpiTile
        label={t("kpi.moyenneJour")}
        value={formatMAD(kpis.vente_moyenne_par_jour)}
        sub={t("kpi.ventesJourn")}
        icon={<BarChart3 className="size-5" />}
        tint={tint}
      />
      <KpiTile
        label={t("kpi.meilleureJournee")}
        value={formatMAD(kpis.best_day_dh?.total ?? 0)}
        sub={
          <>
            {formatDate(kpis.best_day_dh?.date)} · {formatQty(kpis.best_day_count?.count ?? 0)} opé
          </>
        }
        icon={<CalendarCheck className="size-5" />}
        tint={tint}
      />
      <KpiTile
        label={t("kpi.moinsBonneJournee")}
        value={formatMAD(kpis.worst_day_dh?.total ?? 0)}
        sub={
          <>
            {formatDate(kpis.worst_day_dh?.date)} · {formatQty(kpis.worst_day_count?.count ?? 0)} opé
          </>
        }
        icon={<CalendarX className="size-5" />}
        tint={tint}
      />
    </div>
  );
}

/**
 * Section 2 — 4 main KPI tiles in a Bento layout.
 *
 * CA is the hero (spans 2x2 on sm+) with an inline sparkline driven by the
 * monthly_trend `ventes` series. Other 3 tiles fill the satellites.
 *
 * Responsive grid (Bento):
 *   ≥ 1024px (lg) → 4 cols, CA spans 2x2 (rest 1x1)
 *   ≥ 640px  (sm) → 2 cols, CA spans 2x2 (rest 1x1 below)
 *   < 640px      → 1 col, CA on top
 */

function IndicateursCles({ stats, tint = "all" }: { stats: StatsResponse; tint?: CategoryType }) {
  const t = useT();
  const ca = stats.kpis.ventes_total;
  const achats = stats.kpis.achats_total;
  const margePct = stats.marge.marge_pct;
  const txns = stats.kpis.ventes_count;

  const dCA = pctChange(ca, stats.previous_kpis.ventes_total);
  const dAchats = pctChange(achats, stats.previous_kpis.achats_total);
  const dMarge = pctChange(margePct, stats.previous_kpis.marge_pct);

  const phShare = ca ? Math.round((stats.type_breakdown.pharmacie.ventes_total / ca) * 100) : 0;
  const paShare = ca ? Math.round((stats.type_breakdown.parapharmacie.ventes_total / ca) * 100) : 0;
  const sparkline = stats.monthly_trend.map((p) => p.ventes);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        hero
        href={ROUTES.COMPTABILITE}
        label={t("kpi.ca")}
        value={formatMAD(ca)}
        delta={dCA != null ? { value: dCA } : null}
        icon={<Wallet className="size-5" />}
        sparkline={sparkline}
        sub={
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white">
              <span className="size-1.5 rounded-full" style={{ background: "var(--color-pharmacie)" }} />
              {t("category.pharmacie")} {phShare} %
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white">
              <span className="size-1.5 rounded-full" style={{ background: "var(--color-parapharmacie)" }} />
              {t("category.parapharmacie")} {paShare} %
            </span>
          </>
        }
      />
      <KpiTile
        className="lg:col-span-2"
        href={ROUTES.ACHATS}
        label={t("kpi.totalAchats")}
        value={formatMAD(achats)}
        sub={
          <>
            {formatQty(stats.kpis.achats_count)} {t("common.wLignes")}
          </>
        }
        delta={dAchats != null ? { value: dAchats, invertColor: true } : null}
        icon={<ShoppingCart className="size-5" />}
        tint={tint}
      />
      <KpiTile
        label={t("kpi.margeBruteMoy")}
        value={formatPct(margePct)}
        sub={
          <>
            {t("kpi.anneePrec")} {formatPct(stats.previous_kpis.marge_pct)}
          </>
        }
        delta={dMarge != null ? { value: dMarge } : null}
        icon={<TrendingUp className="size-5" />}
        tint={tint}
      />
      <KpiTile
        label={t("kpi.transactions")}
        value={formatQty(txns)}
        sub={
          <>
            {t("kpi.ticketMoyenSub")} {formatMAD(stats.advanced_kpis.ticket_moyen)}
          </>
        }
        icon={<BarChart3 className="size-5" />}
        tint={tint}
      />
    </div>
  );
}

interface BracketDef {
  key: keyof MarginAlertsResponse;
  titleKey: string;
  Icon: typeof AlertTriangle;
  tone: IconTone;
  showLoss?: boolean; // negative bracket shows total loss instead of CA concerné
}

const BRACKETS: BracketDef[] = [
  { key: "negative", titleKey: "rapportAdmin.margeNegative", Icon: TrendingDown, tone: "error", showLoss: true },
  { key: "low", titleKey: "rapportAdmin.marge0a10", Icon: AlertTriangle, tone: "warning" },
  { key: "high", titleKey: "rapportAdmin.marge60a90", Icon: TrendingUp, tone: "info" },
  { key: "very_high", titleKey: "rapportAdmin.margeSup90", Icon: ShieldCheck, tone: "success" },
];

/** `linked` = false in the admin drill-down: the owner pages (/alertes, /stock) show the admin no pharmacy data. */
function MarginAlertCards({
  data,
  tint = "all",
  linked = true,
}: {
  data: MarginAlertsResponse;
  tint?: CategoryType;
  linked?: boolean;
}) {
  const t = useT();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {BRACKETS.map((b) => {
        const bucket = data[b.key];
        const subLabel = b.showLoss ? t("rapportAdmin.perteTotale") : t("rapportAdmin.caConcerne");
        const subValue = b.showLoss ? formatMAD(Math.abs(bucket.total_margin_dh)) : formatMAD(bucket.total_ca);
        return (
          <KpiTile
            key={b.key}
            href={linked ? ROUTES.ALERTES : undefined}
            label={t(b.titleKey)}
            value={subValue}
            sub={subLabel}
            icon={<b.Icon className="size-5" />}
            iconTone={b.tone}
            badge={{
              label: (
                <>
                  {formatQty(bucket.count)} {t("rapportAdmin.produitsUnit")}
                </>
              ),
              tone: b.tone,
            }}
            tint={tint}
          />
        );
      })}
    </div>
  );
}

function RapportSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="h-12 animate-pulse rounded-xl bg-muted" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="h-44 animate-pulse rounded-2xl bg-muted sm:col-span-2 sm:row-span-2" />
        <div className="h-44 animate-pulse rounded-2xl bg-muted" />
        <div className="h-44 animate-pulse rounded-2xl bg-muted" />
        <div className="h-44 animate-pulse rounded-2xl bg-muted" />
      </div>
      <div className="h-60 animate-pulse rounded-2xl bg-muted" />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr]">
        <div className="h-72 animate-pulse rounded-2xl bg-muted" />
        <div className="h-72 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}

interface GradeDef {
  letter: string;
  labelKey: string;
  bg: string;
  ring: string;
  text: string;
}

function grade(marge_pct: number): GradeDef {
  if (marge_pct > 30)
    return {
      letter: "A+",
      labelKey: "kpi.gradeExcellente",
      bg: "bg-success",
      ring: "border-success",
      text: "text-success-foreground",
    };
  if (marge_pct > 25)
    return {
      letter: "A",
      labelKey: "kpi.gradeTresBonne",
      bg: "bg-success/80",
      ring: "border-success",
      text: "text-success-foreground",
    };
  if (marge_pct > 20)
    return {
      letter: "B+",
      labelKey: "kpi.gradeBonne",
      bg: "bg-info",
      ring: "border-info",
      text: "text-info-foreground",
    };
  if (marge_pct > 15)
    return {
      letter: "B",
      labelKey: "kpi.gradeCorrecte",
      bg: "bg-info/80",
      ring: "border-info",
      text: "text-info-foreground",
    };
  if (marge_pct > 10)
    return {
      letter: "C",
      labelKey: "kpi.gradeFaible",
      bg: "bg-warning",
      ring: "border-warning",
      text: "text-warning-foreground",
    };
  if (marge_pct > 5)
    return {
      letter: "D",
      labelKey: "kpi.gradeCritique",
      bg: "bg-warning/80",
      ring: "border-warning",
      text: "text-warning-foreground",
    };
  return {
    letter: "F",
    labelKey: "kpi.gradeInsuffisante",
    bg: "bg-error",
    ring: "border-error",
    text: "text-error-foreground",
  };
}

function SanteFinanciereCard({ marge, tint = "all" }: { marge: MargeSummary; tint?: CategoryType }) {
  const t = useT();
  const g = grade(marge.marge_pct);
  return (
    <KpiTile label={t("kpi.santeFinanciere")} className="items-center text-center" tint={tint}>
      <div
        className={cn(
          "mx-auto flex size-28 items-center justify-center rounded-full border-4 font-mono text-6xl font-bold tracking-tight",
          g.bg,
          g.ring,
          g.text,
        )}
      >
        {g.letter}
      </div>
      <div className="text-center">
        <div className="text-base font-semibold text-foreground">{t(g.labelKey)}</div>
        <div className="mt-0.5 font-mono text-base tabular-nums text-muted-foreground">
          {t("kpi.margeMoyenne")} {formatPct(marge.marge_pct)}
        </div>
      </div>
      <div className="grid w-full grid-cols-2 gap-3 rounded-xl bg-surface-subtle p-3">
        <Stat label={t("kpi.margeBrute")} value={formatMAD(marge.marge_brute_dh)} />
        <Stat label={t("kpi.margeNette")} value={formatMAD(marge.marge_nette_dh)} />
      </div>
      <div className="text-center font-mono text-xs text-muted-foreground">
        A+ (&gt;30%) · A (&gt;25%) · B+ (&gt;20%) · B (&gt;15%) · C (&gt;10%) · D (&gt;5%) · F (≤5%)
      </div>
    </KpiTile>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-mono text-base font-bold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function StockSummaryTiles({
  stock,
  tint = "all",
  linked = true,
}: {
  stock: StockSummaryResponse;
  tint?: CategoryType;
  linked?: boolean;
}) {
  const t = useT();
  const { cardClass } = useCategoryTint(tint);
  // Health-tone mapping reuses our semantic tones — same vocabulary as everywhere else.
  const healthTone: IconTone = stock.health_pct >= 80 ? "success" : stock.health_pct >= 60 ? "warning" : "error";

  // Health value reuses the tone color so the big number itself carries the signal.
  const healthValueClass =
    stock.health_pct >= 80 ? "text-success" : stock.health_pct >= 60 ? "text-warning" : "text-error";

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          href={linked ? ROUTES.STOCK : undefined}
          label={t("kpi.totalRefs")}
          value={formatQty(stock.total_references)}
          sub={t("kpi.produitsSuivis")}
          icon={<Boxes className="size-5" />}
          tint={tint}
        />
        <KpiTile
          href={linked ? ROUTES.STOCK : undefined}
          label={t("kpi.ppvPotentiel")}
          value={formatMAD(stock.ppv_potentiel)}
          sub={t("kpi.madEnStock")}
          icon={<Coins className="size-5" />}
          tint={tint}
        />
        <KpiTile
          href={linked ? ROUTES.STOCK : undefined}
          label={t("kpi.sousSurStock")}
          value={
            <>
              {formatQty(stock.sous_stock_count)} / {formatQty(stock.sur_stock_count)}
            </>
          }
          sub={t("kpi.produitsAjuster")}
          icon={<AlertTriangle className="size-5" />}
          tint={tint}
        />
        <KpiTile
          href={linked ? ROUTES.STOCK : undefined}
          label={t("kpi.santeStock")}
          value={<span className={cn(healthValueClass)}>{formatPct(stock.health_pct)}</span>}
          sub={t("kpi.fourchetteIdeale")}
          icon={<ShieldCheck className="size-5" />}
          iconTone={healthTone}
          tint={tint}
        />
      </div>

      {/* Info card + 2 CTAs (owner only: they open the owner's stock / import pages) */}
      {linked && (
        <div className={cn("flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center", cardClass)}>
          <div className="flex-1">
            <p className="text-base font-semibold text-foreground">{t("kpi.analyseStock")}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("kpi.analyseStockSub")}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              to={ROUTES.STOCK}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              {t("kpi.voirStock")}
            </Link>
            <Link
              to={`${ROUTES.UPLOAD_FILE}?type=stock`}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-base font-semibold text-foreground hover:bg-surface-subtle"
            >
              <UploadCloud className="size-4" />
              {t("kpi.importerStock")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

const H = 264;
const PAD_T = 18;
const PAD_B = 34;
const PAD_R = 18;
const MIN_W = 320;

// Title + count-unit word (singular, plural) per granularity. The backend picks
// the granularity from the selected period length (see _trend_granularity).
const TITLE: Record<TrendGranularity, string> = {
  week: "trend.week",
  month: "trend.month",
  semester: "trend.semester",
  year: "trend.year",
};
const UNIT_KEY: Record<TrendGranularity, string> = {
  week: "trend.uWeek",
  month: "trend.uMonth",
  semester: "trend.uSemester",
  year: "trend.uYear",
};

function TrendChart({
  points,
  granularity = "month",
  tint = "all",
}: {
  points: MonthlyTrendPoint[];
  granularity?: TrendGranularity;
  tint?: CategoryType;
}) {
  const t = useT();
  const title = t(TITLE[granularity] ?? TITLE.month);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width ?? 0;
      if (cw > 0) setW(cw);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (points.length === 0) {
    return (
      <KpiTile label={title} tint={tint}>
        <p className="py-14 text-center text-sm text-muted-foreground">{t("rapportAdmin.aucuneDonneePeriode")}</p>
      </KpiTile>
    );
  }

  const single = points.length === 1;
  const rawMax = Math.max(...points.map((p) => Math.max(p.ventes, p.achats)), 1);
  const { niceMax, ticks } = niceScale(rawMax, 4);
  const yLabels = ticks.map((t) => formatNumStr(t));

  // Geometry in real pixels (1 svg unit = 1 px) → crisp, undistorted text.
  const PAD_L = 14 + Math.max(...yLabels.map((s) => s.length)) * 7;
  const W = Math.max(MIN_W, w);
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const stepX = points.length > 1 ? plotW / (points.length - 1) : 0;
  const xAt = (i: number) => (single ? PAD_L + plotW / 2 : PAD_L + i * stepX);
  const yAt = (v: number) => PAD_T + plotH - (v / niceMax) * plotH;
  const baseY = PAD_T + plotH;

  const vPts = points.map((p, i) => ({ x: xAt(i), y: yAt(p.ventes) }));
  const aPts = points.map((p, i) => ({ x: xAt(i), y: yAt(p.achats) }));
  const vLine = smoothPath(vPts);
  const aLine = smoothPath(aPts);
  const areaTail = (pts: { x: number; y: number }[]) =>
    `${smoothPath(pts)} L${pts[pts.length - 1].x},${baseY} L${pts[0].x},${baseY} Z`;

  const unitLabel = t(UNIT_KEY[granularity] ?? UNIT_KEY.month);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / (rect.width || W));
    const idx = single ? 0 : Math.round((x - PAD_L) / (stepX || 1));
    setHover(clamp(idx, 0, points.length - 1));
  };

  const hi = hover;
  const hx = hi != null ? xAt(hi) : 0;
  const drawKey = `${granularity}:${points.length}:${points[0].label}`;

  return (
    <KpiTile
      label={title}
      sub={t("trend.rangeSub", { from: points[0].label, to: points[points.length - 1].label })}
      tint={tint}
    >
      <div className="flex justify-end">
        <Legend />
      </div>

      <div ref={wrapRef} className="relative w-full">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="block touch-none select-none"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="trend-ventes" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--chart-1)" stopOpacity="0.30" />
              <stop offset="1" stopColor="var(--chart-1)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="trend-achats" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--chart-3)" stopOpacity="0.18" />
              <stop offset="1" stopColor="var(--chart-3)" stopOpacity="0" />
            </linearGradient>
            <filter id="trend-glow" x="-20%" y="-40%" width="140%" height="180%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>

          {/* y-axis: round full-number ticks + gridlines */}
          {ticks.map((tk, i) => {
            const y = yAt(tk);
            const interior = i > 0 && i < ticks.length - 1;
            return (
              <g key={tk}>
                {interior && (
                  <line
                    x1={PAD_L}
                    y1={y}
                    x2={W - PAD_R}
                    y2={y}
                    stroke="var(--chart-grid)"
                    strokeWidth="1"
                    strokeDasharray="3 4"
                  />
                )}
                <text
                  x={PAD_L - 10}
                  y={y + 3.5}
                  fontSize="11"
                  fontFamily="JetBrains Mono, monospace"
                  fill="var(--chart-axis)"
                  textAnchor="end"
                >
                  {yLabels[i]}
                </text>
              </g>
            );
          })}

          <g key={drawKey}>
            {!single && (
              <>
                <motion.path
                  d={areaTail(aPts)}
                  fill="url(#trend-achats)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                />
                <motion.path
                  d={areaTail(vPts)}
                  fill="url(#trend-ventes)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                />
                {/* soft glow under the ventes line */}
                <path
                  d={vLine}
                  fill="none"
                  stroke="var(--chart-1)"
                  strokeWidth="4"
                  strokeOpacity="0.35"
                  filter="url(#trend-glow)"
                />
                <motion.path
                  d={aLine}
                  fill="none"
                  stroke="var(--chart-3)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.7, ease: "easeInOut" }}
                />
                <motion.path
                  d={vLine}
                  fill="none"
                  stroke="var(--chart-1)"
                  strokeWidth="2.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.7, ease: "easeInOut" }}
                />
              </>
            )}
          </g>

          {/* single-bucket fallback: dots so it's never blank */}
          {single && (
            <>
              <circle cx={xAt(0)} cy={yAt(points[0].achats)} r="4.5" fill="var(--chart-3)" />
              <circle cx={xAt(0)} cy={yAt(points[0].ventes)} r="5" fill="var(--chart-1)" />
            </>
          )}

          {/* hover: crosshair + focus dots */}
          {hi != null && (
            <g pointerEvents="none">
              <line
                x1={hx}
                y1={PAD_T}
                x2={hx}
                y2={baseY}
                stroke="var(--chart-axis)"
                strokeWidth="1"
                strokeOpacity="0.45"
                strokeDasharray="4 4"
              />
              <circle
                cx={hx}
                cy={yAt(points[hi].achats)}
                r="5.5"
                fill="var(--chart-3)"
                stroke="var(--card)"
                strokeWidth="2.5"
              />
              <circle
                cx={hx}
                cy={yAt(points[hi].ventes)}
                r="5.5"
                fill="var(--chart-1)"
                stroke="var(--card)"
                strokeWidth="2.5"
              />
            </g>
          )}

          {/* x-axis labels (subset to avoid crowding; hovered one always shown) */}
          {points.map((p, i) => {
            const show = i % Math.max(1, Math.ceil(points.length / 8)) === 0 || i === hi;
            if (!show) return null;
            const anchor = i === 0 ? "start" : i === points.length - 1 ? "end" : "middle";
            return (
              <text
                key={i}
                x={xAt(i)}
                y={H - 8}
                fontSize="11"
                fontFamily="JetBrains Mono, monospace"
                fill={i === hi ? "var(--foreground)" : "var(--chart-axis)"}
                fontWeight={i === hi ? 600 : 400}
                textAnchor={anchor}
              >
                {p.label}
              </text>
            );
          })}
        </svg>

        <AnimatePresence>
          {hi != null && (
            <motion.div
              key="tip"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="pointer-events-none absolute top-1 z-10 min-w-[152px] -translate-x-1/2 rounded-xl border border-border bg-card px-3 py-2 shadow-lg"
              style={{ left: clamp(hx, 82, W - 82) }}
            >
              <div className="mb-1.5 text-xs font-semibold text-foreground">{points[hi].label}</div>
              <div className="flex flex-col gap-1">
                <TipRow colorVar="--chart-1" name={t("trend.ventes")} value={points[hi].ventes} />
                <TipRow colorVar="--chart-3" name={t("trend.achats")} value={points[hi].achats} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {t("dashboard.max")} <span className="font-mono tabular-nums">{formatMAD(rawMax)}</span>
        </span>
        <span>
          {points.length} {unitLabel}
        </span>
      </div>
    </KpiTile>
  );
}

function TipRow({ colorVar, name, value }: { colorVar: string; name: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-5 text-xs">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className="size-2 rounded-full" style={{ background: `var(${colorVar})` }} />
        {name}
      </span>
      <span className="font-mono tabular-nums text-foreground">{formatMAD(value)}</span>
    </div>
  );
}

function Legend() {
  const t = useT();
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ background: "var(--chart-1)" }} />
        <span className="text-muted-foreground">{t("trend.ventes")}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ background: "var(--chart-3)" }} />
        <span className="text-muted-foreground">{t("trend.achats")}</span>
      </span>
    </div>
  );
}

function TvaTiles({ tva, tint = "all" }: { tva: TvaSummary; tint?: CategoryType }) {
  const t = useT();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <KpiTile
        href={ROUTES.COMPTABILITE}
        label={t("kpi.tvaEncaissee")}
        value={formatMAD(tva.tva_encaissee)}
        icon={<ArrowDownCircle className="size-5" />}
        iconTone="primary"
        tint={tint}
      />
      <KpiTile
        href={ROUTES.COMPTABILITE}
        label={t("kpi.tvaPayee")}
        value={formatMAD(tva.tva_payee)}
        icon={<Receipt className="size-5" />}
        iconTone="warning"
        tint={tint}
      />
      <KpiTile
        href={ROUTES.COMPTABILITE}
        label={t("kpi.tvaADeclarer")}
        value={formatMAD(tva.tva_a_declarer)}
        icon={<FileText className="size-5" />}
        iconTone="primary"
        tint={tint}
      />
    </div>
  );
}

const CATEGORY_KEY = {
  all: "category.mixte",
  pharmacie: "category.pharmacie",
  parapharmacie: "category.parapharmacie",
} as const;

/** Build the activeFilters[] array from StatsFilters — shared by both owner + admin views. */
function buildActiveFilters(filters: StatsFilters, setFilters: (f: StatsFilters) => void, t: TFn): ActiveFilter[] {
  return [
    filters.date_from || filters.date_to
      ? {
          key: "dates",
          label: (
            <>
              {t("dashboard.periode")} {filters.date_from ?? "…"} → {filters.date_to ?? "…"}
            </>
          ),
          onClear: () => setFilters({ ...filters, date_from: null, date_to: null }),
        }
      : null,
    filters.category_type !== "all"
      ? {
          key: "category",
          label: (
            <>
              {t("dashboard.categorieFilter")} {t(CATEGORY_KEY[filters.category_type])}
            </>
          ),
          onClear: () => setFilters({ ...filters, category_type: "all" }),
        }
      : null,
  ].filter(Boolean) as ActiveFilter[];
}

// Local-only filter slice — date fields come from the cross-route
// GlobalDateRangeProvider so picking dates on /rapport carries over to
// /achats, /ventes, /admin/stats, etc. The composed `StatsFilters` is built
// per-view by merging this local slice with the global range.
type LocalStatsFilters = Omit<StatsFilters, "date_from" | "date_to">;
const INITIAL_LOCAL: LocalStatsFilters = {
  category_type: "all",
  // USER DECISION 2026-08-01: special/excluded products + excluded fournisseurs/BLs
  // are INCLUDED in the Dashboard (Rapport). Only /comptabilite applies exclusions.
  include_non_declared: true,
};

export default function RapportPage() {
  const { me } = useMe();
  if (!me) return null;
  return me.role === ROLES.ADMIN ? <AdminView /> : <OwnerView />;
}

// ────────────────────────────────────────────────────────────────────────────
// OWNER
// ────────────────────────────────────────────────────────────────────────────

function OwnerView() {
  const t = useT();
  const categoryTypeOptions = useCategoryTypeOptions();
  const { from: dateFrom, to: dateTo, setRange } = useGlobalDateRange();
  const [local, setLocal] = useState<LocalStatsFilters>(INITIAL_LOCAL);
  const filters: StatsFilters = { ...local, date_from: dateFrom, date_to: dateTo };
  // Backwards-compat wrapper so the existing buildActiveFilters/FilterBar
  // call sites can keep doing `setFilters({ ...filters, date_from, date_to })`.
  const setFilters = (next: StatsFilters) => {
    const { date_from, date_to, ...rest } = next;
    setLocal(rest);
    setRange(date_from, date_to);
  };

  const { stats, isLoading: l1, isError: e1 } = useStats(filters);
  const { marginAlerts: alerts, isLoading: l2 } = useMarginAlerts(filters);
  const { stock, isLoading: l3 } = useStockSummary();

  const loading = l1 || l2 || l3;

  return (
    <Page title={t("dashboard.title")} subtitle={t("dashboard.subtitle")}>
      <FilterBar<StatsFilters["category_type"]>
        dateRange={{
          from: filters.date_from,
          to: filters.date_to,
          onChange: (from, to) => setFilters({ ...filters, date_from: from, date_to: to }),
        }}
        segment={{
          value: filters.category_type,
          onChange: (v) => setFilters({ ...filters, category_type: v }),
          options: categoryTypeOptions,
        }}
        activeFilters={buildActiveFilters(filters, setFilters, t)}
        onResetAll={() => {
          setLocal(INITIAL_LOCAL);
          setRange(null, null);
        }}
      />

      {loading && <RapportSkeleton />}

      {e1 && (
        <div className="rounded-md border border-error-border bg-error-subtle px-4 py-3 text-sm text-error-subtle-foreground">
          {t("dashboard.loadError")}
        </div>
      )}

      {stats && !loading && (
        <RapportSections
          stats={stats}
          filters={filters}
          alerts={alerts}
          stock={stock}
          category={filters.category_type}
        />
      )}
    </Page>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ADMIN  (Vue système + per-pharmacy drill-down)
// ────────────────────────────────────────────────────────────────────────────

function AdminView() {
  const t = useT();
  const categoryTypeOptions = useCategoryTypeOptions();
  const [pharmacyId, setPharmacyId] = useState<number | null>(null);
  const { from: dateFrom, to: dateTo, setRange } = useGlobalDateRange();
  const [local, setLocal] = useState<LocalStatsFilters>(INITIAL_LOCAL);
  const filters: StatsFilters = { ...local, date_from: dateFrom, date_to: dateTo };
  const setFilters = (next: StatsFilters) => {
    const { date_from, date_to, ...rest } = next;
    setLocal(rest);
    setRange(date_from, date_to);
  };
  const [marginMode, setMarginMode] = useState<MargeMode>("produit");

  const { systemStats, isLoading: ls } = useAdminStats();
  const { pharmacies = [] } = useAdminPharmaciesList();
  const { stats, isLoading: l1, isError: e1 } = useAdminPharmacyStats(pharmacyId, filters);
  const { alerts } = useAdminPharmacyMarginAlerts(pharmacyId, {
    date_from: dateFrom,
    date_to: dateTo,
    category_type: filters.category_type,
  });
  const { stock } = useAdminPharmacyStockSummary(pharmacyId);
  const { analyse, isLoading: analyseLoading } = useAdminPharmacyAnalyseMarge(pharmacyId, marginMode, {
    date_from: dateFrom,
    date_to: dateTo,
    category_type: filters.category_type,
  });

  const loading = pharmacyId !== null && l1;
  const subtitleDates =
    dateFrom || dateTo ? `${t("dashboard.periode")} ${dateFrom ?? "…"} → ${dateTo ?? "…"}` : t("trend.last12");

  return (
    <Page title={t("dashboard.title")} subtitle={t("dashboard.subtitleAdmin")}>
      {/* Vue système — always shown */}
      <section className="flex flex-col gap-3">
        <SectionTitle size="sm">{t("rapportAdmin.vueSysteme")}</SectionTitle>
        {ls || !systemStats ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : (
          <AdminSystemTiles stats={systemStats} />
        )}
      </section>

      {/* Per-pharmacy drill-down */}
      <section className="flex flex-col gap-3">
        <SectionTitle size="sm">{t("rapportAdmin.parPharmacie")}</SectionTitle>
        {/* Admin pharmacy picker — uses the shared SingleSelectPopover so the
            trigger + panel match every other dropdown in the app (Catégorie,
            Type, Statut, page-size, etc.). */}
        <div className="flex flex-wrap items-center gap-3">
          <SingleSelectPopover
            label={t("category.pharmacie")}
            value={pharmacyId != null ? String(pharmacyId) : ""}
            onChange={(v) => setPharmacyId(v ? Number(v) : null)}
            options={[
              { value: "", label: t("dashboard.toutesPharmacies") },
              ...pharmacies.map((p) => ({
                value: String(p.id),
                label: [p.code, p.name].filter(Boolean).join(" · "),
              })),
            ]}
          />
        </div>

        <FilterBar<StatsFilters["category_type"]>
          dateRange={{
            from: filters.date_from,
            to: filters.date_to,
            onChange: (from, to) => setFilters({ ...filters, date_from: from, date_to: to }),
          }}
          segment={{
            value: filters.category_type,
            onChange: (v) => setFilters({ ...filters, category_type: v }),
            options: categoryTypeOptions,
          }}
          activeFilters={[
            ...(pharmacyId !== null
              ? [
                  {
                    key: "pharmacy",
                    label: (
                      <>
                        {t("rapportAdmin.pharmacieFilter")}{" "}
                        {pharmacies.find((p) => p.id === pharmacyId)?.code ??
                          pharmacies.find((p) => p.id === pharmacyId)?.name ??
                          "—"}
                      </>
                    ),
                    onClear: () => setPharmacyId(null),
                  },
                ]
              : []),
            ...buildActiveFilters(filters, setFilters, t),
          ]}
          onResetAll={() => {
            setLocal(INITIAL_LOCAL);
            setRange(null, null);
            setPharmacyId(null);
          }}
        />

        {pharmacyId === null && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <Building2 className="size-12 text-muted-foreground" aria-hidden />
            <p className="max-w-md text-sm text-muted-foreground">{t("rapportAdmin.selectPharmacyHint")}</p>
          </div>
        )}

        {loading && <RapportSkeleton />}

        {e1 && (
          <div className="rounded-md border border-error-border bg-error-subtle px-4 py-3 text-sm text-error-subtle-foreground">
            {t("rapportAdmin.pharmacyLoadError")}
          </div>
        )}

        {stats &&
          pharmacyId !== null &&
          !loading &&
          (() => {
            const sel = pharmacies.find((p) => p.id === pharmacyId);
            const pharmacyLabel = sel ? [sel.code, sel.name].filter(Boolean).join(" · ") : "";
            return (
              <AdminPharmacyBody
                stats={stats}
                pharmacyLabel={pharmacyLabel}
                categoryType={filters.category_type}
                marginMode={marginMode}
                onMarginMode={setMarginMode}
                marginRows={(analyse?.rows ?? []) as Record<string, unknown>[]}
                marginLoading={analyseLoading}
                subtitleDates={subtitleDates}
                alerts={alerts}
                stock={stock}
              />
            );
          })()}
      </section>
    </Page>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Shared sections (used by both owner + admin variants)
// ────────────────────────────────────────────────────────────────────────────

interface SectionsProps {
  stats: NonNullable<ReturnType<typeof useStats>["stats"]>;
  filters: StatsFilters;
  alerts: MarginAlertsResponse | undefined;
  stock: ReturnType<typeof useStockSummary>["stock"];
  category: CategoryType;
}

function RapportSections({ stats, filters, alerts, stock, category }: SectionsProps) {
  const t = useT();
  const { me } = useMe();
  // Admin bypass: see every section regardless of feature flags. Non-admin:
  // hide sections whose backing feature isn't in their effective permissions.
  const has = (f: Feature) => me?.role === ROLES.ADMIN || (me?.permissions.includes(f) ?? false);

  return (
    <>
      {/* Section 2 — Indicateurs clés (Bento hero with aurora + sparkline) */}
      <IndicateursCles stats={stats} tint={category} />

      {/* Section 3 — Indicateurs avancés */}
      <IndicateursAvances kpis={stats.advanced_kpis} tint={category} />

      {/* Section 4 — Répartition du CA : donut + table (pleine largeur) */}
      <CategoriesDonut categories={stats.top_categories} tint={category} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
        <SanteFinanciereCard marge={stats.marge} tint={category} />
        <TrendChart points={stats.monthly_trend} granularity={stats.trend_granularity} tint={category} />
      </div>

      {/* Section 5 — Alertes marges (feature: alertes) */}
      {has("alertes") && alerts && (
        <section className="flex flex-col gap-3">
          <SectionTitle size="sm">{t("rapportAdmin.alertesMarges")}</SectionTitle>
          <MarginAlertCards data={alerts} tint={category} />
        </section>
      )}

      {/* Section 6 — Déclaration TVA (feature: accounting) */}
      {has("accounting") && (
        <section className="flex flex-col gap-3">
          <SectionTitle size="sm">{t("rapportAdmin.declarationTva")}</SectionTitle>
          <TvaTiles tva={stats.tva} tint={category} />
        </section>
      )}

      {/* Section 7 — Analyse de marge preview (feature: analyse) */}
      {has("analyse") && <AnalyseMargePreview stats={stats} filters={filters} tint={category} />}

      {/* Section 8 — Stock summary (feature: stock) */}
      {has("stock") && stock && (
        <section className="flex flex-col gap-3">
          <SectionTitle size="sm">{t("col.stock")}</SectionTitle>
          <StockSummaryTiles stock={stock} tint={category} />
        </section>
      )}
    </>
  );
}
