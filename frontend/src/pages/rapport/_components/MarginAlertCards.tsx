import { ShieldCheck, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";

import { KpiTile, type IconTone } from "@/components/shared/KpiTile";
import { formatMAD, formatQty } from "@/utils/format";
import { useT } from "@/i18n/I18nProvider";
import { ROUTES, type CategoryType, type MarginAlertsResponse } from "@/types";


interface BracketDef {
  key:       keyof MarginAlertsResponse;
  titleKey:  string;
  Icon:      typeof AlertTriangle;
  tone:      IconTone;
  showLoss?: boolean;   // negative bracket shows total loss instead of CA concerné
}

const BRACKETS: BracketDef[] = [
  { key: "negative",  titleKey: "rapportAdmin.margeNegative", Icon: TrendingDown,  tone: "error",   showLoss: true },
  { key: "low",       titleKey: "rapportAdmin.marge0a10",     Icon: AlertTriangle, tone: "warning" },
  { key: "high",      titleKey: "rapportAdmin.marge60a90",    Icon: TrendingUp,    tone: "info" },
  { key: "very_high", titleKey: "rapportAdmin.margeSup90",    Icon: ShieldCheck,   tone: "success" },
];


export function MarginAlertCards({ data, tint = "all" }: { data: MarginAlertsResponse; tint?: CategoryType }) {
  const t = useT();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {BRACKETS.map((b) => {
        const bucket = data[b.key];
        const subLabel = b.showLoss ? t("rapportAdmin.perteTotale") : t("rapportAdmin.caConcerne");
        const subValue = b.showLoss
          ? formatMAD(Math.abs(bucket.total_margin_dh))
          : formatMAD(bucket.total_ca);
        return (
          <KpiTile
            key={b.key}
            href={ROUTES.ALERTES}
            label={t(b.titleKey)}
            value={subValue}
            sub={subLabel}
            icon={<b.Icon className="size-5" />}
            iconTone={b.tone}
            badge={{ label: <>{formatQty(bucket.count)} {t("rapportAdmin.produitsUnit")}</>, tone: b.tone }}
            tint={tint}
          />
        );
      })}
    </div>
  );
}
