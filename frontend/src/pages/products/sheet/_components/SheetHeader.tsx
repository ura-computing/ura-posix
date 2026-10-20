/** Top of the product sheet, on every tab: « Retour à la liste des produits » + breadcrumb,
 *  « PID | Catégorie | TVA », type + stock badges, « Modifier » (owner) / « Annuler » + « Enregistrer »;
 *  under them one strip: « Emplacement », « Code barre », « Observations ». */
import { type ReactNode } from "react";
import { ArrowLeft, Barcode, ChevronRight, House, MapPin, Pencil, Save, StickyNote, X } from "lucide-react";
import { Link } from "react-router-dom";

import { AsyncButton } from "@/_components/AsyncButton";
import { TypeBadge } from "@/_components/TypeBadge";
import { ROUTES, type ProductSheet } from "@/types";
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";

import type { SheetEditor } from "../hooks";
import { tvaShort, withoutRate } from "../labels";
import { BarcodeImage } from "./BarcodeImage";
import { CopyButton } from "./CopyButton";

/** A big « Retour à la liste des produits » (easy to spot), then « ⌂ › Produits › name ». */
export function SheetBreadcrumb({ name }: { name: string }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <Link
        to={ROUTES.PRODUITS}
        className="inline-flex h-11 w-fit items-center gap-2 rounded-lg border border-border bg-card px-4 text-base font-semibold text-foreground transition-colors hover:bg-surface-subtle"
      >
        <ArrowLeft className="size-5" />
        {t("products.backToList")}
      </Link>
      <Crumbs name={name} />
    </div>
  );
}

function Crumbs({ name }: { name: string }) {
  const t = useT();
  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Link to={ROUTES.HOME} aria-label={t("nav.home")} className="hover:text-foreground">
        <House className="size-4" />
      </Link>
      <ChevronRight className="size-3.5" />
      <Link to={ROUTES.PRODUITS} className="hover:text-foreground">
        {t("products.title")}
      </Link>
      <ChevronRight className="size-3.5" />
      <span className="truncate font-medium text-foreground">{name}</span>
    </nav>
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

/** Under the name: « PID : … | Catégorie : … | TVA : … », then the type and stock badges. */
export function SheetMeta({ sheet }: { sheet: ProductSheet }) {
  const t = useT();
  const bar = (
    <span aria-hidden className="text-border">
      |
    </span>
  );
  return (
    <div className="flex flex-col gap-3">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base">
        <span>
          {t("products.metaPid")} <span className="font-mono font-medium text-primary">{sheet.pid}</span>
        </span>
        {sheet.category && (
          <>
            {bar}
            <span>
              {t("products.metaCategory")} <span className="text-foreground">{withoutRate(sheet.category)}</span>
            </span>
          </>
        )}
        {sheet.tva && (
          <>
            {bar}
            <span>
              {t("products.metaTva")} <span className="text-foreground">{tvaShort(sheet.tva)}</span>
            </span>
          </>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <TypeBadge type={sheet.category_type} size="md" />
        <StockStateBadge stock={sheet.stock.current_stock} />
      </div>
    </div>
  );
}

/** One cell of the strip under the title: icon, label, value — every cell the same height. */
function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-5 py-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        {children}
      </div>
    </div>
  );
}

/** Under the title, one strip of 3 equal cells: « Emplacement » (where it is on the shelves, big),
 *  « Code barre » (drawn + number + copy), « Observations » (the whole cell opens their window;
 *  orange when there are some). « Non disponible » / « Aucune » when empty. */
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
    <div className="grid overflow-hidden rounded-xl border border-border bg-card max-md:divide-y max-md:divide-border md:grid-cols-3 md:divide-x md:divide-border">
      <Fact icon={<MapPin className="size-5" />} label={t("products.location")}>
        {zone ? <span className="break-words text-xl font-bold text-foreground">{zone}</span> : none}
      </Fact>
      <Fact icon={<Barcode className="size-5" />} label={t("products.barcode")}>
        {barcode ? (
          <span className="flex flex-wrap items-center gap-3">
            <BarcodeImage code={barcode} className="h-9 w-20" />
            <span className="font-mono text-base font-semibold text-foreground">{barcode}</span>
            <CopyButton value={barcode} label={t("products.copyBarcode")} iconOnly />
          </span>
        ) : (
          none
        )}
      </Fact>
      <button
        type="button"
        onClick={onOpenNotes}
        className="flex min-w-0 cursor-pointer items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-subtle"
      >
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            notes > 0 ? "bg-warning-subtle text-warning-subtle-foreground" : "bg-primary/10 text-primary",
          )}
        >
          <StickyNote className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm text-muted-foreground">{t("products.observations")}</span>
          <span className={cn("text-xl font-bold", notes > 0 ? "text-foreground" : "text-muted-foreground")}>
            {notes > 0 ? t("products.notesN", { n: notes }) : t("products.notesNone")}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
          {t(notes > 0 ? "products.notesSee" : "products.notesAddShort")}
          <ChevronRight className="size-4" />
        </span>
      </button>
    </div>
  );
}

/** Owner: « Modifier », then « Annuler » + « Enregistrer ». Employee: « Modifier » shown,
 *  disabled, with the reason under it. */
export function EditActions({ editor, onStart }: { editor: SheetEditor; onStart: () => void }) {
  const t = useT();
  if (editor.editing) {
    return (
      <>
        <AsyncButton variant="secondary" onClick={editor.cancel} disabled={editor.isSaving}>
          <X className="size-4" />
          {t("common.cancel")}
        </AsyncButton>
        <AsyncButton
          variant="primary"
          onClick={() => void editor.save()}
          isLoading={editor.isSaving}
          loadingText={t("products.saving")}
        >
          <Save className="size-4" />
          {t("common.save")}
        </AsyncButton>
      </>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <AsyncButton variant="primary" onClick={onStart} disabled={!editor.canEdit}>
        <Pencil className="size-4" />
        {t("common.edit")}
      </AsyncButton>
      {!editor.canEdit && <span className="text-xs text-muted-foreground">{t("products.ownerOnly")}</span>}
    </div>
  );
}
