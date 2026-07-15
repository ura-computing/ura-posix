import { BarChart3, Receipt, Wallet } from "lucide-react";

import { formatMAD } from "@/utils/format";
import type { StatsResponse } from "@/types";


/**
 * 3 KPI cards for /comptabilité — each card groups several related metrics:
 *  - Card 1 (CA): ventes total + marge % + TVA encaissée
 *  - Card 2 (Achats): total + count + TVA payée
 *  - Card 3 (Bilan): Résultat (marge brute) + TVA à déclarer + solde TVA année
 *
 * Mirrors the old apcm-pharma layout. Pure presentational — caller passes
 * the StatsResponse and we render values + formatting.
 */
export function KpiCards({ stats }: { stats: StatsResponse }) {
  const ca       = stats.kpis.ventes_total;
  const achats   = stats.kpis.achats_total;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <Card icon={<Wallet className="size-5" />} title="Chiffre d'Affaires" tone="primary">
        <Row label="Ventes total"   value={formatMAD(ca)} hero />
        <Row label="Marge"           value={`${stats.marge.marge_pct.toFixed(3)} %`} />
        <Row label="TVA encaissée"   value={formatMAD(stats.tva.tva_encaissee)} />
      </Card>

      <Card icon={<Receipt className="size-5" />} title="Achats" tone="warning">
        <Row label="Total achats"    value={formatMAD(achats)} hero />
        <Row label="Opérations"      value={String(stats.kpis.achats_count)} />
        <Row label="TVA payée"       value={formatMAD(stats.tva.tva_payee)} />
      </Card>

      <Card icon={<BarChart3 className="size-5" />} title="Bilan & TVA" tone="info">
        <Row label="Résultat (marge brute)" value={formatMAD(stats.marge.marge_brute_dh)} hero />
        <Row label="TVA à déclarer"      value={formatMAD(stats.tva.tva_a_declarer)} />
        <Row label={`Solde TVA ${new Date().getFullYear()}`} value={formatMAD(stats.tva.tva_a_declarer)} subtle />
      </Card>
    </div>
  );
}


function Card({
  icon, title, tone, children,
}: { icon: React.ReactNode; title: string; tone: "primary" | "warning" | "info"; children: React.ReactNode }) {
  const tint = tone === "primary" ? "text-primary" : tone === "warning" ? "text-warning" : "text-info";
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-base font-semibold text-foreground">
        <span className={tint}>{icon}</span>
        {title}
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}


function Row({ label, value, hero, subtle }: { label: React.ReactNode; value: React.ReactNode; hero?: boolean; subtle?: boolean }) {
  if (hero) {
    return (
      <div className="flex flex-col gap-0.5 pb-2 border-b border-border">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="font-mono text-3xl font-semibold tabular-nums text-foreground">{value}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3 text-base">
      <span className={subtle ? "text-sm text-muted-foreground" : "text-muted-foreground"}>{label}</span>
      <span className={`font-mono tabular-nums ${subtle ? "text-sm text-muted-foreground" : "font-semibold text-foreground"}`}>{value}</span>
    </div>
  );
}
