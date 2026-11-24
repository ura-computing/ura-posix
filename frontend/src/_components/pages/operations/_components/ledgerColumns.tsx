/** What Ventes and Achats share, word for word: the product / category / type / TVA / quantity columns and the active
 *  filter chips (also `LedgerFooter.tsx`, `useRefParam.ts`). Each page keeps its own columns, tabs and gauges. */
import type { ActiveFilter } from "@/_components/organisms/FilterBar";
import type { ColumnDef } from "@/_components/organisms/DataTable";
import { TypeBadge } from "@/_components/molecules/TypeBadge";
import type { TFn } from "@/i18n/I18nProvider";
import { formatQty } from "@/utils/format";

/** The fields both ledgers' rows have. */
interface LedgerRow {
  pid: string | null;
  product: string | null;
  category: string | null;
  category_type: "pharmacie" | "parapharmacie" | null;
  tva: string | null;
  quantity: number | null;
}

/** Produit (+ PID) · Catégorie · Type · TVA · Qté. `typeKey`: the type column's sort key (Achats `category_type`,
 *  Ventes `type`). */
export function ledgerProductColumns<T extends LedgerRow>(
  t: TFn,
  { productWidth, typeKey }: { productWidth: number; typeKey: string },
): ColumnDef<T>[] {
  return [
    {
      key: "product",
      label: t("col.produit"),
      width: productWidth,
      render: (r) => (
        <div className="flex flex-col">
          <span className="truncate text-base" title={r.product ?? ""}>
            {r.product ?? "—"}
          </span>
          <span className="truncate font-mono text-[11px] text-muted-foreground">{r.pid ?? ""}</span>
        </div>
      ),
    },
    {
      key: "category",
      label: t("col.categorie"),
      width: 160,
      render: (r) => (
        <span className="block max-w-[150px] truncate text-sm text-muted-foreground">{r.category ?? "—"}</span>
      ),
    },
    {
      key: typeKey,
      label: t("col.type"),
      width: 110,
      sortable: false,
      render: (r) => <TypeBadge type={r.category_type} />,
    },
    {
      key: "tva",
      label: t("col.tva"),
      width: 80,
      sortable: false,
      render: (r) =>
        r.tva ? (
          <span className="font-mono text-xs text-muted-foreground">{r.tva}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "quantity",
      label: t("col.qte"),
      width: 70,
      align: "right",
      render: (r) => (r.quantity != null ? formatQty(r.quantity) : "—"),
    },
  ];
}

interface LedgerFilters {
  ref?: string;
  search: string;
  date_from: string | null;
  date_to: string | null;
  category: string[];
  tva: string[];
}

/** The chips above the table (BL / ticket, search, dates, categories, TVA), each with its ✕. `refLabel`: « BL » or
 *  « Ticket ». */
export function ledgerActiveFilters(
  t: TFn,
  filters: LedgerFilters,
  {
    refLabel,
    clearRef,
    setSearch,
    setDateRange,
    setCategories,
    setTva,
  }: {
    refLabel: string;
    clearRef: () => void;
    setSearch: (v: string) => void;
    setDateRange: (from: string | null, to: string | null) => void;
    setCategories: (v: string[]) => void;
    setTva: (v: string[]) => void;
  },
): ActiveFilter[] {
  return [
    filters.ref
      ? {
          key: "ref",
          label: (
            <>
              {refLabel} {filters.ref}
            </>
          ),
          onClear: clearRef,
        }
      : null,
    filters.search
      ? {
          key: "search",
          label: (
            <>
              {t("common.recherche")} {filters.search}
            </>
          ),
          onClear: () => setSearch(""),
        }
      : null,
    filters.date_from || filters.date_to
      ? {
          key: "dates",
          label: (
            <>
              {filters.date_from ?? "…"} → {filters.date_to ?? "…"}
            </>
          ),
          onClear: () => setDateRange(null, null),
        }
      : null,
    filters.category.length > 0
      ? {
          key: "category",
          label: (
            <>
              {t("dashboard.categorieFilter")} {filters.category[0]}
              {filters.category.length > 1 ? `, +${filters.category.length - 1}` : ""}
            </>
          ),
          onClear: () => setCategories([]),
        }
      : null,
    filters.tva.length > 0
      ? {
          key: "tva",
          label: (
            <>
              {t("common.tvaFilter")} {filters.tva.length}
            </>
          ),
          onClear: () => setTva([]),
        }
      : null,
  ].filter(Boolean) as ActiveFilter[];
}
