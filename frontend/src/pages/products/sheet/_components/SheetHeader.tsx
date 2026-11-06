/** Top of the product sheet, on every tab: « Retour à la liste des produits »; the name, one line « PID · Catégorie ·
 *  TVA · Labo · emplacement », the type and stock badges, the code barre; on the right the stock at a glance and the
 *  sheet's actions: « Modifier », the premium « Étiquette » / « Commander N », « Observations ». */
import type { ReactNode } from "react";
import { ArrowLeft, MapPin, Pencil, Printer, ShoppingCart, StickyNote } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/_components/atoms/Badge";
import { Button } from "@/_components/atoms/Button";
import { Card } from "@/_components/atoms/Card";
import { SectionTitle } from "@/_components/atoms/SectionTitle";
import { PremiumTag } from "@/_components/molecules/PremiumTag";
import { TypeBadge } from "@/_components/molecules/TypeBadge";
import type { PremiumFeature } from "@/_components/organisms/PremiumDialog";
import { ROUTES, type ProductSheet, type ProductStock } from "@/types";
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import { formatQty } from "@/utils/format";

import { tvaShort, withoutRate } from "../labels";
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

const Dot = () => (
  <span aria-hidden className="text-muted-foreground">
    ·
  </span>
);

/** Under the name: « PID : … · Catégorie : … · TVA : … · Labo : … · 📍 emplacement », the type and stock badges;
 *  then the code barre (drawn, number, copy). No laboratory: « Non renseigné » + « Compléter » (the owner's edit). */
export function SheetMeta({
  sheet,
  canEdit,
  onComplete,
}: {
  sheet: ProductSheet;
  canEdit: boolean;
  /** « Compléter »: the « Identité » block in edit mode. */
  onComplete: () => void;
}) {
  const t = useT();
  const items: ReactNode[] = [
    <span key="pid">
      {t("products.metaPid")} <span className="font-mono font-medium text-primary">{sheet.pid}</span>
    </span>,
  ];
  if (sheet.category)
    items.push(
      <span key="cat">
        {t("products.metaCategory")} <span className="text-foreground">{withoutRate(sheet.category)}</span>
      </span>,
    );
  if (sheet.tva)
    items.push(
      <span key="tva">
        {t("products.metaTva")} <span className="text-foreground">{tvaShort(sheet.tva)}</span>
      </span>,
    );
  items.push(
    <span key="lab" className="inline-flex flex-wrap items-center gap-x-2">
      {t("products.metaLab")}
      {sheet.laboratoire ? (
        <span className="text-foreground">{sheet.laboratoire}</span>
      ) : (
        <>
          <span className="font-medium text-warning-subtle-foreground">{t("products.notSet")}</span>
          <Button variant="link" onClick={onComplete} disabled={!canEdit} className="font-semibold">
            {t("products.complete")}
          </Button>
        </>
      )}
    </span>,
  );
  if (sheet.stock.zone)
    items.push(
      <span key="zone" className="inline-flex items-center gap-1 text-foreground">
        <MapPin className="size-4 text-muted-foreground" aria-hidden />
        {sheet.stock.zone}
      </span>,
    );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-base">
        {items.flatMap((item, i) => (i === 0 ? [item] : [<Dot key={`dot-${i}`} />, item]))}
        <TypeBadge type={sheet.category_type} size="md" />
        <StockStateBadge stock={sheet.stock.current_stock} />
      </div>
      {sheet.barcode1 && (
        <span className="flex flex-wrap items-center gap-3">
          <BarcodeImage code={sheet.barcode1} className="h-8 w-20" />
          <span className="font-mono text-base font-semibold text-foreground">{sheet.barcode1}</span>
          <CopyButton value={sheet.barcode1} label={t("products.copyBarcode")} iconOnly />
        </span>
      )}
    </div>
  );
}

/** The stock at a glance: current (red under the minimum), minimum, maximum, « ≈ N jours de ventes ». */
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
    <Card as="div" padding="sm" tone={under ? "warning" : "default"} className="flex min-w-52 flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-6">
        <SectionTitle>{t("products.stock")}</SectionTitle>
        <span className={cn("font-mono text-3xl font-bold", under ? "text-error" : "text-foreground")}>
          {current == null ? "—" : formatQty(current)}
        </span>
      </span>
      {row("Min", min)}
      {row("Max", max)}
      {days != null && (
        <span className={cn("text-sm font-medium", under ? "text-warning-subtle-foreground" : "text-muted-foreground")}>
          {t("products.daysOfSales", { n: days })}
        </span>
      )}
    </Card>
  );
}

/** Right of the title: the stock box, then « Modifier » (owner; shown disabled for an employee, with the reason),
 *  « Étiquette » and « Commander N » (premium: « Premium » while the pharmacy does not have it; N = maximum − stock,
 *  disabled when nothing to order), « Observations » (their window). */
export function SheetActions({
  sheet,
  canEdit,
  editing,
  onEdit,
  unlocked,
  onPremium,
  onOpenNotes,
}: {
  sheet: ProductSheet;
  canEdit: boolean;
  /** A block is being edited: one at a time. */
  editing: boolean;
  onEdit: () => void;
  unlocked: Record<PremiumFeature, boolean>;
  onPremium: (feature: PremiumFeature) => void;
  onOpenNotes: () => void;
}) {
  const t = useT();
  const { current_stock: current, stock_max: max } = sheet.stock;
  const toOrder = Math.max(0, max - Math.max(0, current ?? 0));
  const notes = sheet.notes_count;
  const hint = (text: string) => <span className="max-w-56 text-xs text-muted-foreground">{text}</span>;
  return (
    <div className="flex flex-wrap items-start gap-3">
      <StockBox stock={sheet.stock} />
      <div className="flex min-w-48 flex-col gap-2">
        <Button variant="primary" onClick={onEdit} disabled={!canEdit || editing}>
          <Pencil className="size-4" />
          {t("common.edit")}
        </Button>
        {!canEdit && hint(t("products.ownerOnly"))}
        <Button variant="outline" onClick={() => onPremium("labels")}>
          <Printer className="size-4" />
          {t("products.label")}
          {!unlocked.labels && <PremiumTag />}
        </Button>
        <Button variant="outline" onClick={() => onPremium("orders")} disabled={toOrder <= 0}>
          <ShoppingCart className="size-4" />
          {toOrder > 0 ? t("products.order", { n: toOrder }) : t("products.orderNone")}
          {!unlocked.orders && <PremiumTag />}
        </Button>
        {toOrder <= 0 && hint(t("products.orderEnough"))}
        <Button variant="outline" onClick={onOpenNotes}>
          <StickyNote className="size-4" />
          {t("products.observations")}
          {notes > 0 && <Badge tone="warning">{notes}</Badge>}
        </Button>
      </div>
    </div>
  );
}
