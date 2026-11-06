/** Top of the product sheet, on every tab, kept calm: « Retour à la liste des produits »; the name; one line with
 *  the type and stock badges, the PID and the code barre; on the right one row of actions: « Observations », the
 *  premium « Étiquette » / « Commander N ». */
import { ArrowLeft, Printer, ShoppingCart, StickyNote } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/_components/atoms/Badge";
import { Button } from "@/_components/atoms/Button";
import { TypeBadge } from "@/_components/molecules/TypeBadge";
import type { PremiumFeature } from "@/_components/organisms/PremiumDialog";
import { ROUTES, type ProductSheet } from "@/types";
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";

import { BarcodeImage } from "./BarcodeImage";
import { CopyButton } from "./CopyButton";

/** A big « Retour à la liste des produits » (easy to spot; the top bar already shows where we are). */
export function BackToList() {
  const t = useT();
  return (
    <Link
      to={ROUTES.PRODUITS}
      className="inline-flex h-11 w-fit items-center gap-2 rounded-lg border border-border bg-card px-4 text-base font-semibold text-foreground transition-colors hover:bg-surface-subtle"
    >
      <ArrowLeft className="size-5" />
      {t("products.backToList")}
    </Link>
  );
}

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

/** Right of the title, one row: « Observations » (their window), « Étiquette » and « Commander N » (premium: without
 *  it, a click opens the upgrade screen; N = maximum − stock, disabled when nothing to order, the reason
 *  under the row). No « Modifier » here: each block of « Général » / « Codes » has its own. The stock: the « Stock
 *  actuel » tile and the « Stock et réappro » card. */
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
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
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
      </div>
      {toOrder <= 0 && <span className="text-xs text-muted-foreground">{t("products.orderEnough")}</span>}
    </div>
  );
}
