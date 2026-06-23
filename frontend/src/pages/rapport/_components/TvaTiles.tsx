import { Receipt, ArrowDownCircle, FileText } from "lucide-react";

import { KpiTile } from "@/components/shared/KpiTile";
import { formatMAD } from "@/utils/format";
import { ROUTES, type TvaSummary } from "@/types";


export function TvaTiles({ tva }: { tva: TvaSummary }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <KpiTile
        href={ROUTES.COMPTABILITE}
        label="TVA encaissée (ventes)"
        value={formatMAD(tva.tva_encaissee)}
        icon={<ArrowDownCircle className="size-5" />}
        iconTone="primary"
      />
      <KpiTile
        href={ROUTES.COMPTABILITE}
        label="TVA payée (achats)"
        value={formatMAD(tva.tva_payee)}
        icon={<Receipt className="size-5" />}
        iconTone="warning"
      />
      <KpiTile
        href={ROUTES.COMPTABILITE}
        label="TVA à déclarer"
        value={formatMAD(tva.tva_a_declarer)}
        icon={<FileText className="size-5" />}
        iconTone="primary"
      />
    </div>
  );
}
