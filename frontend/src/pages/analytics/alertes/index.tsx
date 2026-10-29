// src/pages/alertes/index.tsx
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
  CalendarX,
  PackageMinus,
  PackagePlus,
  PackageX,
  PackageOpen,
  FileWarning,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import { useCategoryTypeOptions } from "@/_components/CategorySegment";
import { FilterBar, type ActiveFilter } from "@/_components/filterBar";

import {
  AlertDetailDialog,
  MARGIN_COLUMNS,
  PEREMPTION_COLUMNS,
  STOCK_COLUMNS,
  VENTES_SANS_ACHAT_COLUMNS,
} from "../_components/AlertDetailDialog";
import { useAlertesPage, type CategoryType } from "../hooks";
import { useT } from "@/i18n/I18nProvider";
import type { ReactNode } from "react";
import { formatQty, formatMAD } from "@/utils/format";
import { KpiTile, type IconTone } from "@/_components/KpiTile";
import type {
  MarginAlertsResponse,
  PeremptionsResponse,
  PeremptionBracket,
  StockRow,
  VentesSansAchatResponse,
} from "@/types";
import type { DialogDescriptor } from "../hooks";
import { Page } from "@/_components/Page";

// src/pages/alertes/_components/GlobalSummaryStrip.tsx

interface GlobalSummaryStripProps {
  totalAlerts: number;
  marginNegative: number;
  marginLow: number;
  peremptionCritical: number;
  toRestock: number;
  excessStock: number;
}

function Chip({ icon, color, label, value }: { icon: ReactNode; color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-border bg-card px-3 py-2 shadow-sm">
      <span className={`flex size-8 items-center justify-center rounded-md ${color}`}>{icon}</span>
      <div className="flex flex-col">
        <span className="whitespace-nowrap text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-xl font-bold tabular-nums text-foreground">{formatQty(value)}</span>
      </div>
    </div>
  );
}

function GlobalSummaryStrip(p: GlobalSummaryStripProps) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-3">
      <Chip
        icon={<AlertTriangle className="size-4" />}
        color="bg-red-500/10 text-red-500"
        label={t("alertes.alertesTotales")}
        value={p.totalAlerts}
      />
      <Chip
        icon={<TrendingDown className="size-4" />}
        color="bg-red-500/10 text-red-500"
        label={t("alertes.margesNegatives")}
        value={p.marginNegative}
      />
      <Chip
        icon={<TrendingDown className="size-4" />}
        color="bg-amber-500/10 text-amber-500"
        label={t("alertes.margesFaibles")}
        value={p.marginLow}
      />
      <Chip
        icon={<CalendarX className="size-4" />}
        color="bg-red-500/10 text-red-500"
        label={t("alertes.peremptionsCritiques")}
        value={p.peremptionCritical}
      />
      <Chip
        icon={<PackageMinus className="size-4" />}
        color="bg-amber-500/10 text-amber-500"
        label={t("alertes.stockReappro")}
        value={p.toRestock}
      />
      <Chip
        icon={<PackagePlus className="size-4" />}
        color="bg-blue-500/10 text-blue-500"
        label={t("alertes.stockExcessif")}
        value={p.excessStock}
      />
    </div>
  );
}

// src/pages/alertes/_components/MarginAlertsSection.tsx

interface MarginAlertsSectionProps {
  data?: MarginAlertsResponse;
  onOpen: (d: DialogDescriptor) => void;
}

function MarginAlertsSection({ data, onOpen }: MarginAlertsSectionProps) {
  const t = useT();
  // The 4 brackets of the Rapport margin tiles: too low (loss, < 10 %) and too high (60 % +: often a price mistake).
  const cards: {
    tone: IconTone;
    Icon: typeof TrendingDown;
    title: string;
    bracket?: MarginAlertsResponse["negative"];
    dlgSubtitle: string;
  }[] = [
    {
      tone: "error",
      Icon: TrendingDown,
      title: t("ventes.margeNegative"),
      bracket: data?.negative,
      dlgSubtitle: t("alertes.margeNegativeSub"),
    },
    {
      tone: "warning",
      Icon: TrendingDown,
      title: t("alertes.margeFaible"),
      bracket: data?.low,
      dlgSubtitle: t("alertes.margeFaibleSub"),
    },
    {
      tone: "info",
      Icon: TrendingUp,
      title: t("rapportAdmin.marge60a90"),
      bracket: data?.high,
      dlgSubtitle: t("alertes.margeHauteSub"),
    },
    {
      tone: "success",
      Icon: ShieldCheck,
      title: t("rapportAdmin.margeSup90"),
      bracket: data?.very_high,
      dlgSubtitle: t("alertes.margeTresHauteSub"),
    },
  ];

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center gap-2.5">
        <TrendingDown className="size-5 text-error" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t("alertes.margeSection")}</h2>
          <p className="text-sm text-muted-foreground">{t("alertes.margeSectionSub")}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const count = c.bracket?.count ?? 0;
          return (
            <KpiTile
              key={c.title}
              label={c.title}
              value={formatMAD(c.bracket?.total_ca ?? 0)}
              sub={t("alertes.caConcerne")}
              icon={<c.Icon className="size-5" />}
              iconTone={c.tone}
              badge={{
                label: (
                  <>
                    {formatQty(count)} {t("stock.produitsWord")}
                  </>
                ),
                tone: c.tone,
              }}
              disabled={count === 0}
              onClick={
                c.bracket
                  ? () =>
                      onOpen({
                        title: c.title,
                        subtitle: c.dlgSubtitle,
                        products: c.bracket!.products,
                        columns: MARGIN_COLUMNS,
                        defaultSortKey: "marge_pct",
                      })
                  : undefined
              }
            />
          );
        })}
      </div>
    </section>
  );
}

// src/pages/alertes/_components/PeremptionsSection.tsx

interface PeremptionsSectionProps {
  data?: PeremptionsResponse;
  onOpen: (d: DialogDescriptor) => void;
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-px">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-mono text-base font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function PeremptionsSection({ data, onOpen }: PeremptionsSectionProps) {
  const t = useT();
  // 4 mutually-exclusive cards — labels + buckets port the old apcm-pharma
  // app verbatim (client-requested parity). The first three are date-bucketed
  // by urgency; the fourth (`no_date`) is a data-quality bucket — products
  // whose Sobrus export had no expiry date.
  const cards: {
    key: keyof PeremptionsResponse;
    tone: IconTone;
    title: string;
    sub: string;
    dlgTitle: string;
    dlgSubtitle: string;
  }[] = [
    {
      key: "expired",
      tone: "error",
      title: t("peremptions.expires"),
      sub: t("peremptions.actionUrgente"),
      dlgTitle: t("peremptions.dlgExpires"),
      dlgSubtitle: t("peremptions.dlgExpiresSub"),
    },
    {
      key: "very_close",
      tone: "warning",
      title: t("peremptions.tresProche"),
      sub: t("peremptions.tresUrgent"),
      dlgTitle: t("peremptions.dlgTresProche"),
      dlgSubtitle: t("peremptions.dlgTresProcheSub"),
    },
    {
      key: "close",
      tone: "warning",
      title: t("peremptions.proche"),
      sub: t("peremptions.aSurveiller"),
      dlgTitle: t("peremptions.dlgProche"),
      dlgSubtitle: t("peremptions.dlgProcheSub"),
    },
    {
      key: "no_date",
      tone: "muted",
      title: t("peremptions.sansDate"),
      sub: t("peremptions.aRenseigner"),
      dlgTitle: t("peremptions.dlgSansDate"),
      dlgSubtitle: t("peremptions.dlgSansDateSub"),
    },
  ];

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center gap-2.5">
        <CalendarX className="size-5 text-error" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t("peremptions.sectionTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("peremptions.sectionSub")}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const b: PeremptionBracket | undefined = data?.[c.key];
          const count = b?.count ?? 0;
          return (
            <KpiTile
              key={c.key}
              label={c.title}
              sub={c.sub}
              subTone={c.tone}
              icon={<CalendarX className="size-5" />}
              iconTone={c.tone}
              badge={{ label: formatQty(count), tone: c.tone }}
              disabled={count === 0}
              onClick={
                b
                  ? () =>
                      onOpen({
                        title: c.dlgTitle,
                        subtitle: c.dlgSubtitle,
                        products: b.products,
                        columns: PEREMPTION_COLUMNS,
                        defaultSortKey: "expiry_date",
                      })
                  : undefined
              }
            >
              <div className="flex items-center gap-5 pt-0.5">
                <MiniStat label={t("col.unites")} value={formatQty(b?.total_units ?? 0)} />
                <MiniStat label={t("peremptions.valeurAchat")} value={formatMAD(b?.purchase_value ?? 0)} />
              </div>
            </KpiTile>
          );
        })}
      </div>
    </section>
  );
}

// src/pages/alertes/_components/StockAlertsSection.tsx

interface StockAlertsSectionProps {
  negatif: StockRow[];
  sousStock: StockRow[];
  surStock: StockRow[];
  negUnits: number;
  sousPpv: number;
  surPpv: number;
  onOpen: (d: DialogDescriptor) => void;
}

function StockAlertsSection({
  negatif,
  sousStock,
  surStock,
  negUnits,
  sousPpv,
  surPpv,
  onOpen,
}: StockAlertsSectionProps) {
  const t = useT();
  const cards: {
    tone: IconTone;
    title: string;
    rows: StockRow[];
    metricLabel: string;
    metric: ReactNode;
    Icon: typeof PackageX;
    dlgSubtitle: string;
  }[] = [
    {
      tone: "error",
      title: t("alertes.stockNegatif"),
      rows: negatif,
      metricLabel: t("alertes.unitesNegatif"),
      metric: formatQty(negUnits),
      Icon: AlertTriangle,
      dlgSubtitle: t("alertes.stockNegatifSub"),
    },
    {
      tone: "warning",
      title: t("alertes.sousStock"),
      rows: sousStock,
      metricLabel: t("kpi.ppvPotentiel"),
      metric: formatMAD(sousPpv),
      Icon: TrendingDown,
      dlgSubtitle: t("alertes.sousStockSub"),
    },
    {
      tone: "info",
      title: t("alertes.surStock"),
      rows: surStock,
      metricLabel: t("alertes.ppvImmobilise"),
      metric: formatMAD(surPpv),
      Icon: PackageOpen,
      dlgSubtitle: t("alertes.surStockSub"),
    },
  ];

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center gap-2.5">
        <PackageX className="size-5 text-warning" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t("alertes.stockSection")}</h2>
          <p className="text-sm text-muted-foreground">{t("alertes.stockSectionSub")}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((c) => {
          const count = c.rows.length;
          return (
            <KpiTile
              key={c.title}
              label={c.title}
              icon={<c.Icon className="size-5" />}
              iconTone={c.tone}
              badge={{
                label: (
                  <>
                    {formatQty(count)} {t("common.wProduits")}
                  </>
                ),
                tone: c.tone,
              }}
              disabled={count === 0}
              onClick={() =>
                onOpen({
                  title: c.title,
                  subtitle: c.dlgSubtitle,
                  products: c.rows,
                  columns: STOCK_COLUMNS,
                  defaultSortKey: "current_stock",
                })
              }
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{c.metricLabel}</span>
                <span className="font-mono text-xl font-bold tabular-nums text-foreground">{c.metric}</span>
              </div>
            </KpiTile>
          );
        })}
      </div>
    </section>
  );
}

// src/pages/alertes/_components/VentesSansAchatSection.tsx

interface VentesSansAchatSectionProps {
  data?: VentesSansAchatResponse;
  onOpen: (d: DialogDescriptor) => void;
}

function VentesSansAchatSection({ data, onOpen }: VentesSansAchatSectionProps) {
  const t = useT();
  const count = data?.count ?? 0;
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center gap-2.5">
        <FileWarning className="size-5 text-warning" />
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("alertes.dataTitle")}</h2>
          <p className="text-[13px] text-muted-foreground">{t("alertes.dataDesc")}</p>
        </div>
      </header>

      <div className="grid grid-cols-1">
        <KpiTile
          label={t("alertes.vsaTitle")}
          value={formatMAD(data?.total_ca ?? 0)}
          sub={
            <>
              {formatQty(count)} {t("common.wProduits")} · {formatQty(data?.total_units_sold ?? 0)}{" "}
              {t("common.wUnites")}
            </>
          }
          icon={<FileWarning className="size-5" />}
          iconTone="warning"
          badge={{
            label: (
              <>
                {formatQty(count)} {t("common.wProduits")}
              </>
            ),
            tone: "warning",
          }}
          disabled={count === 0}
          onClick={
            data && count > 0
              ? () =>
                  onOpen({
                    title: t("alertes.vsaTitle"),
                    subtitle: t("alertes.vsaSub"),
                    products: data.products,
                    columns: VENTES_SANS_ACHAT_COLUMNS,
                    defaultSortKey: "ca",
                  })
              : undefined
          }
        />
      </div>
    </section>
  );
}

const CATEGORY_KEY: Record<CategoryType, string> = {
  all: "category.mixte",
  pharmacie: "category.pharmacie",
  parapharmacie: "category.parapharmacie",
};

export default function AlertesPage() {
  const t = useT();
  const {
    category,
    closeDialog,
    counts,
    dateFrom,
    dateTo,
    dialog,
    isEmpty,
    isError,
    isLoading,
    margin,
    negUnits,
    negatif,
    openDialog,
    perem,
    peremptionCritical,
    refetchAll,
    resetAll,
    setCategory,
    setPeriod,
    sousPpv,
    sousStock,
    surPpv,
    surStock,
    totalAlerts,
    vsa,
  } = useAlertesPage();
  const categoryTypeOptions = useCategoryTypeOptions();

  const activeFilters: ActiveFilter[] = [
    dateFrom || dateTo
      ? {
          key: "dates",
          label: (
            <>
              {t("dashboard.periode")} {dateFrom || "…"} → {dateTo || "…"}
            </>
          ),
          onClear: () => setPeriod(null, null),
        }
      : null,
    category !== "all"
      ? {
          key: "cat",
          label: (
            <>
              {t("dashboard.categorieFilter")} {t(CATEGORY_KEY[category])}
            </>
          ),
          onClear: () => setCategory("all"),
        }
      : null,
  ].filter(Boolean) as ActiveFilter[];

  return (
    <Page title={t("nav.alertes")} subtitle={t("alertes.subtitle")}>
      <FilterBar<CategoryType>
        dateRange={{
          from: dateFrom || null,
          to: dateTo || null,
          onChange: (from, to) => setPeriod(from, to),
        }}
        segment={{
          value: category,
          onChange: setCategory,
          options: categoryTypeOptions,
        }}
        activeFilters={activeFilters}
        onResetAll={resetAll}
      />

      {isError ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-error/40 bg-error-subtle px-4 py-3 text-error">
          <span className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="size-4" />
            {t("alertes.loadError")}
          </span>
          <button
            type="button"
            onClick={refetchAll}
            className="rounded-md border border-error/40 bg-card px-3 py-1.5 text-[13px] font-semibold text-error"
          >
            {t("common.retry")}
          </button>
        </div>
      ) : isLoading ? (
        <AlertesSkeleton />
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 px-6 py-[72px] text-center dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <span className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
            <CheckCircle2 className="size-7" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-[17px] font-semibold text-foreground">{t("alertes.empty")}</h2>
            <p className="text-sm text-muted-foreground">{t("alertes.emptySub")}</p>
          </div>
        </div>
      ) : (
        <>
          <GlobalSummaryStrip
            totalAlerts={totalAlerts}
            marginNegative={counts.marginNeg}
            marginLow={counts.marginLow}
            peremptionCritical={peremptionCritical}
            toRestock={counts.sousStock}
            excessStock={counts.surStock}
          />
          <VentesSansAchatSection data={vsa} onOpen={openDialog} />
          <MarginAlertsSection data={margin} onOpen={openDialog} />
          <PeremptionsSection data={perem} onOpen={openDialog} />
          <StockAlertsSection
            negatif={negatif}
            sousStock={sousStock}
            surStock={surStock}
            negUnits={negUnits}
            sousPpv={sousPpv}
            surPpv={surPpv}
            onOpen={openDialog}
          />
        </>
      )}

      {/* shared detail dialog (portal) */}
      <AlertDetailDialog
        open={!!dialog}
        onClose={closeDialog}
        title={dialog?.title ?? ""}
        subtitle={dialog?.subtitle}
        products={dialog?.products ?? []}
        columns={dialog?.columns ?? []}
        defaultSortKey={dialog?.defaultSortKey ?? ""}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />
    </Page>
  );
}

/* ---- loading skeleton: 6 chips + 2/4/3 cards ---- */
function AlertesSkeleton() {
  const Card = () => <div className="h-32 animate-pulse rounded-xl border border-border bg-card" />;
  return (
    <>
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[54px] w-44 animate-pulse rounded-md border border-border bg-card" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} />
        ))}
      </div>
    </>
  );
}
