/** Stock status of one product (Sous-stock, Idéal, À surveiller, Sur-stock, Inconnu, Stock négatif):
 *  same badge on the Stock page and the product sheet. */
import { Badge } from "@/_components/atoms/Badge";
import { STATUS_META } from "@/pages/analytics/constants";
import type { StockRow } from "@/types";
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";

export function StockStatusPill({ status }: { status: StockRow["status"] }) {
  const t = useT();
  const meta = STATUS_META[status];
  return (
    <Badge className={cn("border-transparent text-xs", meta.pill)}>
      <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
      {t(`stockStatus.${status}`)}
    </Badge>
  );
}
