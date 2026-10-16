/** Statistiques dates, on the tab row: the same picker as Ventes / Achats (2 date fields, the
 *  calendar, « Périodes rapides »). */
import { DateRangePopover } from "@/_components/filterBar";

import type { StatsRange } from "../hooks";

export function StatsPeriodPicker({
  range,
  onRange,
}: {
  range: StatsRange;
  onRange: (from: string | null, to: string | null) => void;
}) {
  return <DateRangePopover from={range.from} to={range.to} onChange={onRange} />;
}
