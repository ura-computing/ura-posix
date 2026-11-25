/** One product of a draft: its name (→ its sheet), its group, why this quantity (« 3 pour le rayon + 1 pour Mme
 *  Alami »), « − » / « + » (saved a moment after the last click), price, discount, net total, « Par multiple de 12 » in
 *  orange when the packaging is not respected, « Enlever ». */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";

import { Badge, type BadgeTone } from "@/_components/atoms/Badge";
import { Button } from "@/_components/atoms/Button";
import { QuantityField } from "@/_components/molecules/QuantityField";
import { useMe } from "@/hooks/useMe";
import { useT } from "@/i18n/I18nProvider";
import type { OrderGroup, OrderLine } from "@/types/orders";
import { formatMADStr, formatPctStr } from "@/utils/format";

const GROUP_TONE: Record<OrderGroup, BadgeTone> = {
  urgent: "error",
  promis: "info",
  restock: "neutral",
  check: "warning",
};
const SAVE_AFTER_MS = 700;

export function OrderLineRow({
  line,
  onQuantity,
  onRemove,
}: {
  line: OrderLine;
  onQuantity: (id: number, quantity: number) => void;
  onRemove: (id: number) => void;
}) {
  const t = useT();
  const { me } = useMe();
  const [qty, setQty] = useState(String(line.quantity));
  const n = Number(qty);
  // Saved a moment after the last « − » / « + » / digit (one request for several clicks).
  useEffect(() => {
    if (!n || n === line.quantity) return;
    const timer = setTimeout(() => onQuantity(line.id, n), SAVE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [n, line.id, line.quantity, onQuantity]);

  const why =
    line.for_promis > 0
      ? t("products.orderWhyBoth", { shelf: line.for_shelf, promis: line.for_promis, who: line.customers.join(", ") })
      : t("products.orderWhyShelf", { shelf: line.for_shelf });
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <span className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <Link
            to={`/${me?.role}/produits/${line.medicament_id}`}
            className="font-medium text-foreground hover:underline"
          >
            {line.product}
          </Link>
          <Badge tone={GROUP_TONE[line.group]}>{t(`orders.group_${line.group}`)}</Badge>
        </span>
        <span className="text-xs text-muted-foreground">
          {why}
          {line.edited && line.quantity !== line.suggested && <> · {t("orders.suggested", { n: line.suggested })}</>}
        </span>
        {line.packaging != null && (
          <span className="text-xs font-medium text-warning">{t("orders.packaging", { n: line.packaging })}</span>
        )}
        {line.unit_price == null && <span className="text-xs font-medium text-warning">{t("orders.noPrice")}</span>}
      </span>
      <QuantityField
        label={t("orders.quantity")}
        value={qty}
        onChange={setQty}
        min={1}
        max={100000}
        decreaseLabel={t("orders.less")}
        increaseLabel={t("orders.more")}
      />
      <span className="flex w-36 flex-col items-end text-sm">
        <span className="font-mono font-semibold">{formatMADStr(line.net_total)}</span>
        <span className="text-xs text-muted-foreground">
          {line.unit_price != null && formatMADStr(line.unit_price)}
          {line.discount_pct > 0 && <> − {formatPctStr(line.discount_pct)}</>}
        </span>
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`${t("orders.remove")} ${line.product}`}
        onClick={() => onRemove(line.id)}
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}
