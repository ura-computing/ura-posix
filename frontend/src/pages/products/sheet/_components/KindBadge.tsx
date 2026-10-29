/** « Vente » (red) / « Achat » (green): the type of one line of the product (Général, Mouvements). */
import { Badge } from "@/_components/atoms/Badge";
import type { ProductMovement } from "@/types";
import { useT } from "@/i18n/I18nProvider";

export function KindBadge({ kind }: { kind: ProductMovement["kind"] }) {
  const t = useT();
  return (
    <Badge tone={kind === "achat" ? "success" : "error"} className="text-xs font-semibold">
      {t(kind === "achat" ? "products.kindAchat" : "products.kindVente")}
    </Badge>
  );
}
