/** « Ventes et achats par mois » as a chart: Jan → Déc across, one curve per series
 *  (« Ventes 2026 », « Achats 2026 », « Ventes 2025 »…): same solid line, only the color differs
 *  (user). Hover = the month's value of every series. A month with more
 *  returns than sales is drawn at 0 (the tooltip shows the real number). */
import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import type { MonthlySales } from "@/types";
import { useMonths, useMonthsShort } from "@/i18n/dates";
import { useT } from "@/i18n/I18nProvider";
import { clamp, niceScale, smoothPath } from "@/utils/chart";
import { formatNumStr, formatQty } from "@/utils/format";

const H = 264;
const PAD_T = 18;
const PAD_B = 34;
const PAD_R = 18;
const MIN_W = 320;
// Next colors as far apart as possible: Ventes 2026 teal, Achats 2026 amber (Rapport's pair), …
const ORDER = [1, 3, 2, 5, 4, 8, 7, 6];
const color = (i: number) => `var(--chart-${ORDER[i % ORDER.length]})`;

interface Series {
  key: string;
  label: string;
  values: number[];
  color: string;
}

/** Line sample for the legend, in the series' color. */
function LineKey({ s }: { s: Series }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="18" height="6" aria-hidden>
        <line x1="0" y1="3" x2="18" y2="3" stroke={s.color} strokeWidth="2.5" />
      </svg>
      <span className="text-muted-foreground">{s.label}</span>
    </span>
  );
}

export function MonthlySalesChart({ years }: { years: MonthlySales[] }) {
  const t = useT();
  const monthsShort = useMonthsShort();
  const months = useMonths();
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

  const series: Series[] = years
    .flatMap((y) => [
      { key: `${y.year}-sold`, label: t("products.salesOfYear", { year: y.year }), values: y.sold },
      {
        key: `${y.year}-bought`,
        label: t("products.purchasesOfYear", { year: y.year }),
        values: y.bought,
      },
    ])
    .map((s, i) => ({ ...s, color: color(i) }));

  const rawMax = Math.max(1, ...series.flatMap((s) => s.values));
  const { niceMax, ticks } = niceScale(rawMax, 4);
  const yLabels = ticks.map((v) => formatNumStr(v));
  // Geometry in real pixels (1 svg unit = 1 px) → crisp text.
  const PAD_L = 14 + Math.max(...yLabels.map((s) => s.length)) * 7;
  const W = Math.max(MIN_W, w);
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const xAt = (i: number) => PAD_L + (i * plotW) / 11;
  const yAt = (v: number) => PAD_T + plotH - (Math.max(v, 0) / niceMax) * plotH;
  const baseY = PAD_T + plotH;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / (rect.width || W));
    setHover(clamp(Math.round(((x - PAD_L) / plotW) * 11), 0, 11));
  };
  const hx = hover != null ? xAt(hover) : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs">
        {series.map((s) => (
          <LineKey key={s.key} s={s} />
        ))}
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
          {ticks.map((tk, i) => {
            const y = yAt(tk);
            return (
              <g key={tk}>
                {i > 0 && i < ticks.length - 1 && (
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

          {/* Oldest series first, so the newest year is drawn on top. */}
          {[...series].reverse().map((s) => (
            <motion.path
              key={s.key}
              d={smoothPath(s.values.map((v, m) => ({ x: xAt(m), y: yAt(v) })))}
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

          {hover != null && (
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

          {monthsShort.map((label, m) => (
            <text
              key={label}
              x={xAt(m)}
              y={H - 8}
              fontSize="11"
              fontFamily="JetBrains Mono, monospace"
              fill={m === hover ? "var(--foreground)" : "var(--chart-axis)"}
              fontWeight={m === hover ? 600 : 400}
              textAnchor={m === 0 ? "start" : m === 11 ? "end" : "middle"}
            >
              {label}
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
              className="pointer-events-none absolute top-1 z-10 min-w-[170px] -translate-x-1/2 rounded-xl border border-border bg-card px-3 py-2 shadow-lg"
              style={{ left: clamp(hx, 90, W - 90) }}
            >
              <div className="mb-1.5 text-xs font-semibold text-foreground">{months[hover]}</div>
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
      </div>
    </div>
  );
}
