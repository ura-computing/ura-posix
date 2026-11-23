import { TrendingUp, ShieldCheck, TrendingDown, AlertTriangle } from "lucide-react";
import { ROUTES, type MarginAlertsResponse } from "@/types";
import type { CategoryType } from "@/types";
import { useT } from "@/i18n/I18nProvider";
import { KpiTile, type IconTone } from "@/_components/organisms/KpiTile";
import { formatQty, formatMAD } from "@/utils/format";

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
export function MarginAlertCards({
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
