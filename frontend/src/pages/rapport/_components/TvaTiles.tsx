import { Receipt, ArrowDownCircle, FileText } from "lucide-react";

import { KpiTile } from "@/components/shared/KpiTile";
import { formatMAD } from "@/utils/format";
import { ROUTES, type CategoryType, type TvaSummary } from "@/types";
import { useT } from "@/i18n/I18nProvider";


export function TvaTiles({ tva, tint = "all" }: { tva: TvaSummary; tint?: CategoryType }) {
  const t = useT();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <KpiTile
        href={ROUTES.COMPTABILITE}
        label={t("kpi.tvaEncaissee")}
        value={formatMAD(tva.tva_encaissee)}
        icon={<ArrowDownCircle className="size-5" />}
        iconTone="primary"
        tint={tint}
      />
      <KpiTile
        href={ROUTES.COMPTABILITE}
        label={t("kpi.tvaPayee")}
        value={formatMAD(tva.tva_payee)}
        icon={<Receipt className="size-5" />}
        iconTone="warning"
        tint={tint}
      />
      <KpiTile
        href={ROUTES.COMPTABILITE}
        label={t("kpi.tvaADeclarer")}
        value={formatMAD(tva.tva_a_declarer)}
        icon={<FileText className="size-5" />}
        iconTone="primary"
        tint={tint}
      />
    </div>
  );
}
