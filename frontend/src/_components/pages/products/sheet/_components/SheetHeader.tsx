/** Top of the product sheet, on every tab, kept calm (above it: `BackLink` « Retour à la liste des produits »): the name; one line with
 *  the type and stock badges, the PID and the code barre; on the right the stock box and the actions: « Observations »,
 *  the premium « Étiquette » / « Commander N ». */
import { Printer, ShoppingCart, StickyNote } from "lucide-react";

import { Badge } from "@/_components/atoms/Badge";
import { Button } from "@/_components/atoms/Button";
import { Card } from "@/_components/atoms/Card";
import { SectionTitle } from "@/_components/atoms/SectionTitle";
import { TypeBadge } from "@/_components/molecules/TypeBadge";
import type { PremiumFeature } from "@/_components/organisms/PremiumDialog";
import type { ProductSheet, ProductStock } from "@/types/products";
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import { formatQty } from "@/utils/format";

import { BarcodeImage } from "./BarcodeImage";
import { CopyButton } from "./CopyButton";

/** « En stock » (more than 0), « Rupture » (0 or less), « Hors stock » (not in the last stock file). */
function StockStateBadge({ stock }: { stock: number | null }) {
  const t = useT();
  const [label, tone] =
    stock == null
      ? [t("products.outOfFile"), "border-border bg-muted text-muted-foreground"]
      : stock > 0
        ? [t("products.inStock"), "border-success/30 bg-success-subtle text-success-subtle-foreground"]
        : [t("products.rupture"), "border-error/30 bg-error-subtle text-error-subtle-foreground"];
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2.5 py-1 text-sm font-medium", tone)}>
      {label}
    </span>
  );
}

/** Under the name, one calm line: the type and stock badges, the PID, the code barre (drawn, number, copy).
 *  Catégorie, TVA, laboratoire, emplacement: in the « Identité » / « Prix et marge » cards of « Général ». */
export function SheetMeta({ sheet }: { sheet: ProductSheet }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-base">
      <TypeBadge type={sheet.category_type} size="md" />
      <StockStateBadge stock={sheet.stock.current_stock} />
      <span>
        {t("products.metaPid")} <span className="font-mono font-medium text-primary">{sheet.pid}</span>
      </span>
      {sheet.barcode1 && (
        <span className="flex items-center gap-3">
          <BarcodeImage code={sheet.barcode1} className="h-8 w-20" />
          <span className="font-mono text-base font-semibold text-foreground">{sheet.barcode1}</span>
          <CopyButton value={sheet.barcode1} label={t("products.copyBarcode")} iconOnly />
        </span>
      )}
    </div>
  );
}

/** The stock at a glance: the current one (red under the minimum, then an orange border), minimum, maximum,
 *  « ≈ N jours de ventes ». */
function StockBox({ stock }: { stock: ProductStock }) {
  const t = useT();
  const { current_stock: current, stock_min: min, stock_max: max, coverage_days: days } = stock;
  const under = current != null && current < min;
  const row = (label: string, value: number) => (
    <span className="flex items-center justify-between gap-6 text-sm">
      <span className="font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold text-foreground">{formatQty(value)}</span>
    </span>
  );
  return (
    <Card as="div" className={cn("flex min-w-56 flex-col gap-1.5", under && "border-2 border-warning-border")}>
      <span className="flex items-center justify-between gap-6">
        <SectionTitle>{t("products.stock")}</SectionTitle>
        <span className={cn("font-mono text-4xl font-bold", under ? "text-error" : "text-foreground")}>
          {current == null ? "—" : formatQty(current)}
        </span>
      </span>
      {row(t("products.boxMin"), min)}
      {row(t("products.boxMax"), max)}
      {days != null && (
        <span className={cn("mt-1 text-sm font-medium", under ? "text-warning" : "text-muted-foreground")}>
          {t("products.daysOfSales", { n: days })}
        </span>
      )}
    </Card>
  );
}

/** Right of the title: the stock box, then, stacked, « Observations » (their window), « Étiquette » and « Commander N »
 *  (premium: without it, a click opens the upgrade screen; N = maximum − stock, disabled when nothing to order, the
 *  reason under it). No « Modifier » here: each block of « Général » / « Codes » has its own. */
export function SheetActions({
  sheet,
  onPremium,
  onOpenNotes,
}: {
  sheet: ProductSheet;
  onPremium: (feature: PremiumFeature) => void;
  onOpenNotes: () => void;
}) {
  const t = useT();
  const { current_stock: current, stock_max: max } = sheet.stock;
  const toOrder = Math.max(0, max - Math.max(0, current ?? 0));
  const notes = sheet.notes_count;
  return (
    <div className="flex flex-wrap items-start gap-3">
      <StockBox stock={sheet.stock} />
      <div className="flex min-w-48 flex-col gap-2">
        <Button variant="outline" onClick={onOpenNotes}>
          <StickyNote className="size-4" />
          {t("products.observations")}
          {notes > 0 && <Badge tone="warning">{notes}</Badge>}
        </Button>
        <Button variant="outline" onClick={() => onPremium("labels")}>
          <Printer className="size-4" />
          {t("products.label")}
        </Button>
        <Button variant="outline" onClick={() => onPremium("orders")} disabled={toOrder <= 0}>
          <ShoppingCart className="size-4" />
          {toOrder > 0 ? t("products.order", { n: toOrder }) : t("products.orderNone")}
        </Button>
        {toOrder <= 0 && <span className="max-w-48 text-sm text-muted-foreground">{t("products.orderEnough")}</span>}
      </div>
    </div>
  );
}
