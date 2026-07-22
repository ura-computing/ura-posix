/** Per-pharmacy body for /rapport's admin view. Replaces the older
 *  `RapportSections` (KPIs / margin-alerts / stock summary) with a denser
 *  layout: 2a Indicateurs clés · 2b Indicateurs avancés · 2c TVA · 2d Marge
 *  · 2e Analyse de marge tabs+table · 2f Évolution mensuelle bars · 2g Top
 *  catégories. Moved from the old /admin/stats page when we merged the two
 *  surfaces into /rapport. */
import {
  Banknote, BarChart3, Building2, CalendarCheck, CalendarX, Coins,
  Package, Receipt, ShoppingCart, TrendingUp, Wallet,
} from "lucide-react";

import { KpiTile } from "@/components/shared/KpiTile";
import { useT } from "@/i18n/I18nProvider";
import type { MargeMode, StatsResponse } from "@/types";

import { AdminMonthlyTrendChart } from "./AdminMonthlyTrendChart";
import { MarginAnalysisTable } from "./MarginAnalysisTable";


// ─── Formatting helpers ───────────────────────────────────────────────────

const fmtCount = (n: number): string => n.toLocaleString("fr-FR");

const fmtMad = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MAD";
};

const fmtPct = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return "—";
  return (n > 0 ? "+" : "") + n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " %";
};

const fmtDate = (s: string | undefined): string => s ?? "—";


const TOP_CAT_COLORS = ["#0E9E8C", "#1D6FB8", "#4F56C9", "#B7791F", "#D6447B"];


export interface AdminPharmacyBodyProps {
  stats:          StatsResponse;
  pharmacyLabel:  string;
  categoryType:   "all" | "pharmacie" | "parapharmacie";
  marginMode:     MargeMode;
  onMarginMode:   (m: MargeMode) => void;
  marginRows:     Record<string, unknown>[];
  marginLoading:  boolean;
  subtitleDates:  string;
}


export function AdminPharmacyBody({
  stats, pharmacyLabel, categoryType, marginMode, onMarginMode, marginRows, marginLoading, subtitleDates,
}: AdminPharmacyBodyProps) {
  const t = useT();
  const catLabel = categoryType === "pharmacie" ? t("category.pharmacie")
    : categoryType === "parapharmacie" ? t("category.parapharmacie")
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
            value={fmtMad(rev)}
            sub={prevRev > 0 ? t("rapportAdmin.vsPeriodePrecedente") : undefined}
            delta={prevRev > 0 ? { value: revDelta } : null}
            icon={<TrendingUp className="size-4.5" />}
            iconTone="primary"
          />
          <KpiTile
            label={t("rapportAdmin.achatsTotaux")}
            value={fmtMad(stats.kpis.achats_total)}
            icon={<ShoppingCart className="size-4.5" />}
            iconTone="slate"
          />
          <KpiTile
            label={t("rapportAdmin.transactionsVentes")}
            value={fmtCount(stats.kpis.ventes_count)}
            sub={t("rapportAdmin.operationsVente")}
            icon={<BarChart3 className="size-4.5" />}
            iconTone="slate"
          />
          <KpiTile
            label={t("rapportAdmin.transactionsAchats")}
            value={fmtCount(stats.kpis.achats_count)}
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
            value={fmtMad(stats.advanced_kpis.ticket_moyen)}
            sub={t("rapportAdmin.parTransaction")}
            icon={<Receipt className="size-4.5" />}
            iconTone="slate"
          />
          <KpiTile
            label={t("rapportAdmin.venteMoyenneJour")}
            value={fmtMad(stats.advanced_kpis.vente_moyenne_par_jour)}
            icon={<BarChart3 className="size-4.5" />}
            iconTone="slate"
          />
          <KpiTile
            label={t("rapportAdmin.meilleureJourneeDh")}
            value={fmtMad(stats.advanced_kpis.best_day_dh?.total)}
            sub={fmtDate(stats.advanced_kpis.best_day_dh?.date)}
            icon={<CalendarCheck className="size-4.5" />}
            iconTone="emerald"
          />
          <KpiTile
            label={t("rapportAdmin.meilleureJourneeOpe")}
            value={stats.advanced_kpis.best_day_count ? `${fmtCount(stats.advanced_kpis.best_day_count.count)} ${t("rapportAdmin.opeUnit")}` : "—"}
            sub={fmtDate(stats.advanced_kpis.best_day_count?.date)}
            icon={<CalendarCheck className="size-4.5" />}
            iconTone="emerald"
          />
          <KpiTile
            label={t("rapportAdmin.moinsBonneJourneeDh")}
            value={fmtMad(stats.advanced_kpis.worst_day_dh?.total)}
            sub={fmtDate(stats.advanced_kpis.worst_day_dh?.date)}
            icon={<CalendarX className="size-4.5" />}
            iconTone="rose"
          />
          <KpiTile
            label={t("rapportAdmin.moinsBonneJourneeOpe")}
            value={stats.advanced_kpis.worst_day_count ? `${fmtCount(stats.advanced_kpis.worst_day_count.count)} ${t("rapportAdmin.opeUnit")}` : "—"}
            sub={fmtDate(stats.advanced_kpis.worst_day_count?.date)}
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
            value={fmtMad(stats.tva.tva_encaissee)}
            icon={<Coins className="size-4.5" />}
            iconTone="info"
          />
          <KpiTile
            label={t("rapportAdmin.tvaPayee")}
            value={fmtMad(stats.tva.tva_payee)}
            icon={<Banknote className="size-4.5" />}
            iconTone="warning"
          />
          <KpiTile
            label={t("rapportAdmin.tvaADeclarer")}
            value={fmtMad(stats.tva.tva_a_declarer)}
            icon={<Wallet className="size-4.5" />}
            iconTone="primary"
            badge={{ label: t("rapportAdmin.estimation"), tone: "primary" }}
          />
        </div>
      </section>

      {/* 2d — Marge */}
      <section className="flex flex-col gap-3.5">
        <h2 className="text-base font-bold tracking-tight text-foreground">{t("rapportAdmin.marge")}</h2>
        <div className="grid grid-cols-1 divide-y divide-border rounded-2xl border border-border bg-card shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <MargeCell label={t("col.margePct")}                value={fmtPct(stats.marge.marge_pct)}      sub={t("rapportAdmin.moyennePonderee")} />
          <MargeCell label={t("rapportAdmin.margeBruteDh")}   value={fmtMad(stats.marge.marge_brute_dh)} sub={t("rapportAdmin.avantCharges")} />
          <MargeCell label={t("rapportAdmin.margeNetteDh")}   value={fmtMad(stats.marge.marge_nette_dh)} sub={t("rapportAdmin.apresCharges")}  emphasis />
        </div>
      </section>

      {/* 2e — Analyse de marge */}
      <MarginAnalysisTable
        mode={marginMode}
        onModeChange={onMarginMode}
        rows={marginRows}
        isLoading={marginLoading}
      />

      {/* 2f — Évolution mensuelle */}
      <AdminMonthlyTrendChart data={stats.monthly_trend} subtitle={subtitleDates} />

      {/* 2g — Top catégories */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
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
                    <span className="font-mono text-[13px] font-semibold tabular-nums">{fmtMad(c.total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-subtle">
                    <span className="block h-full rounded-full" style={{ width: `${(c.total / max) * 100}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


function MargeCell({ label, value, sub, emphasis }: { label: string; value: string; sub: string; emphasis?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 p-5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`font-mono text-2xl font-bold tabular-nums tracking-tight ${emphasis ? "text-success" : "text-foreground"}`}>
        {value}
      </span>
      <span className="text-[11.5px] text-muted-foreground">{sub}</span>
    </div>
  );
}
