/** « Produits »: every product of the pharmacy, one switch « Sur le site » each, and a promo price. Changes show on
 *  the site at once (live too). Filters: Tous · Sur le site · Cachés · En promo, a search. */
import { useState } from "react";
import { Package, Percent } from "lucide-react";

import { Badge } from "@/_components/atoms/Badge";
import { Button } from "@/_components/atoms/Button";
import { Switch } from "@/_components/atoms/Switch";
import { LoadError } from "@/_components/molecules/LoadError";
import { Thumbnail } from "@/_components/molecules/Thumbnail";
import { DataTable, type ColumnDef } from "@/_components/organisms/DataTable";
import { FilterBar } from "@/_components/organisms/FilterBar";
import { useT } from "@/i18n/I18nProvider";
import type { OwnerProduct, OwnerProductsView } from "@/types/storeWebsite";
import { formatMADStr } from "@/utils/format";

import { useMyProducts } from "../hooks";
import { PromoDialog } from "./PromoDialog";

export function ProductsTab() {
  const t = useT();
  const [view, setView] = useState<OwnerProductsView>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [promoFor, setPromoFor] = useState<OwnerProduct | null>(null);
  const { products, total, counts, isLoading, isError, reload, setProduct } = useMyProducts({
    view,
    search,
    page,
    limit: pageSize,
  });

  const columns: ColumnDef<OwnerProduct>[] = [
    {
      key: "product",
      label: t("myStore.colProduct"),
      sortable: false,
      render: (p) => (
        <div className="flex items-center gap-3">
          <Thumbnail
            key={p.photo}
            src={p.photo}
            alt={p.name}
            icon={Package}
            label={t("products.noPhoto")}
            className="size-11 p-0.5"
          />
          <div className="flex min-w-0 flex-col">
            <span className="text-[13px] font-semibold text-foreground">{p.name}</span>
            <span className="text-xs text-muted-foreground">
              {[p.category, p.laboratoire].filter(Boolean).join(" · ")}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "ppv",
      label: t("myStore.colPrice"),
      sortable: false,
      render: (p) => <span className="font-mono tabular-nums">{p.ppv != null ? formatMADStr(p.ppv) : "—"}</span>,
    },
    {
      key: "promo",
      label: t("myStore.colPromo"),
      sortable: false,
      render: (p) => (
        <Button variant={p.promo_price != null ? "secondary" : "outline"} size="sm" onClick={() => setPromoFor(p)}>
          <Percent className="size-3.5" />
          {p.promo_price != null ? formatMADStr(p.promo_price) : t("myStore.promoAdd")}
        </Button>
      ),
    },
    {
      key: "shown",
      label: t("myStore.colShown"),
      align: "right",
      sortable: false,
      render: (p) => (
        <div className="flex items-center justify-end gap-2">
          {p.hidden && <Badge>{t("myStore.hidden")}</Badge>}
          <Switch
            checked={!p.hidden}
            onChange={(on) => void setProduct({ id: p.id, patch: { hidden: !on } })}
            aria-label={t("myStore.colShown")}
          />
        </div>
      ),
    },
  ];

  const filters = (v: OwnerProductsView) => {
    setView(v);
    setPage(1);
  };

  return (
    <>
      <p className="text-sm text-muted-foreground">{t("myStore.productsIntro")}</p>
      <FilterBar<OwnerProductsView>
        search={{
          value: search,
          onChange: (v) => {
            setSearch(v);
            setPage(1);
          },
          placeholder: t("myStore.searchPh"),
          suggestions: null,
        }}
        segment={{
          value: view,
          onChange: filters,
          options: [
            { value: "all", label: t("myStore.viewAll", { n: counts.all }) },
            { value: "shown", label: t("myStore.viewShown", { n: counts.all - counts.hidden }) },
            { value: "hidden", label: t("myStore.viewHidden", { n: counts.hidden }) },
            { value: "promo", label: t("myStore.viewPromo", { n: counts.promo }) },
          ],
        }}
      />
      {isError ? (
        <LoadError message={t("myStore.loadError")} onRetry={reload} />
      ) : (
        <DataTable
          rows={products}
          columns={columns}
          isLoading={isLoading}
          rowKey={(p) => p.id}
          emptyTitle={t("myStore.productsEmpty")}
          pagination={{ page, pageSize, total, onPage: setPage, onPageSize: setPageSize }}
        />
      )}
      {promoFor && (
        <PromoDialog
          key={promoFor.id}
          product={promoFor}
          onClose={() => setPromoFor(null)}
          onSave={(promo) => setProduct({ id: promoFor.id, patch: { promo_price: promo } })}
        />
      )}
    </>
  );
}
