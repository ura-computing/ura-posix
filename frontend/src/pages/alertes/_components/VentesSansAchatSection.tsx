// src/pages/alertes/_components/VentesSansAchatSection.tsx
import { FileWarning } from "lucide-react";

import { KpiTile } from "@/components/shared/KpiTile";
import { formatMAD, formatQty } from "@/utils/format";
import { VENTES_SANS_ACHAT_COLUMNS } from "./AlertDetailDialog";
import type { VentesSansAchatResponse } from "@/types";
import type { DialogDescriptor } from "../_hooks/useAlertesPage";

export interface VentesSansAchatSectionProps {
  data?: VentesSansAchatResponse;
  onOpen: (d: DialogDescriptor) => void;
}

export function VentesSansAchatSection({ data, onOpen }: VentesSansAchatSectionProps) {
  const count = data?.count ?? 0;
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center gap-2.5">
        <FileWarning className="size-5 text-warning" />
        <div>
          <h2 className="text-base font-semibold text-foreground">Alertes de données</h2>
          <p className="text-[13px] text-muted-foreground">
            Produits vendus sans achat correspondant dans la période — cause des "—" sur les colonnes Marge de /ventes.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1">
        <KpiTile
          label="Ventes sans achat correspondant"
          value={formatMAD(data?.total_ca ?? 0)}
          sub={<>{formatQty(count)} produits · {formatQty(data?.total_units_sold ?? 0)} unités</>}
          icon={<FileWarning className="size-5" />}
          iconTone="warning"
          badge={{ label: <>{formatQty(count)} produits</>, tone: "warning" }}
          disabled={count === 0}
          onClick={
            data && count > 0
              ? () =>
                  onOpen({
                    title:          "Ventes sans achat correspondant",
                    subtitle:       "Produits vendus dont aucun achat n'a été trouvé dans la période sélectionnée.",
                    products:       data.products,
                    columns:        VENTES_SANS_ACHAT_COLUMNS,
                    defaultSortKey: "ca",
                  })
              : undefined
          }
        />
      </div>
    </section>
  );
}
