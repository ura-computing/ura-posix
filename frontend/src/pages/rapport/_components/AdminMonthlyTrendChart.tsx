/** Section 2f — dual-bar trend chart. Ventes (info-blue) + Achats (muted) per
 *  month. Pure CSS bars — no chart lib dep. Reused styling vocabulary
 *  ("var(--info)" / "var(--muted-foreground)") so it tracks the theme. */
import type { MonthlyTrendPoint } from "@/types";


export function AdminMonthlyTrendChart({
  data, subtitle,
}: { data: MonthlyTrendPoint[]; subtitle: string }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.ventes, d.achats]));

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">Évolution mensuelle</span>
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        </div>
        <div className="flex items-center gap-3.5">
          <Legend color="var(--info)" label="Ventes" />
          <Legend color="var(--muted-foreground)" label="Achats" />
        </div>
      </div>

      <div className="flex h-44 items-end gap-2 pt-2">
        {data.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
            Aucune donnée mensuelle.
          </div>
        ) : data.map((d) => (
          <div key={d.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <div className="flex h-full w-full items-end justify-center gap-[3px]">
              <Bar heightPct={(d.ventes  / max) * 100} color="var(--info)" />
              <Bar heightPct={(d.achats  / max) * 100} color="var(--muted-foreground)" muted />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">{d.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


function Bar({ heightPct, color, muted }: { heightPct: number; color: string; muted?: boolean }) {
  return (
    <div
      className="w-[42%] max-w-3.5 rounded-t-[3px] transition-[height] duration-500"
      style={{ height: `${heightPct}%`, background: color, opacity: muted ? 0.55 : 1 }}
    />
  );
}


function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="size-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
