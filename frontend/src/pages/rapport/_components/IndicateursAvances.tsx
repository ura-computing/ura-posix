import { BarChart3, CalendarCheck, CalendarX, Receipt } from "lucide-react";

import { formatMAD, formatQty } from "@/utils/format";
import type { AdvancedKpis, CategoryType } from "@/types";

import { KpiTile } from "@/components/shared/KpiTile";


function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}


export function IndicateursAvances({ kpis, tint = "all" }: { kpis: AdvancedKpis; tint?: CategoryType }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        label="Ticket moyen"
        value={formatMAD(kpis.ticket_moyen)}
        icon={<Receipt className="size-5" />}
        tint={tint}
      />
      <KpiTile
        label="Moyenne / jour"
        value={formatMAD(kpis.vente_moyenne_par_jour)}
        sub="ventes journalières"
        icon={<BarChart3 className="size-5" />}
        tint={tint}
      />
      <KpiTile
        label="Meilleure journée"
        value={formatMAD(kpis.best_day_dh?.total ?? 0)}
        sub={<>{fmtDate(kpis.best_day_dh?.date)} · {formatQty(kpis.best_day_count?.count ?? 0)} opé</>}
        icon={<CalendarCheck className="size-5" />}
        tint={tint}
      />
      <KpiTile
        label="Moins bonne journée"
        value={formatMAD(kpis.worst_day_dh?.total ?? 0)}
        sub={<>{fmtDate(kpis.worst_day_dh?.date)} · {formatQty(kpis.worst_day_count?.count ?? 0)} opé</>}
        icon={<CalendarX className="size-5" />}
        tint={tint}
      />
    </div>
  );
}