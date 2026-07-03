import { Building2, Users, BookOpen, ClipboardCheck } from "lucide-react";

import { formatQty } from "@/utils/format";
import type { AdminStatsResponse } from "@/types";

import { KpiTile } from "@/components/shared/KpiTile";


export function AdminSystemTiles({ stats }: { stats: AdminStatsResponse }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        label="Pharmacies"
        value={formatQty(stats.total_pharmacies)}
        icon={<Building2 className="size-5" />}
      />
      <KpiTile
        label="Utilisateurs actifs"
        value={formatQty(stats.total_active_users)}
        icon={<Users className="size-5" />}
      />
      <KpiTile
        label="Médicaments au catalogue"
        value={formatQty(stats.total_catalog_items)}
        icon={<BookOpen className="size-5" />}
      />
      <KpiTile
        label="Demandes en attente"
        value={formatQty(stats.pending_catalog_requests)}
        icon={<ClipboardCheck className="size-5" />}
      />
    </div>
  );
}