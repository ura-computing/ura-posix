// src/pages/stock/_components/AbcdAnalysisCard.tsx
import { KpiTile } from "@/components/shared/KpiTile";
import { NeedleGauge } from "@/components/shared/NeedleGauge";
import { cn } from "@/utils/cn";
import { formatQty } from "@/utils/format";
import type { AbcdClass } from "@/types";

import { ABCD_COLORS, ABCD_ORDER, abcdFontSize } from "../_constants";
import { useT } from "@/i18n/I18nProvider";


export interface AbcdAnalysisCardProps {
  /** Full distribution from the FULL fetch (only non-zero classes present). */
  distribution:    Record<string, number>;
  totalReferences: number;
  /** 0-10 health score (computed in useStockPage as ideal / non-inconnu × 10). */
  health:          number;
  activeClass:     AbcdClass | null;
  onSelectClass:   (c: AbcdClass) => void;
}


export function AbcdAnalysisCard({
  distribution,
  totalReferences,
  health,
  activeClass,
  onSelectClass,
}: AbcdAnalysisCardProps) {
  const t = useT();
  const scoreLabel = health.toFixed(1).replace(".", ",");

  return (
    <KpiTile label={t("stock.abcdTitle")}>
      <div className="grid items-center gap-6 md:grid-cols-[1.5fr_1fr]">
        {/* LEFT — 8 class circles */}
        <div className="grid grid-cols-4 gap-x-2 gap-y-3.5">
          {ABCD_ORDER.map((k) => {
            const count = distribution[k] ?? 0;
            const pct = totalReferences > 0 ? Math.round((count / totalReferences) * 100) : 0;
            const active = activeClass === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => onSelectClass(k)}
                aria-pressed={active}
                aria-label={`Classe ${k} : ${count} références`}
                className="group flex flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    "flex size-16 items-center justify-center rounded-full font-bold leading-none text-white transition-transform duration-150",
                    "group-hover:scale-105 cursor-pointer",
                    active && "scale-105 ring-2 ring-primary",
                  )}
                  style={{
                    background: ABCD_COLORS[k],
                    fontSize: abcdFontSize(k),
                    boxShadow: active
                      ? "0 0 0 2px var(--color-card), 0 0 0 4px var(--color-primary)"
                      : undefined,
                  }}
                >
                  {k}
                </span>
                <span className="font-mono text-xl font-bold tabular-nums text-foreground">
                  {formatQty(count)}
                </span>
                <span className="-mt-0.5 whitespace-nowrap font-mono text-xs text-muted-foreground">
                  {pct} %
                </span>
              </button>
            );
          })}
        </div>

        {/* RIGHT — Indice de santé du stock (uses the shared NeedleGauge — same gauge style as Achats supplier-mix) */}
        <div className="flex flex-col items-center justify-center gap-1 md:border-l md:border-border md:pl-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Indice de santé
          </span>
          <NeedleGauge value={health * 10} />
          <div className="-mt-2 flex items-baseline gap-1 whitespace-nowrap">
            <span className="font-mono text-3xl font-bold tabular-nums text-foreground">
              {scoreLabel}
            </span>
            <span className="font-mono text-base font-semibold text-muted-foreground">/ 10</span>
          </div>
          {/* Explanation: pharmacists need to know what the needle measures */}
          <p className="mt-0.5 max-w-[220px] text-center text-xs leading-snug text-muted-foreground">
            Part des produits en couverture idéale <span className="whitespace-nowrap">(46-60 j)</span> sur ceux qui ont des ventes.
          </p>
          <span className="mt-0.5 text-sm text-muted-foreground">
            <span className="font-mono tabular-nums text-foreground">{formatQty(totalReferences)}</span> références
          </span>
        </div>
      </div>
    </KpiTile>
  );
}