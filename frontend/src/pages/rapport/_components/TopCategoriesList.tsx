import { KpiTile } from "@/components/shared/KpiTile";
import { formatMAD } from "@/utils/format";
import type { CategoryType, TopCategoryRow } from "@/types";


const CHART_COLOR_VARS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)",
  "var(--chart-5)", "var(--chart-6)", "var(--chart-7)", "var(--chart-8)",
];


export function TopCategoriesList({ categories, tint = "all" }: { categories: TopCategoryRow[]; tint?: CategoryType }) {
  if (categories.length === 0) {
    return (
      <KpiTile label="Top catégories" tint={tint}>
        <p className="py-8 text-center text-sm text-muted-foreground">Aucune donnée disponible</p>
      </KpiTile>
    );
  }

  const max = Math.max(...categories.map((c) => c.total));
  const top = categories.slice(0, 5);

  return (
    <KpiTile label="Top catégories" tint={tint}>
      <div className="flex flex-col gap-3">
        {top.map((c, i) => {
          const color = CHART_COLOR_VARS[i % CHART_COLOR_VARS.length];
          const width = max ? Math.round((c.total / max) * 100) : 0;
          return (
            <div key={c.category} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 truncate text-sm">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
                  <span className="truncate text-foreground">{c.category}</span>
                </span>
                <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  {formatMAD(c.total)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-subtle">
                <span className="block h-full rounded-full" style={{ background: color, width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </KpiTile>
  );
}
