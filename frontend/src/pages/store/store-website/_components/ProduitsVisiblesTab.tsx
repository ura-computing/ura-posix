import { useMemo } from "react";
import { Search, Eye, EyeOff } from "lucide-react";

import { SingleSelect, type SingleSelectOption } from "@/_components/molecules/SingleSelect";
import { Button } from "@/_components/atoms/Button";
import { Switch } from "./switch";
import { soldeLockFor, type RequestState, type StoreCategory, type VisibleProduct } from "@/types/storeWebsite";
import { cn } from "@/utils/cn";

import { discountPct, formatMAD } from "../_format";

/** TAB 3 — PRODUITS VISIBLES.
 *
 *  - Header strip: visible count + en-SOLDE count
 *  - State-aware SOLDE banner (success / warning / success)
 *  - Filter bar: search + category chips + bulk visibility
 *  - Desktop: table. Mobile: stacked cards.
 *  - SOLDE input validation: sale price must be strictly less than PPV.
 *  - SOLDE controls fully disabled when banner is amber (state ∈
 *    {prise_en_charge, en_cours}). */

export interface ProduitsVisiblesTabProps {
  products: VisibleProduct[];
  categories: StoreCategory[];
  /** Active request state (null when no request). Drives the lock banner. */
  requestState: RequestState | null;
  isLoading?: boolean;
  search: string;
  onSearch: (q: string) => void;
  selectedCategoryIds: string[];
  onSelectedCategories: (ids: string[]) => void;
  onToggleVisible: (productId: string, visible: boolean) => void;
  onBulkVisibility: (visible: boolean) => void;
  onAssignCategory: (productId: string, categoryId: string | null) => void;
  onSetSolde: (productId: string, solde: number | null) => void;
}

export function ProduitsVisiblesTab(props: ProduitsVisiblesTabProps) {
  const { products, categories, requestState, isLoading } = props;
  const lock = soldeLockFor(requestState);
  const soldeDisabled = lock === "locked_dev";

  // One options list shared across every row + mobile card. Memo'd here so it
  // doesn't recompute 8× per render.
  const categoryOptions: SingleSelectOption[] = useMemo(
    () => [
      { value: "", label: "Autres" },
      ...categories.filter((c) => !c.isDefault).map((c) => ({ value: c.id, label: c.name })),
    ],
    [categories],
  );

  if (isLoading) {
    return <div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />;
  }

  const visibleCount = products.filter((p) => p.visible).length;
  const soldeCount = products.filter((p) => p.solde != null).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-2 text-sm">
        <span className="font-mono font-semibold tabular-nums text-foreground">{visibleCount}</span>
        <span className="text-muted-foreground">produits visibles ·</span>
        <span className="font-mono font-semibold tabular-nums text-foreground">{soldeCount}</span>
        <span className="text-muted-foreground">en SOLDE</span>
      </div>

      <SoldeBanner lock={lock} />

      {/* Filter bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-2">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={props.search}
              onChange={(e) => props.onSearch(e.target.value)}
              placeholder="Rechercher un produit…"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => props.onBulkVisibility(true)}>
              <Eye className="size-3.5" />
              Tout afficher
            </Button>
            <Button variant="secondary" size="sm" onClick={() => props.onBulkVisibility(false)}>
              <EyeOff className="size-3.5" />
              Tout cacher
            </Button>
          </div>
        </div>

        <CategoryChips
          categories={categories}
          selected={props.selectedCategoryIds}
          onChange={props.onSelectedCategories}
        />
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-subtle text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="w-16 px-4 py-2.5">Visible</th>
              <th className="px-4 py-2.5">Produit</th>
              <th className="px-4 py-2.5">Catégorie boutique</th>
              <th className="px-4 py-2.5 text-right">Stock</th>
              <th className="px-4 py-2.5 text-right">PPV</th>
              <th className="px-4 py-2.5 text-right">SOLDE</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                categoryOptions={categoryOptions}
                soldeDisabled={soldeDisabled}
                onToggleVisible={props.onToggleVisible}
                onAssignCategory={props.onAssignCategory}
                onSetSolde={props.onSetSolde}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            categoryOptions={categoryOptions}
            soldeDisabled={soldeDisabled}
            onToggleVisible={props.onToggleVisible}
            onAssignCategory={props.onAssignCategory}
            onSetSolde={props.onSetSolde}
          />
        ))}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function CategoryChips({
  categories,
  selected,
  onChange,
}: {
  categories: StoreCategory[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((c) => {
        const on = selected.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            data-on={on}
            onClick={() => toggle(c.id)}
            className="cursor-pointer rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-subtle data-[on=true]:border-primary data-[on=true]:bg-primary data-[on=true]:text-primary-foreground"
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

function SoldeBanner({ lock }: { lock: ReturnType<typeof soldeLockFor> }) {
  const BANNERS = {
    editable: {
      cls: "border-success-border bg-success-subtle text-success-subtle-foreground",
      text: "Vous pouvez modifier les SOLDES.",
    },
    locked_dev: {
      cls: "border-warning-border bg-warning-subtle text-warning-subtle-foreground",
      text: "Le développeur travaille sur votre site, les SOLDES sont verrouillés jusqu'à la livraison.",
    },
    live: {
      cls: "border-success-border bg-success-subtle text-success-subtle-foreground",
      text: "Modifications visibles sur votre site dès la prochaine visite.",
    },
  } as const;
  const b = BANNERS[lock];
  return <p className={`rounded-lg border px-3 py-2 text-sm font-medium ${b.cls}`}>{b.text}</p>;
}

interface RowProps {
  product: VisibleProduct;
  categoryOptions: SingleSelectOption[];
  soldeDisabled: boolean;
  onToggleVisible: (id: string, v: boolean) => void;
  onAssignCategory: (id: string, categoryId: string | null) => void;
  onSetSolde: (id: string, solde: number | null) => void;
}

/** Composite SOLDE cell: a single input with the discount % tucked inside
 *  the input's right edge (no more two-pill cramped layout). */
function PriceCell({ product, soldeDisabled, onSetSolde }: Pick<RowProps, "product" | "soldeDisabled" | "onSetSolde">) {
  const onSale = product.solde != null;
  const pctText = onSale ? discountPct(product.ppv, product.solde!) : null;

  return (
    <div className="flex items-center justify-end">
      <div className="relative w-28">
        <input
          type="number"
          inputMode="decimal"
          disabled={soldeDisabled}
          defaultValue={product.solde ?? ""}
          placeholder="—"
          onBlur={(e) => {
            const raw = e.target.value;
            if (!raw) {
              onSetSolde(product.id, null);
              return;
            }
            const val = Number(raw);
            // SOLDE must be strictly less than PPV. Reject silently — caller
            // surfaces a toast/inline error in a real wiring; here we just
            // revert to the previous value.
            if (val >= product.ppv) {
              e.target.value = product.solde?.toString() ?? "";
              return;
            }
            onSetSolde(product.id, val);
          }}
          className={cn(
            "w-full rounded-md border border-border bg-surface-subtle px-2 py-1 text-right font-mono text-sm tabular-nums text-foreground outline-none focus:border-primary disabled:opacity-50",
            onSale && "pr-12",
          )}
        />
        {pctText && (
          <span
            aria-hidden
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] font-bold tracking-tight text-error-subtle-foreground"
          >
            {pctText}
          </span>
        )}
      </div>
    </div>
  );
}

function ProductRow(props: RowProps) {
  const { product, categoryOptions, soldeDisabled, onToggleVisible, onAssignCategory, onSetSolde } = props;
  const onSale = product.solde != null;
  return (
    <tr className="border-b border-border last:border-0 transition-colors hover:bg-surface-subtle/50">
      <td className="px-4 py-3">
        <Switch checked={product.visible} onCheckedChange={(v) => onToggleVisible(product.id, v)} />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{product.name}</span>
          <span className="text-[11px] text-muted-foreground">{product.sobrusCategory}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <SingleSelect
          label=""
          options={categoryOptions}
          value={product.storeCategoryId ?? ""}
          onChange={(v) => onAssignCategory(product.id, v || null)}
          placement="bottom"
          align="start"
        />
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums text-muted-foreground">{product.stock}</td>
      <td className="px-4 py-3 text-right font-mono text-sm tabular-nums">
        <span className={onSale ? "text-muted-foreground line-through" : "text-foreground"}>
          {formatMAD(product.ppv)}
        </span>
      </td>
      <td className="px-4 py-3">
        <PriceCell product={product} soldeDisabled={soldeDisabled} onSetSolde={onSetSolde} />
      </td>
    </tr>
  );
}

function ProductCard(props: RowProps) {
  const { product, categoryOptions, soldeDisabled, onToggleVisible, onAssignCategory, onSetSolde } = props;
  const onSale = product.solde != null;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{product.name}</span>
          <span className="text-[11px] text-muted-foreground">{product.sobrusCategory}</span>
        </div>
        <Switch checked={product.visible} onCheckedChange={(v) => onToggleVisible(product.id, v)} />
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <SingleSelect
          label=""
          options={categoryOptions}
          value={product.storeCategoryId ?? ""}
          onChange={(v) => onAssignCategory(product.id, v || null)}
          placement="bottom"
          align="start"
        />
        <span className="font-mono text-xs tabular-nums text-muted-foreground">Stock {product.stock}</span>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <span
          className={`font-mono text-sm tabular-nums ${
            onSale ? "text-muted-foreground line-through" : "font-semibold text-foreground"
          }`}
        >
          {formatMAD(product.ppv)}
        </span>
        <PriceCell product={product} soldeDisabled={soldeDisabled} onSetSolde={onSetSolde} />
      </div>
    </div>
  );
}
