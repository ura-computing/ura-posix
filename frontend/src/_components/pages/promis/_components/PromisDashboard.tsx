/** Top of « Promis »: 4 counters (a click filters the list by that state) and « À faire aujourd'hui », the promis
 *  needing someone now, most urgent first (« Délai dépassé », « Dernier jour », a WhatsApp message to send…); a click
 *  opens the promis. */
import { Link } from "react-router-dom";
import { AlarmClock, ChevronRight, PackageCheck, ShoppingCart, Truck } from "lucide-react";

import { Badge, type BadgeTone } from "@/_components/atoms/Badge";
import { SectionCard } from "@/_components/molecules/SectionCard";
import { KpiTile, type IconTone } from "@/_components/organisms/KpiTile";
import { useMe } from "@/hooks/useMe";
import { useT } from "@/i18n/I18nProvider";
import type { PromisState, PromisSummary, PromisTodoKind } from "@/types/promis";
import { formatNumStr } from "@/utils/format";

const TILES: { state: PromisState; icon: typeof Truck; tone: IconTone }[] = [
  { state: "to_order", icon: ShoppingCart, tone: "warning" },
  { state: "ordered", icon: Truck, tone: "info" },
  { state: "ready", icon: PackageCheck, tone: "success" },
  { state: "expired", icon: AlarmClock, tone: "error" },
];
const TODO_TONE: Record<PromisTodoKind, BadgeTone> = {
  expired: "error",
  last_day: "error",
  msg_ready: "warning",
  msg_reminder: "warning",
  msg_returned: "warning",
  msg_created: "warning",
  received: "info",
  to_order: "info",
};

export function PromisDashboard({
  summary,
  onState,
}: {
  summary: PromisSummary | null;
  onState: (state: PromisState) => void;
}) {
  const t = useT();
  const { me } = useMe();
  if (!summary) return null;
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map(({ state, icon: Icon, tone }) => (
          <KpiTile
            key={state}
            label={t(`promis.tile_${state}`)}
            value={formatNumStr(summary.counts[state] ?? 0)}
            sub={state === "ready" ? t("promis.tileWeek", { n: formatNumStr(summary.week) }) : undefined}
            icon={<Icon className="size-5" />}
            iconTone={tone}
            onClick={() => onState(state)}
          />
        ))}
      </div>

      <SectionCard title={t("promis.todoTitle")} hint={summary.todo.length ? String(summary.todo.length) : undefined}>
        {summary.todo.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("promis.todoNone")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {summary.todo.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/${me?.role}/promis/${r.id}`}
                  className="flex min-h-11 items-center justify-between gap-3 py-2 hover:bg-surface-subtle"
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono text-sm font-semibold">{t("promis.titleN", { n: r.number })}</span>
                    <span className="text-sm font-medium text-foreground">{r.customer_name}</span>
                    <Badge tone={TODO_TONE[r.todo]}>{t(`promis.todo_${r.todo}`)}</Badge>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
