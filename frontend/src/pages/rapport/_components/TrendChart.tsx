import { KpiTile } from "@/components/shared/KpiTile";
import { formatMAD } from "@/utils/format";
import type { CategoryType, MonthlyTrendPoint } from "@/types";


const W = 720;
const H = 220;
const PAD_X = 16;
const PAD_Y_TOP = 12;
const PAD_Y_BOT = 28;

const SHORT_MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function shortMonth(ym: string): string {
  // ym = "YYYY-MM"
  const [, m] = ym.split("-");
  const idx = parseInt(m, 10) - 1;
  return SHORT_MONTHS[idx] ?? m;
}


export function TrendChart({ points, tint = "all" }: { points: MonthlyTrendPoint[]; tint?: CategoryType }) {
  if (points.length === 0) {
    return (
      <KpiTile label="Tendance mensuelle" tint={tint}>
        <p className="py-12 text-center text-sm text-muted-foreground">Aucune donnée sur la période.</p>
      </KpiTile>
    );
  }

  const maxVal = Math.max(
    ...points.map((p) => Math.max(p.ventes, p.achats)),
    1,
  );

  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y_TOP - PAD_Y_BOT;
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;

  function toPath(values: number[], close: boolean) {
    const pts = values.map((v, i) => [
      PAD_X + i * stepX,
      PAD_Y_TOP + innerH - (v / maxVal) * innerH,
    ]);
    const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    if (!close) return line;
    return `${line} L${PAD_X + (pts.length - 1) * stepX} ${PAD_Y_TOP + innerH} L${PAD_X} ${PAD_Y_TOP + innerH} Z`;
  }

  const ventes  = points.map((p) => p.ventes);
  const achats  = points.map((p) => p.achats);

  const firstLabel = shortMonth(points[0].month);
  const lastLabel  = shortMonth(points[points.length - 1].month);

  return (
    <KpiTile
      label="Tendance mensuelle"
      sub={<>Ventes et achats de {firstLabel} à {lastLabel}</>}
      tint={tint}
    >
      <div className="flex justify-end">
        <Legend />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" className="overflow-visible">
        <defs>
          <linearGradient id="trend-ventes" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--chart-1)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--chart-1)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="trend-achats" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--chart-3)" stopOpacity="0.20" />
            <stop offset="1" stopColor="var(--chart-3)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((f) => {
          const y = PAD_Y_TOP + innerH * f;
          return <line key={f} x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke="var(--chart-grid)" strokeWidth="1" strokeDasharray="3 3" />;
        })}

        <path d={toPath(achats, true)}  fill="url(#trend-achats)" />
        <path d={toPath(achats, false)} fill="none" stroke="var(--chart-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3" />
        <path d={toPath(ventes, true)}  fill="url(#trend-ventes)" />
        <path d={toPath(ventes, false)} fill="none" stroke="var(--chart-1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => {
          const x = PAD_X + i * stepX;
          const showLabel = i % Math.max(1, Math.ceil(points.length / 8)) === 0;
          if (!showLabel) return null;
          return (
            <text key={p.month} x={x} y={H - 6} fontSize="10" fontFamily="JetBrains Mono, monospace" fill="var(--chart-axis)" textAnchor="middle">
              {shortMonth(p.month)}
            </text>
          );
        })}
      </svg>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Max&nbsp;: <span className="font-mono tabular-nums">{formatMAD(maxVal)}</span></span>
        <span>{points.length} mois</span>
      </div>
    </KpiTile>
  );
}


function Legend() {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ background: "var(--chart-1)" }} />
        <span className="text-muted-foreground">Ventes</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ background: "var(--chart-3)" }} />
        <span className="text-muted-foreground">Achats</span>
      </span>
    </div>
  );
}