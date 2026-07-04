import { KpiTile } from "@/components/shared/KpiTile";
import { formatMAD } from "@/utils/format";
import type { CategoryType, TopCategoryRow } from "@/types";


/**
 * Section 4 — donut chart for the CA breakdown by category.
 *
 * Hand-rolled SVG (~80 lines) so we don't pull Recharts for a single chart.
 * Renders up to 8 segments using the --chart-1 … --chart-8 vars locked in tokens.css.
 * If more than 8 categories are passed in, the 8th segment is "Autres" (sum of overflow).
 * The total CA shown in the center is the sum of ALL segments (including Autres).
 *
 * Layout: left = donut (sized to the parent container, max 280px square);
 *         right = legend with the same colors + per-category MAD totals + share %.
 */

const PALETTE = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)",
  "var(--chart-5)", "var(--chart-6)", "var(--chart-7)", "var(--chart-8)",
];

const SIZE   = 220;             // SVG viewport (square)
const CENTER = SIZE / 2;
const OUTER  = 96;              // outer radius
const INNER  = 70;              // inner radius (donut hole width = OUTER-INNER ≈ 26px)
const GAP    = 0.012;           // gap between segments in radians (≈ 0.7°)


export function CategoriesDonut({ categories, tint = "all" }: { categories: TopCategoryRow[]; tint?: CategoryType }) {
  if (categories.length === 0) {
    return (
      <KpiTile label="Répartition du CA" tint={tint}>
        <p className="py-12 text-center text-sm text-muted-foreground">Aucune donnée disponible.</p>
      </KpiTile>
    );
  }

  // Take top 7, collapse overflow into "Autres" (8th slot).
  const top7   = categories.slice(0, 7);
  const rest   = categories.slice(7);
  const others = rest.reduce((s, c) => s + c.total, 0);
  const segments = others > 0
    ? [...top7, { category: "Autres", total: others, marge_pct: null }]
    : top7;
  const total = segments.reduce((s, c) => s + c.total, 0);

  // Build SVG arc paths around the circle, starting at 12 o'clock.
  // Use reduce to thread the cursor angle through segments without mutating a
  // closure variable (React Compiler rejects mid-render reassignment).
  const arcs = segments.reduce<{ start: number; out: { seg: typeof segments[number]; i: number; share: number; path: string }[] }>(
    (acc, seg, i) => {
      const share = total ? seg.total / total : 0;
      const sweep = share * Math.PI * 2 - GAP;
      const a0    = acc.start;
      const a1    = acc.start + sweep;
      acc.out.push({ seg, i, share, path: arcPath(a0, a1) });
      return { start: a1 + GAP, out: acc.out };
    },
    { start: -Math.PI / 2, out: [] },
  ).out;

  return (
    <KpiTile label="Répartition du CA" tint={tint}>
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="shrink-0" aria-hidden>
          {arcs.map(({ seg, i, path }) => (
            <path key={seg.category} d={path} fill={PALETTE[i % PALETTE.length]} />
          ))}
          {/* center: total CA */}
          <text x={CENTER} y={CENTER - 6} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)" fontFamily="Inter, sans-serif">
            Total
          </text>
          <text x={CENTER} y={CENTER + 12} textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--foreground)" fontFamily="JetBrains Mono, monospace">
            {formatMAD(total)}
          </text>
        </svg>

        <ul className="flex flex-1 flex-col gap-2">
          {arcs.map(({ seg, i, share }) => (
            <li key={seg.category} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                <span className="truncate text-foreground">{seg.category}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {(share * 100).toFixed(1)} %
                </span>
                <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  {formatMAD(seg.total)}
                </span>
              </span>
            </li>
          ))}
        </ul>
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