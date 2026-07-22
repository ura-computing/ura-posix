// src/pages/alertes/_components/VentesSansAchatSection.tsx
import { FileWarning } from "lucide-react";

import { KpiTile } from "@/components/shared/KpiTile";
import { formatMAD, formatQty } from "@/utils/format";
import { VENTES_SANS_ACHAT_COLUMNS } from "./AlertDetailDialog";
import type { VentesSansAchatResponse } from "@/types";
import type { DialogDescriptor } from "../_hooks/useAlertesPage";
import { useT } from "@/i18n/I18nProvider";

export interface VentesSansAchatSectionProps {
  data?: VentesSansAchatResponse;
  onOpen: (d: DialogDescriptor) => void;
}

export function VentesSansAchatSection({ data, onOpen }: VentesSansAchatSectionProps) {
  const t = useT();
  const count = data?.count ?? 0;
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center gap-2.5">
        <FileWarning className="size-5 text-warning" />
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("alertes.dataTitle")}</h2>
          <p className="text-[13px] text-muted-foreground">
            {t("alertes.dataDesc")}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1">
        <KpiTile
          label={t("alertes.vsaTitle")}
          value={formatMAD(data?.total_ca ?? 0)}
          sub={<>{formatQty(count)} {t("common.wProduits")} · {formatQty(data?.total_units_sold ?? 0)} {t("common.wUnites")}</>}
          icon={<FileWarning className="size-5" />}
          iconTone="warning"
          badge={{ label: <>{formatQty(count)} {t("common.wProduits")}</>, tone: "warning" }}
          disabled={count === 0}
          onClick={
            data && count > 0
              ? () =>
                  onOpen({
                    title:          t("alertes.vsaTitle"),
                    subtitle:       t("alertes.vsaSub"),
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
