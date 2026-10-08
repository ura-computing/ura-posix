/** Statistiques charts, hand-drawn SVG like Rapport (no chart library):
 *  - `MonthsChart`: the last 12 months across, as bars or as solid lines (one color per series).
 *    Hover = the month's value of every series. A month with more returns than sales is drawn
 *    at 0 (the tooltip shows the real number).
 *  - `TrendLine`: a small line with a dot per point (« Tendances »); hover a dot = its value. */
import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { useMonths, useMonthsShort } from "@/i18n/dates";
import { clamp, niceScale, smoothPath } from "@/utils/chart";
import { formatNumStr, formatQty } from "@/utils/format";

export interface ChartSeries {
  key: string;
  label: string;
  values: number[];
  /** Ventes `var(--chart-1)` (teal), achats `var(--chart-2)` (blue): the same on every chart. */
  color: string;
}

const H = 210;
const PAD_T = 12;
const PAD_B = 28;
const PAD_R = 8;
const MIN_W = 200;

/** The element's width, followed on resize; null until measured. A chart is drawn once, at its
 *  real size in real pixels (crisp text, nothing moving sideways while it appears). */
function useWidth(ref: RefObject<HTMLDivElement | null>): number | null {
  const [w, setW] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width ?? 0;
      if (cw > 0) setW(cw);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** Legend of a lines chart (right of its card title): a line sample per series, in its color. */
export function ChartLegend({ series }: { series: ChartSeries[] }) {
  return (
    <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs">
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <svg width="18" height="6" aria-hidden>
            <line x1="0" y1="3" x2="18" y2="3" stroke={s.color} strokeWidth="2.5" />
          </svg>
          <span className="text-muted-foreground">{s.label}</span>
        </span>
      ))}
    </div>
  );
}

interface MonthsChartProps {
  /** YYYY-MM, oldest first. */
  months: string[];
  series: ChartSeries[];
  kind: "bars" | "lines";
  /** Names the chart (screen readers, tests). */
  label: string;
}

/** Its height is kept while the width is measured: the page below never jumps. */
export function MonthsChart(props: MonthsChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const w = useWidth(wrapRef);
  return (
    <div ref={wrapRef} className="relative w-full print:h-auto!" style={{ height: H }}>
      {w != null && <DrawnMonthsChart {...props} W={Math.max(MIN_W, w)} />}
    </div>
  );
}

function DrawnMonthsChart({ months, series, kind, label, W }: MonthsChartProps & { W: number }) {
  const monthsShort = useMonthsShort();
  const monthNames = useMonths();
  const [hover, setHover] = useState<number | null>(null);

  const n = months.length;
  const rawMax = Math.max(1, ...series.flatMap((s) => s.values));
  const { niceMax, ticks } = niceScale(rawMax, 4);
  const yLabels = ticks.map((v) => formatNumStr(v));
  const PAD_L = 12 + Math.max(...yLabels.map((s) => s.length)) * 7;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const band = plotW / n;
  const xAt = (i: number) => PAD_L + (i + 0.5) * band;
  const yAt = (v: number) => PAD_T + plotH - (Math.max(v, 0) / niceMax) * plotH;
  const baseY = PAD_T + plotH;
  const barW = Math.min(22, (band * 0.6) / series.length);
  const labelStep = band < 26 ? 2 : 1;
  const monthOf = (m: string) => Number(m.slice(5, 7)) - 1;
  // « Janv. » → « Janv »: 12 names fit under a third of the page.
  const short = (m: string) => monthsShort[monthOf(m)].replace(/\.$/, "");

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / (rect.width || W));
    setHover(clamp(Math.floor((x - PAD_L) / band), 0, n - 1));
  };
  const hx = hover != null ? xAt(hover) : 0;

  return (
    <>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={label}
        className="block h-auto max-w-full touch-none select-none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((tk, i) => {
          const y = yAt(tk);
          return (
            <g key={tk}>
              {i > 0 && (
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
                x={PAD_L - 8}
                y={y + 3.5}
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                fill="var(--chart-axis)"
                textAnchor="end"
              >
                {yLabels[i]}
              </text>
            </g>
          );
        })}

        {kind === "bars" &&
          series.map((s, si) =>
            s.values.map((v, i) => (
              <motion.rect
                key={`${s.key}-${months[i]}`}
                x={xAt(i) - (barW * series.length) / 2 + si * barW}
                y={yAt(v)}
                width={barW}
                height={baseY - yAt(v)}
                rx={2}
                fill={s.color}
                opacity={hover == null || hover === i ? 1 : 0.55}
                // Grows from the axis up (not from its middle).
                style={{ originY: 1 }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.02 }}
              />
            )),
          )}

        {kind === "lines" &&
          series.map((s) => (
            <motion.path
              key={s.key}
              d={smoothPath(s.values.map((v, i) => ({ x: xAt(i), y: yAt(v) })))}
              fill="none"
              stroke={s.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.7, ease: "easeInOut" }}
            />
          ))}

        {kind === "lines" && hover != null && (
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
            {series.map((s) => (
              <circle
                key={s.key}
                cx={hx}
                cy={yAt(s.values[hover])}
                r="4.5"
                fill={s.color}
                stroke="var(--card)"
                strokeWidth="2"
              />
            ))}
          </g>
        )}

        {/* Narrow chart: every other month (always the last one and the one under the mouse). */}
        {months.map((m, i) => (
          <text
            key={m}
            visibility={(n - 1 - i) % labelStep === 0 || i === hover ? "visible" : "hidden"}
            x={xAt(i)}
            y={H - 8}
            fontSize="10"
            fill={i === hover ? "var(--foreground)" : "var(--chart-axis)"}
            fontWeight={i === hover ? 600 : 400}
            textAnchor="middle"
          >
            {short(m)}
          </text>
        ))}
      </svg>

      <AnimatePresence>
        {hover != null && (
          <motion.div
            key="tip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute top-1 z-10 min-w-[150px] -translate-x-1/2 rounded-xl border border-border bg-card px-3 py-2 shadow-lg"
            style={{ left: clamp(hx, 80, W - 80) }}
          >
            <div className="mb-1.5 text-xs font-semibold text-foreground">
              {monthNames[monthOf(months[hover])]} {months[hover].slice(0, 4)}
            </div>
            <div className="flex flex-col gap-1">
              {series.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-5 text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2 rounded-full" style={{ background: s.color }} />
                    {s.label}
                  </span>
                  <span className="font-mono tabular-nums text-foreground">{formatQty(s.values[hover])}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const TREND_H = 72;
const TREND_PAD = 6;

interface TrendLineProps {
  values: number[];
  /** One per point, shown on hover: « 12/09/2026 : 4 ». */
  titles: string[];
  color: string;
  label: string;
}

export function TrendLine(props: TrendLineProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const w = useWidth(wrapRef);
  return (
    <div ref={wrapRef} className="w-full print:h-auto!" style={{ height: TREND_H }}>
      {w != null && <DrawnTrendLine {...props} W={Math.max(120, w)} />}
    </div>
  );
}

function DrawnTrendLine({ values, titles, color, label, W }: TrendLineProps & { W: number }) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const range = hi - lo || 1;
  const xAt = (i: number) => (values.length > 1 ? TREND_PAD + (i * (W - 2 * TREND_PAD)) / (values.length - 1) : W / 2);
  // All the same → a flat line in the middle.
  const yAt = (v: number) =>
    hi === lo ? TREND_H / 2 : TREND_H - TREND_PAD - ((v - lo) / range) * (TREND_H - 2 * TREND_PAD);
  const pts = values.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
  return (
    <svg
      width={W}
      height={TREND_H}
      viewBox={`0 0 ${W} ${TREND_H}`}
      role="img"
      aria-label={label}
      className="block h-auto max-w-full"
    >
      <motion.path
        d={smoothPath(pts)}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, ease: "easeInOut" }}
      />
      {pts.map((p, i) => (
        <circle key={titles[i]} cx={p.x} cy={p.y} r={values.length > 40 ? 1.5 : 2.5} fill={color}>
          <title>{titles[i]}</title>
        </circle>
      ))}
    </svg>
  );
}
