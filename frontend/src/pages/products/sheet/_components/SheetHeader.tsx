/** Top of the product sheet, on every tab, in 3 bands: « Retour à la liste des produits »; the name +
 *  one line « PID · Catégorie · TVA » + type and stock badges; 3 tiles « Emplacement », « Code barre »,
 *  « Observations » (Tableau de bord tiles). « Modifier » is on each editable block (`Editable.tsx`). */
import { ArrowLeft, Barcode, ChevronRight, MapPin, StickyNote } from "lucide-react";
import { Link } from "react-router-dom";

import { KpiTile } from "@/_components/KpiTile";
import { TypeBadge } from "@/_components/TypeBadge";
import { ROUTES, type ProductSheet } from "@/types";
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";

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

/** Under the name, one line: « PID : … · Catégorie : … · TVA : … », then the type and stock badges. */
export function SheetMeta({ sheet }: { sheet: ProductSheet }) {
  const t = useT();
  const dot = (
    <span aria-hidden className="text-muted-foreground">
      ·
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-base">
      <span>
        {t("products.metaPid")} <span className="font-mono font-medium text-primary">{sheet.pid}</span>
      </span>
      {sheet.category && (
        <>
          {dot}
          <span>
            {t("products.metaCategory")} <span className="text-foreground">{withoutRate(sheet.category)}</span>
          </span>
        </>
      )}
      {sheet.tva && (
        <>
          {dot}
          <span>
            {t("products.metaTva")} <span className="text-foreground">{tvaShort(sheet.tva)}</span>
          </span>
        </>
      )}
      <TypeBadge type={sheet.category_type} size="md" />
      <StockStateBadge stock={sheet.stock.current_stock} />
    </div>
  );
}

/** Under the title, 3 tiles: « Emplacement » (where it is on the shelves, big), « Code barre » (drawn +
 *  number + copy), « Observations » (the whole tile opens their window; orange icon when there are
 *  some). « Non disponible » / « Aucune » when empty. */
export function SheetFacts({
  zone,
  barcode,
  notes,
  onOpenNotes,
}: {
  zone: string | null;
  barcode: string | null;
  notes: number;
  onOpenNotes: () => void;
}) {
  const t = useT();
  const none = <span className="text-base text-muted-foreground">{t("products.notAvailable")}</span>;
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <KpiTile label={t("products.location")} icon={<MapPin className="size-5" />}>
        {zone ? <span className="break-words text-xl font-bold text-foreground">{zone}</span> : none}
      </KpiTile>
      <KpiTile label={t("products.barcode")} icon={<Barcode className="size-5" />}>
        {barcode ? (
          <span className="flex flex-wrap items-center gap-3">
            <BarcodeImage code={barcode} className="h-9 w-20" />
            <span className="font-mono text-base font-semibold text-foreground">{barcode}</span>
            <CopyButton value={barcode} label={t("products.copyBarcode")} iconOnly />
          </span>
        ) : (
          none
        )}
      </KpiTile>
      <KpiTile
        label={t("products.observations")}
        icon={<StickyNote className="size-5" />}
        iconTone={notes > 0 ? "warning" : "primary"}
        onClick={onOpenNotes}
      >
        <span className="flex items-center justify-between gap-3">
          <span className={cn("text-xl font-bold", notes > 0 ? "text-foreground" : "text-muted-foreground")}>
            {notes > 0 ? t("products.notesN", { n: notes }) : t("products.notesNone")}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
            {t(notes > 0 ? "products.notesSee" : "products.notesAddShort")}
            <ChevronRight className="size-4" />
          </span>
        </span>
      </KpiTile>
    </div>
  );
}
