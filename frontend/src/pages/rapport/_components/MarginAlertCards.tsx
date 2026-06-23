import { ShieldCheck, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";

import { KpiTile, type IconTone } from "@/components/shared/KpiTile";
import { formatMAD, formatQty } from "@/utils/format";
import { ROUTES, type MarginAlertsResponse } from "@/types";


interface BracketDef {
  key:       keyof MarginAlertsResponse;
  title:     string;
  Icon:      typeof AlertTriangle;
  tone:      IconTone;
  showLoss?: boolean;   // negative bracket shows total loss instead of CA concerné
}

const BRACKETS: BracketDef[] = [
  { key: "negative",  title: "Marge négative",          Icon: TrendingDown,  tone: "error",   showLoss: true },
  { key: "low",       title: "Marge 0 % à 10 %",        Icon: AlertTriangle, tone: "warning" },
  { key: "high",      title: "Marge 60 % à 89,9 %",     Icon: TrendingUp,    tone: "info" },
  { key: "very_high", title: "Marge supérieure à 90 %", Icon: ShieldCheck,   tone: "success" },
];


export function MarginAlertCards({ data }: { data: MarginAlertsResponse }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {BRACKETS.map((b) => {
        const bucket = data[b.key];
        const subLabel = b.showLoss ? "Perte totale" : "CA concerné";
        const subValue = b.showLoss
          ? formatMAD(Math.abs(bucket.total_margin_dh))
          : formatMAD(bucket.total_ca);
        return (
          <KpiTile
            key={b.key}
            href={ROUTES.ALERTES}
            label={b.title}
            value={subValue}
            sub={subLabel}
            icon={<b.Icon className="size-5" />}
            iconTone={b.tone}
            badge={{ label: <>{formatQty(bucket.count)} produits</>, tone: b.tone }}
          />
        );
      })}
    </div>
  );
}
