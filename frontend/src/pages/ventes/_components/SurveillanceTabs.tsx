import { formatQty } from "@/utils/format";
import type { SurveillanceTab, VentesSurveillanceCounts } from "@/types";
import { SURVEILLANCE_TABS } from "@/types";


interface TabDef {
  key:    SurveillanceTab;
  label:  string;
  field:  keyof VentesSurveillanceCounts;
  /** Tailwind colour class for the indicator dot only. The chip itself stays neutral. */
  dot:    string;
}

const TABS: TabDef[] = [
  { key: SURVEILLANCE_TABS.ALL_FLAGGED,    label: "Ventes à surveiller", field: "all_flagged",    dot: "bg-rose-500"   },
  { key: SURVEILLANCE_TABS.MARGE_NEGATIVE, label: "Marge négative",      field: "marge_negative", dot: "bg-red-500"    },
  { key: SURVEILLANCE_TABS.MARGE_LOW,      label: "Marge < 10 %",        field: "marge_low",      dot: "bg-orange-500" },
  { key: SURVEILLANCE_TABS.REMISES_HIGH,   label: "Remise > 20 %",       field: "remises_high",   dot: "bg-pink-500"   },
];


/** Quiet quick-filter chips. Neutral card bg + colored dot as semantic indicator.
 *  Click toggles the filter. Active = filled primary. Matches Rapport's calm density. */
export function SurveillanceTabs({
  active, counts, onSelect,
}: {
  active:   SurveillanceTab | null;
  counts:   VentesSurveillanceCounts | undefined;
  onSelect: (tab: SurveillanceTab | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {TABS.map((t) => {
        const isActive = active === t.key;
        const n = counts?.[t.field] ?? 0;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onSelect(isActive ? null : t.key)}
            className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors ${
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-surface-subtle"
            }`}
          >
            <span className={`size-2 rounded-full ${t.dot} ${isActive ? "ring-2 ring-primary-foreground/40" : ""}`} aria-hidden />
            <span>{t.label}</span>
            <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1 font-mono text-xs tabular-nums ${
              isActive ? "bg-primary-foreground/15 text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {formatQty(n)}
            </span>
          </button>
        );
      })}
    </div>
  );
}