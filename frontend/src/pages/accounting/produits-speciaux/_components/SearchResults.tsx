/** What one tab's search found, each line with ONE button that excludes it at once:
 *   - Produits: « Exclure » (its sales and purchases)
 *   - Bons de livraison (by reference or by a product they hold, « Fournisseur » filter): « Exclure »
 *     (every product on it), « Contenu » = its lines
 *   - Produit sur un BL: « Voir ses BL » → tick a BL = only that purchase of the product leaves
 *     (untick = back)
 *   - Fournisseurs: « Exclure » (every product bought from it)
 *  Already excluded: « déjà exclu », no button (« Réintégrer » is in the list below). */
import { useState, type ReactNode } from "react";
import { Building2, ChevronRight, FileText, Package } from "lucide-react";

import { Badge } from "@/_components/atoms/Badge";
import { Button } from "@/_components/atoms/Button";
import { cn } from "@/utils/cn";
import { Checkbox } from "@/_components/atoms/Checkbox";
import { SingleSelect } from "@/_components/molecules/SingleSelect";
import { SkeletonRows, SkeletonText } from "@/_components/molecules/Skeletons";
import { Card } from "@/_components/atoms/Card";
import { useT, type TFn } from "@/i18n/I18nProvider";
import type { BlSummary, MedicamentSuggestion, SupplierSummary } from "@/types";
import { formatDate, formatMAD, formatNumStr, formatQty } from "@/utils/format";

import { useBlDetail, useProductBlLines, type ExclusionTarget } from "../hooks";

/** « déjà exclu » next to a found BL / supplier. */
function AlreadyExcluded() {
  const t = useT();
  return <Badge>{t("ps.dejaExclu")}</Badge>;
}

/** « Fournisseur » filter over the suppliers found (shown when there are 2 or more). */
function SupplierFilter({
  suppliers,
  value,
  onChange,
}: {
  suppliers: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useT();
  if (suppliers.length < 2) return null;
  return (
    <SingleSelect
      label={t("ps.fournisseur")}
      options={[{ value: "", label: t("ps.tousFournisseurs") }, ...suppliers.map((s) => ({ value: s, label: s }))]}
      value={suppliers.includes(value) ? value : ""}
      onChange={onChange}
      align="end"
    />
  );
}

const suppliersOf = (rows: { supplier: string | null }[]) =>
  [...new Set(rows.map((r) => r.supplier).filter((s): s is string => !!s))].sort();

/** The lines found (`title` names the list), « Rien trouvé » when none, a spinner while it searches. */
function Found({
  title,
  q,
  count,
  isSearching,
  extra,
  children,
}: {
  title: string;
  q: string;
  count: number;
  isSearching: boolean;
  extra?: ReactNode;
  children: ReactNode;
}) {
  const t = useT();
  if (count === 0) {
    return isSearching ? (
      <Card as="div" padding="none">
        <SkeletonRows rows={3} columns={3} />
      </Card>
    ) : (
      <p className="py-2 text-center text-sm text-muted-foreground">{t("ps.nothingFound", { q })}</p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {extra && <div className="flex justify-end">{extra}</div>}
      <ul aria-label={title} className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {children}
      </ul>
    </div>
  );
}

function Row({
  icon,
  title,
  facts,
  amount,
  actions,
  expand,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  facts: ReactNode;
  amount?: ReactNode;
  actions?: ReactNode;
  /** The line opens (its BL, its content): a › before the name, ⌄ once open; the whole name is the target. */
  expand?: { open: boolean; label: string; onToggle: () => void };
  children?: ReactNode;
}) {
  const head = (
    <>
      {expand && (
        <ChevronRight
          className={cn("size-5 shrink-0 text-primary transition-transform", expand.open && "rotate-90")}
          aria-hidden
        />
      )}
      <span className="text-muted-foreground">{icon}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2 text-base font-semibold text-foreground">{title}</div>
        <div className="truncate text-sm font-normal text-muted-foreground">{facts}</div>
      </div>
    </>
  );
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {expand ? (
          <Button
            variant="ghost"
            onClick={expand.onToggle}
            aria-expanded={expand.open}
            aria-label={expand.label}
            title={expand.label}
            className="-mx-2 h-auto min-w-0 flex-1 justify-start gap-3 whitespace-normal px-2 py-1.5 text-left"
          >
            {head}
          </Button>
        ) : (
          head
        )}
        {amount && <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{amount}</span>}
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </li>
  );
}

/** « Voir ses BL » / « Contenu »: opens one line's details. */
function ExcludeButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const t = useT();
  return (
    <Button disabled={disabled} onClick={onClick}>
      {t("ps.exclure")}
    </Button>
  );
}

const productFacts = (t: TFn, p: MedicamentSuggestion) =>
  [p.pid, p.category, t("ps.nbVentes", { n: formatNumStr(p.nb_ventes) })].filter(Boolean).join(" · ");

interface Common {
  q: string;
  isSearching: boolean;
  isExcluding: boolean;
  onExclude: (x: ExclusionTarget) => void;
}

/** « Produits »: the whole product leaves Comptabilité. */
export function ProductResults({
  products,
  q,
  isSearching,
  isExcluding,
  onExclude,
}: Common & { products: MedicamentSuggestion[] }) {
  const t = useT();
  return (
    <Found title={t("ps.groupProducts")} q={q} count={products.length} isSearching={isSearching}>
      {products.map((p) => (
        <Row
          key={p.id}
          icon={<Package className="size-5" />}
          title={<span className="truncate">{p.product}</span>}
          facts={productFacts(t, p)}
          actions={
            <ExcludeButton
              disabled={isExcluding}
              onClick={() => onExclude({ kind: "product", medicamentId: p.id, name: p.product })}
            />
          }
        />
      ))}
    </Found>
  );
}

/** « Contenu » of a BL: its product lines. */
function BlContent({ deliveryRef }: { deliveryRef: string }) {
  const t = useT();
  const { blLines, isLoadingLines, linesError } = useBlDetail(deliveryRef);
  if (isLoadingLines) return <SkeletonText lines={3} className="ml-8" />;
  if (linesError) return <p className="text-sm text-error">{t("ps.loadDetailErr")}</p>;
  return (
    <div className="ml-8 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface-subtle/50">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-surface-subtle text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-1.5 font-semibold">{t("col.produit")}</th>
            <th className="px-3 py-1.5 text-right font-semibold">{t("col.qte")}</th>
            <th className="px-3 py-1.5 text-right font-semibold">{t("col.puAchat")}</th>
            <th className="px-3 py-1.5 text-right font-semibold">{t("col.total")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {blLines.map((ln, i) => (
            <tr key={i}>
              <td className="max-w-[260px] truncate px-3 py-1.5 text-foreground" title={ln.product ?? ""}>
                {ln.product ?? "—"}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {ln.quantity != null ? formatQty(ln.quantity) : "—"}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {ln.unit_price != null ? formatMAD(ln.unit_price) : "—"}
              </td>
              <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                {ln.total != null ? formatMAD(ln.total) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** « Bons de livraison »: every product on the BL leaves Comptabilité. */
export function BlResults({ bls, q, isSearching, isExcluding, onExclude }: Common & { bls: BlSummary[] }) {
  const t = useT();
  const [opened, setOpened] = useState<string | null>(null);
  const [supplier, setSupplier] = useState("");
  const suppliers = suppliersOf(bls);
  const shown = supplier && suppliers.includes(supplier) ? bls.filter((b) => b.supplier === supplier) : bls;
  return (
    <Found
      title={t("ps.groupBls")}
      q={q}
      count={shown.length}
      isSearching={isSearching}
      extra={<SupplierFilter suppliers={suppliers} value={supplier} onChange={setSupplier} />}
    >
      {shown.map((b) => (
        <Row
          key={b.delivery_ref}
          icon={<FileText className="size-5" />}
          title={
            <>
              <span className="truncate font-mono">{b.delivery_ref}</span>
              {b.already_excluded && <AlreadyExcluded />}
            </>
          }
          facts={
            <>
              {[b.supplier ?? "—", formatDate(b.delivery_date), `${formatNumStr(b.nb_products)} ${t("ps.ref")}`].join(
                " · ",
              )}
              {b.matched_products.length > 0 && (
                <span className="text-primary">
                  {" "}
                  · {t("ps.contient")} {b.matched_products.join(", ")}
                </span>
              )}
            </>
          }
          amount={formatMAD(b.total)}
          expand={{
            open: opened === b.delivery_ref,
            label: t("ps.seeContent"),
            onToggle: () => setOpened(opened === b.delivery_ref ? null : b.delivery_ref),
          }}
          actions={
            <>
              {!b.already_excluded && (
                <ExcludeButton
                  disabled={isExcluding}
                  onClick={() => onExclude({ kind: "bl", ref: b.delivery_ref, name: `BL ${b.delivery_ref}` })}
                />
              )}
            </>
          }
        >
          {opened === b.delivery_ref && <BlContent deliveryRef={b.delivery_ref} />}
        </Row>
      ))}
    </Found>
  );
}

/** « Voir ses BL »: one checkbox per BL the product was bought on; tick = only that purchase leaves. */
function ProductBls({
  product,
  onExclude,
  onReintegrate,
}: {
  product: MedicamentSuggestion;
  onExclude: (x: ExclusionTarget) => void;
  onReintegrate: (x: ExclusionTarget) => void;
}) {
  const t = useT();
  const [supplier, setSupplier] = useState("");
  const { productLines, isLoadingProductLines, productLinesError } = useProductBlLines(product.id);
  const suppliers = suppliersOf(productLines);
  const shown =
    supplier && suppliers.includes(supplier) ? productLines.filter((l) => l.supplier === supplier) : productLines;
  return (
    <div className="ml-8 flex flex-col gap-2 rounded-lg border border-border bg-surface-subtle/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{t("ps.linesHint")}</span>
        <SupplierFilter suppliers={suppliers} value={supplier} onChange={setSupplier} />
      </div>
      {isLoadingProductLines ? (
        <SkeletonText lines={3} />
      ) : productLinesError ? (
        <p className="text-sm text-error">{t("ps.loadDetailErr")}</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("ps.lignesNone")}</p>
      ) : (
        <ul className="flex max-h-80 flex-col overflow-y-auto">
          {shown.map((l) => (
            <li key={l.delivery_ref}>
              <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 hover:bg-card">
                <Checkbox
                  checked={l.already_excluded}
                  aria-label={l.delivery_ref}
                  onChange={(on) => {
                    const target = {
                      kind: "line" as const,
                      medicamentId: product.id,
                      ref: l.delivery_ref,
                      ids: l.exclusion_id != null ? [l.exclusion_id] : [],
                      name: `${product.product} · BL ${l.delivery_ref}`,
                    };
                    if (on) onExclude(target);
                    else onReintegrate(target);
                  }}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  <span className="font-mono font-medium">{l.delivery_ref}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {l.supplier ?? "—"} · {formatDate(l.delivery_date)} · {t("col.qte")} {formatQty(l.quantity)}
                  </span>
                </span>
                <span className="font-mono text-sm font-semibold tabular-nums">{formatMAD(l.total)}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** « Produit sur un BL »: pick the product, then tick its BLs. */
export function LineResults({
  products,
  q,
  isSearching,
  onExclude,
  onReintegrate,
}: Common & { products: MedicamentSuggestion[]; onReintegrate: (x: ExclusionTarget) => void }) {
  const t = useT();
  const [opened, setOpened] = useState<number | null>(null);
  return (
    <Found title={t("ps.groupProducts")} q={q} count={products.length} isSearching={isSearching}>
      {products.map((p) => (
        <Row
          key={p.id}
          icon={<Package className="size-5" />}
          title={<span className="truncate">{p.product}</span>}
          facts={productFacts(t, p)}
          expand={{
            open: opened === p.id,
            label: t("ps.seeBls"),
            onToggle: () => setOpened(opened === p.id ? null : p.id),
          }}
        >
          {opened === p.id && <ProductBls product={p} onExclude={onExclude} onReintegrate={onReintegrate} />}
        </Row>
      ))}
    </Found>
  );
}

/** « Fournisseurs »: every product bought from it leaves Comptabilité. */
export function SupplierResults({
  suppliers,
  q,
  isSearching,
  isExcluding,
  onExclude,
}: Common & { suppliers: SupplierSummary[] }) {
  const t = useT();
  return (
    <Found title={t("ps.groupSuppliers")} q={q} count={suppliers.length} isSearching={isSearching}>
      {suppliers.map((s) => (
        <Row
          key={s.supplier}
          icon={<Building2 className="size-5" />}
          title={
            <>
              <span className="truncate">{s.supplier}</span>
              {s.already_excluded && <AlreadyExcluded />}
            </>
          }
          facts={t("ps.supplierDetail", { lines: formatNumStr(s.nb_lines), products: formatNumStr(s.nb_products) })}
          amount={formatMAD(s.total)}
          actions={
            !s.already_excluded && (
              <ExcludeButton
                disabled={isExcluding}
                onClick={() => onExclude({ kind: "supplier", supplier: s.supplier, name: s.supplier })}
              />
            )
          }
        />
      ))}
    </Found>
  );
}
