/** Top of the product sheet, on every tab: « Retour à la liste des produits » + breadcrumb,
 *  « PID | Catégorie | TVA », « Emplacement » (where it is on the shelves), type + stock
 *  badges, « Code barre(s) » card, « Modifier » (owner) / « Annuler » + « Enregistrer ». */
import { ArrowLeft, ChevronRight, House, MapPin, Pencil, Save, X } from "lucide-react";
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

/** « Emplacement »: where the product is (« PLACARD 2 », the stock file's « Zone » or the owner's),
 *  big, first thing seen on every tab; « Non disponible » without one. */
export function LocationCard({ zone }: { zone: string | null }) {
  const t = useT();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <MapPin className="size-6" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold text-muted-foreground">{t("products.location")}</span>
        {zone ? (
          <span className="break-words text-xl font-bold text-foreground">{zone}</span>
        ) : (
          <span className="text-base text-muted-foreground">{t("products.notAvailable")}</span>
        )}
      </div>
    </div>
  );
}

/** « Code barre(s) »: barcode 1 drawn + its number + copy; « Non disponible » without one. */
export function BarcodeCard({ code }: { code: string | null }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3">
      <span className="text-sm font-semibold text-foreground">{t("products.barcodes")}</span>
      {code ? (
        <div className="flex items-center gap-3">
          <BarcodeImage code={code} className="h-11 w-24" />
          <span className="font-mono text-sm text-foreground">{code}</span>
          <CopyButton value={code} label={t("products.copyBarcode")} iconOnly />
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">{t("products.notAvailable")}</span>
      )}
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
