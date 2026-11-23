import type { TFn } from "@/i18n/I18nProvider";
import { formatMAD } from "@/utils/format";

/** Under the table: the TVA and the total of the WHOLE filtered set (not just this page). */
export function LedgerFooter({
  t,
  tvaLabel,
  tva,
  totalLabel,
  total,
}: {
  t: TFn;
  tvaLabel: string;
  tva: number;
  totalLabel: string;
  total: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 px-4 py-2 text-xs">
      <span className="text-muted-foreground">
        {tvaLabel} <span className="text-foreground/60">{t("common.filtresActifs")}</span> :
        <span className="ml-1 font-mono tabular-nums font-semibold text-foreground">{formatMAD(tva)}</span>
        <span className="mx-2 text-foreground/40">·</span>
        {totalLabel}
        <span className="ml-1 font-mono tabular-nums font-semibold text-foreground">{formatMAD(total)}</span>
      </span>
    </div>
  );
}
