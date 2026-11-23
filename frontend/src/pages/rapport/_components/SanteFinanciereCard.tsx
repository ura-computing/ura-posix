import type { CategoryType, MargeSummary } from "@/types";
import { useT } from "@/i18n/I18nProvider";
import { KpiTile } from "@/_components/organisms/KpiTile";
import { formatMAD, formatPct } from "@/utils/format";
import { cn } from "@/utils/cn";
import { LabeledValue } from "@/_components/molecules/LabeledValue";

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

export function SanteFinanciereCard({ marge, tint = "all" }: { marge: MargeSummary; tint?: CategoryType }) {
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
        <LabeledValue label={t("kpi.margeBrute")} value={formatMAD(marge.marge_brute_dh)} />
        <LabeledValue label={t("kpi.margeNette")} value={formatMAD(marge.marge_nette_dh)} />
      </div>
      <div className="text-center font-mono text-xs text-muted-foreground">
        A+ (&gt;30%) · A (&gt;25%) · B+ (&gt;20%) · B (&gt;15%) · C (&gt;10%) · D (&gt;5%) · F (≤5%)
      </div>
    </KpiTile>
  );
}
