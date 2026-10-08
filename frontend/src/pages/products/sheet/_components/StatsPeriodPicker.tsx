/** Statistiques period, on the tab row: 7 jours · 30 jours · 3 mois · 12 mois · Personnalisé
 *  (then the two date fields, filled with the dates shown). */
import { CategorySegment } from "@/_components/CategorySegment";
import { DateRangePopover } from "@/_components/filterBar";
import { useT } from "@/i18n/I18nProvider";

import type { StatsPeriod, StatsRange } from "../hooks";

const ACTIVE = "bg-primary text-primary-foreground shadow-sm";

export function StatsPeriodPicker({
  period,
  onPeriod,
  range,
  onRange,
}: {
  period: StatsPeriod;
  onPeriod: (period: StatsPeriod) => void;
  range: StatsRange;
  onRange: (from: string | null, to: string | null) => void;
}) {
  const t = useT();
  const options = [
    { value: "7d" as const, label: t("products.period7d"), activeBg: ACTIVE },
    { value: "30d" as const, label: t("products.period30d"), activeBg: ACTIVE },
    { value: "3m" as const, label: t("products.period3m"), activeBg: ACTIVE },
    { value: "12m" as const, label: t("products.period12m"), activeBg: ACTIVE },
    { value: "custom" as const, label: t("products.periodCustom"), activeBg: ACTIVE },
  ];
  return (
    <>
      {period === "custom" && (
        <DateRangePopover
          from={range.from}
          to={range.to}
          onChange={onRange}
          showPresets={false}
          className="print:hidden"
        />
      )}
      {/* Printed: the dates are in the line « Du … au … » under the tabs. */}
      <CategorySegment value={period} options={options} onChange={onPeriod} className="print:hidden" />
    </>
  );
}
