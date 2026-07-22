import { KpiTile } from "@/components/shared/KpiTile";
import { formatNumStr, formatPct } from "@/utils/format";
import type { CategoryType, TopCategoryRow } from "@/types";
import { useT } from "@/i18n/I18nProvider";


/**
 * Section 4 — "Répartition du CA" : one card, donut (left) + category table (right).
 *
 * Hand-rolled SVG donut (no chart lib) using the --chart-1 … --chart-8 vars from
 * tokens.css, cycled by category index so the table dot always matches its slice.
 * The table lists ALL categories (scrolls if long) with columns:
 *   Catégorie · CA (MAD) · %   (share of total CA) · Part (proportional bar).
 * Center of the donut = total CA over every category.
 */

const PALETTE = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)",
  "var(--chart-5)", "var(--chart-6)", "var(--chart-7)", "var(--chart-8)",
];

const SIZE   = 220;             // SVG viewport (square)
const CENTER = SIZE / 2;
const OUTER  = 96;              // outer radius
const INNER  = 70;              // inner radius (donut hole)
const GAP    = 0.012;           // gap between segments in radians (≈ 0.7°)


export function CategoriesDonut({ categories, tint = "all" }: { categories: TopCategoryRow[]; tint?: CategoryType }) {
  const t = useT();
  if (categories.length === 0) {
    return (
      <KpiTile label={t("kpi.repartitionCA")} tint={tint}>
        <p className="py-12 text-center text-sm text-muted-foreground">{t("kpi.aucuneDonnee")}</p>
      </KpiTile>
    );
  }

  const total   = categories.reduce((s, c) => s + c.total, 0);
  const maxTotal = Math.max(...categories.map((c) => c.total), 1);

  // Build donut arcs around the circle (start at 12 o'clock). Slices smaller than
  // the gap can't be drawn, so we skip their path but still advance the cursor —
  // they remain in the table with a matching colour. Reduce (not a mutated
  // closure) keeps the React Compiler happy.
  const arcs = categories.reduce<{ start: number; out: { i: number; draw: boolean; path: string }[] }>(
    (acc, c, i) => {
      const share = total ? c.total / total : 0;
      const full  = share * Math.PI * 2;
      const sweep = Math.max(full - GAP, 0);
      const a0    = acc.start;
      acc.out.push({ i, draw: sweep > 0.003, path: arcPath(a0, a0 + sweep) });
      return { start: a0 + full, out: acc.out };
    },
    { start: -Math.PI / 2, out: [] },
  ).out;

  return (
    <KpiTile label={t("kpi.repartitionCA")} tint={tint}>
      <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-center">
        {/* Donut */}
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="shrink-0" aria-hidden>
          {arcs.map(({ i, draw, path }) => (draw ? <path key={i} d={path} fill={PALETTE[i % PALETTE.length]} /> : null))}
          <text x={CENTER} y={CENTER - 4} textAnchor="middle" fontSize="15" fontWeight="600" fill="var(--foreground)" fontFamily="JetBrains Mono, monospace">
            {formatNumStr(total, 2)}
          </text>
          <text x={CENTER} y={CENTER + 15} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)" fontFamily="Inter, sans-serif">
            CA Total
          </text>
        </svg>

        {/* Table */}
        <div className="min-w-0 flex-1 self-stretch">
          <div className="max-h-[300px] w-full overflow-y-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 text-left font-semibold">{t("kpi.donutCategorie")}</th>
                  <th className="px-3 py-2 text-left font-semibold">CA (MAD)</th>
                  <th className="px-3 py-2 text-left font-semibold">{t("kpi.donutMarge")}</th>
                  <th className="px-3 py-2 text-left font-semibold">%</th>
                  <th className="w-32 py-2 pl-3 text-left font-semibold">{t("kpi.donutPart")}</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c, i) => {
                  const color = PALETTE[i % PALETTE.length];
                  const share = total ? c.total / total : 0;
                  const barW  = Math.max((c.total / maxTotal) * 100, 2);
                  return (
                    <tr key={c.category} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-3">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
                          <span className="truncate text-foreground">{c.category}</span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono font-semibold tabular-nums text-foreground">
                        {formatNumStr(c.total, 2)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono tabular-nums text-foreground">
                        {c.marge_pct != null ? formatPct(c.marge_pct) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono font-semibold tabular-nums text-foreground">
                        {formatPct(share * 100)}
                      </td>
                      <td className="py-2.5 pl-3">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                          <div className="h-full rounded-full" style={{ width: `${barW}%`, background: color }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </KpiTile>
  );
}


/** SVG path for an annular sector between angles a0 → a1 (clockwise). */
function arcPath(a0: number, a1: number): string {
  const x0o = CENTER + OUTER * Math.cos(a0);
  const y0o = CENTER + OUTER * Math.sin(a0);
  const x1o = CENTER + OUTER * Math.cos(a1);
  const y1o = CENTER + OUTER * Math.sin(a1);
  const x0i = CENTER + INNER * Math.cos(a1);
  const y0i = CENTER + INNER * Math.sin(a1);
  const x1i = CENTER + INNER * Math.cos(a0);
  const y1i = CENTER + INNER * Math.sin(a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return [
    `M ${x0o.toFixed(2)} ${y0o.toFixed(2)}`,
    `A ${OUTER} ${OUTER} 0 ${large} 1 ${x1o.toFixed(2)} ${y1o.toFixed(2)}`,
    `L ${x0i.toFixed(2)} ${y0i.toFixed(2)}`,
    `A ${INNER} ${INNER} 0 ${large} 0 ${x1i.toFixed(2)} ${y1i.toFixed(2)}`,
    "Z",
  ].join(" ");
}
