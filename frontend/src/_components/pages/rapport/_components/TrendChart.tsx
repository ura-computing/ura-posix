import { useState, useLayoutEffect, useRef } from "react";
import type { CategoryType, MonthlyTrendPoint, TrendGranularity } from "@/types/stats";
import { useT } from "@/i18n/I18nProvider";
import { KpiTile } from "@/_components/organisms/KpiTile";
import { formatMAD, formatNumStr } from "@/utils/format";
import { clamp, niceScale, smoothPath } from "@/utils/chart";
import { AnimatePresence, motion } from "framer-motion";

const H = 264;

const PAD_T = 18;

const PAD_B = 34;

const PAD_R = 18;

const MIN_W = 320;

// Title + count-unit word (singular, plural) per granularity. The backend picks
// the granularity from the selected period length (see _trend_granularity).
const TITLE: Record<TrendGranularity, string> = {
  week: "trend.week",
  month: "trend.month",
  semester: "trend.semester",
  year: "trend.year",
};

const UNIT_KEY: Record<TrendGranularity, string> = {
  week: "trend.uWeek",
  month: "trend.uMonth",
  semester: "trend.uSemester",
  year: "trend.uYear",
};

export function TrendChart({
  points,
  granularity = "month",
  tint = "all",
}: {
  points: MonthlyTrendPoint[];
  granularity?: TrendGranularity;
  tint?: CategoryType;
}) {
  const t = useT();
  const title = t(TITLE[granularity] ?? TITLE.month);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width ?? 0;
      if (cw > 0) setW(cw);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (points.length === 0) {
    return (
      <KpiTile label={title} tint={tint}>
        <p className="py-14 text-center text-sm text-muted-foreground">{t("rapportAdmin.aucuneDonneePeriode")}</p>
      </KpiTile>
    );
  }

  const single = points.length === 1;
  const rawMax = Math.max(...points.map((p) => Math.max(p.ventes, p.achats)), 1);
  const { niceMax, ticks } = niceScale(rawMax, 4);
  const yLabels = ticks.map((t) => formatNumStr(t));

  // Geometry in real pixels (1 svg unit = 1 px) → crisp, undistorted text.
  const PAD_L = 14 + Math.max(...yLabels.map((s) => s.length)) * 7;
  const W = Math.max(MIN_W, w);
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const stepX = points.length > 1 ? plotW / (points.length - 1) : 0;
  const xAt = (i: number) => (single ? PAD_L + plotW / 2 : PAD_L + i * stepX);
  const yAt = (v: number) => PAD_T + plotH - (v / niceMax) * plotH;
  const baseY = PAD_T + plotH;

  const vPts = points.map((p, i) => ({ x: xAt(i), y: yAt(p.ventes) }));
  const aPts = points.map((p, i) => ({ x: xAt(i), y: yAt(p.achats) }));
  const vLine = smoothPath(vPts);
  const aLine = smoothPath(aPts);
  const areaTail = (pts: { x: number; y: number }[]) =>
    `${smoothPath(pts)} L${pts[pts.length - 1].x},${baseY} L${pts[0].x},${baseY} Z`;

  const unitLabel = t(UNIT_KEY[granularity] ?? UNIT_KEY.month);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / (rect.width || W));
    const idx = single ? 0 : Math.round((x - PAD_L) / (stepX || 1));
    setHover(clamp(idx, 0, points.length - 1));
  };

  const hi = hover;
  const hx = hi != null ? xAt(hi) : 0;
  const drawKey = `${granularity}:${points.length}:${points[0].label}`;

  return (
    <KpiTile
      label={title}
      sub={t("trend.rangeSub", { from: points[0].label, to: points[points.length - 1].label })}
      tint={tint}
    >
      <div className="flex justify-end">
        <Legend />
      </div>

      <div ref={wrapRef} className="relative w-full">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="block touch-none select-none"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="trend-ventes" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--chart-1)" stopOpacity="0.30" />
              <stop offset="1" stopColor="var(--chart-1)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="trend-achats" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--chart-3)" stopOpacity="0.18" />
              <stop offset="1" stopColor="var(--chart-3)" stopOpacity="0" />
            </linearGradient>
            <filter id="trend-glow" x="-20%" y="-40%" width="140%" height="180%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>

          {/* y-axis: round full-number ticks + gridlines */}
          {ticks.map((tk, i) => {
            const y = yAt(tk);
            const interior = i > 0 && i < ticks.length - 1;
            return (
              <g key={i}>
                {interior && (
                  <line
                    x1={PAD_L}
                    y1={y}
                    x2={W - PAD_R}
                    y2={y}
                    stroke="var(--chart-grid)"
                    strokeWidth="1"
                    strokeDasharray="3 4"
                  />
                )}
                <text
                  x={PAD_L - 10}
                  y={y + 3.5}
                  fontSize="11"
                  fontFamily="JetBrains Mono, monospace"
                  fill="var(--chart-axis)"
                  textAnchor="end"
                >
                  {yLabels[i]}
                </text>
              </g>
            );
          })}

          <g key={drawKey}>
            {!single && (
              <>
                <motion.path
                  d={areaTail(aPts)}
                  fill="url(#trend-achats)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                />
                <motion.path
                  d={areaTail(vPts)}
                  fill="url(#trend-ventes)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                />
                {/* soft glow under the ventes line */}
                <path
                  d={vLine}
                  fill="none"
                  stroke="var(--chart-1)"
                  strokeWidth="4"
                  strokeOpacity="0.35"
                  filter="url(#trend-glow)"
                />
                <motion.path
                  d={aLine}
                  fill="none"
                  stroke="var(--chart-3)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.7, ease: "easeInOut" }}
                />
                <motion.path
                  d={vLine}
                  fill="none"
                  stroke="var(--chart-1)"
                  strokeWidth="2.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.7, ease: "easeInOut" }}
                />
              </>
            )}
          </g>

          {/* single-bucket fallback: dots so it's never blank */}
          {single && (
            <>
              <circle cx={xAt(0)} cy={yAt(points[0].achats)} r="4.5" fill="var(--chart-3)" />
              <circle cx={xAt(0)} cy={yAt(points[0].ventes)} r="5" fill="var(--chart-1)" />
            </>
          )}

          {/* hover: crosshair + focus dots */}
          {hi != null && (
            <g pointerEvents="none">
              <line
                x1={hx}
                y1={PAD_T}
                x2={hx}
                y2={baseY}
                stroke="var(--chart-axis)"
                strokeWidth="1"
                strokeOpacity="0.45"
                strokeDasharray="4 4"
              />
              <circle
                cx={hx}
                cy={yAt(points[hi].achats)}
                r="5.5"
                fill="var(--chart-3)"
                stroke="var(--card)"
                strokeWidth="2.5"
              />
              <circle
                cx={hx}
                cy={yAt(points[hi].ventes)}
                r="5.5"
                fill="var(--chart-1)"
                stroke="var(--card)"
                strokeWidth="2.5"
              />
            </g>
          )}

          {/* x-axis labels (subset to avoid crowding; hovered one always shown) */}
          {points.map((p, i) => {
            const show = i % Math.max(1, Math.ceil(points.length / 8)) === 0 || i === hi;
            if (!show) return null;
            const anchor = i === 0 ? "start" : i === points.length - 1 ? "end" : "middle";
            return (
              <text
                key={i}
                x={xAt(i)}
                y={H - 8}
                fontSize="11"
                fontFamily="JetBrains Mono, monospace"
                fill={i === hi ? "var(--foreground)" : "var(--chart-axis)"}
                fontWeight={i === hi ? 600 : 400}
                textAnchor={anchor}
              >
                {p.label}
              </text>
            );
          })}
        </svg>

        <AnimatePresence>
          {hi != null && (
            <motion.div
              key="tip"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="pointer-events-none absolute top-1 z-10 min-w-[152px] -translate-x-1/2 rounded-xl border border-border bg-card px-3 py-2 shadow-lg"
              style={{ left: clamp(hx, 82, W - 82) }}
            >
              <div className="mb-1.5 text-xs font-semibold text-foreground">{points[hi].label}</div>
              <div className="flex flex-col gap-1">
                <TipRow colorVar="--chart-1" name={t("trend.ventes")} value={points[hi].ventes} />
                <TipRow colorVar="--chart-3" name={t("trend.achats")} value={points[hi].achats} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {t("dashboard.max")} <span className="font-mono tabular-nums">{formatMAD(rawMax)}</span>
        </span>
        <span>
          {points.length} {unitLabel}
        </span>
      </div>
    </KpiTile>
  );
}

function TipRow({ colorVar, name, value }: { colorVar: string; name: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-5 text-xs">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className="size-2 rounded-full" style={{ background: `var(${colorVar})` }} />
        {name}
      </span>
      <span className="font-mono tabular-nums text-foreground">{formatMAD(value)}</span>
    </div>
  );
}

function Legend() {
  const t = useT();
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ background: "var(--chart-1)" }} />
        <span className="text-muted-foreground">{t("trend.ventes")}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ background: "var(--chart-3)" }} />
        <span className="text-muted-foreground">{t("trend.achats")}</span>
      </span>
    </div>
  );
}
