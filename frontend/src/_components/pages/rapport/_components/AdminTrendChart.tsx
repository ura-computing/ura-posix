import type { MonthlyTrendPoint } from "@/types/stats";
import { useT } from "@/i18n/I18nProvider";
import { Card } from "@/_components/atoms/Card";

/** Section 2f — dual-bar trend chart. Ventes (info-blue) + Achats (muted) per
 *  month. Pure CSS bars — no chart lib dep. Reused styling vocabulary
 *  ("var(--info)" / "var(--muted-foreground)") so it tracks the theme. */

export function AdminMonthlyTrendChart({ data, subtitle }: { data: MonthlyTrendPoint[]; subtitle: string }) {
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
