/** What one tab's search found. One control everywhere: the star (☆ still in Comptabilité, ★ taken out; a click
 *  toggles):
 *   - Produits: ★ = its sales and purchases out
 *   - BL (by reference or by a product it holds) and BL par Fournisseur (a supplier → « Voir ses BL »): the same BL
 *     rows: ★ on the BL = every product on it out; « Voir le contenu » → ★ on a product = only it, on that BL
 *   - Fournisseurs: ★ = every product bought from it out */
import { useState, type ReactNode } from "react";
import { Building2, ChevronRight, FileText, Package } from "lucide-react";

import { Badge } from "@/_components/atoms/Badge";
import { Button } from "@/_components/atoms/Button";
import { cn } from "@/utils/cn";
import { StarToggle } from "@/_components/atoms/StarToggle";
import { SkeletonRows, SkeletonText } from "@/_components/molecules/Skeletons";
import { Card } from "@/_components/atoms/Card";
import { useT, type TFn } from "@/i18n/I18nProvider";
import type { BlSummary, MedicamentSuggestion, SupplierSummary } from "@/types/exclusions";
import { formatDate, formatMAD, formatNumStr, formatQty } from "@/utils/format";

import { useBlDetail, useSupplierBls, type ExclusionTarget } from "../hooks";

/** « déjà exclu » next to a found BL / supplier. */
function AlreadyExcluded() {
  const t = useT();
  return <Badge>{t("ps.dejaExclu")}</Badge>;
}

/** The lines found (`title` names the list), « Rien trouvé » when none, a spinner while it searches. */
function Found({
  title,
  q,
  count,
  isSearching,
  children,
}: {
  title: string;
  q: string;
  count: number;
  isSearching: boolean;
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
    <ul aria-label={title} className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
      {children}
    </ul>
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

/** « Exclure » = a star ticked like a box: ☆ = still in Comptabilité (click → taken out), ★ = taken out (click → back
 *  in, like « Réintégrer »). Produits, BL, Fournisseurs. */
function ExcludeStar({
  excluded = false,
  disabled,
  onClick,
}: {
  excluded?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <StarToggle
      checked={excluded}
      disabled={disabled}
      onChange={onClick}
      aria-label={t("ps.exclure")}
      title={excluded ? t("ps.reintegrer") : t("ps.exclure")}
    />
  );
}

const productFacts = (t: TFn, p: MedicamentSuggestion) =>
  [p.pid, p.category, t("ps.nbVentes", { n: formatNumStr(p.nb_ventes) })].filter(Boolean).join(" · ");

/** What a star does (exclude / put back), passed down to every row. */
interface StarActions {
  isExcluding: boolean;
  onExclude: (x: ExclusionTarget) => void;
  onReintegrate: (x: ExclusionTarget) => void;
}

interface Common extends StarActions {
  q: string;
  isSearching: boolean;
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
            <ExcludeStar
              disabled={isExcluding}
              onClick={() => onExclude({ kind: "product", medicamentId: p.id, name: p.product })}
            />
          }
        />
      ))}
    </Found>
  );
}

/** A BL's content: its product lines, each with its star = that product out of Comptabilité on this BL only (its
 *  other BLs and its sales stay). The whole BL out: every line out, its stars filled and locked. */
function BlContent({ bl, isExcluding, onExclude, onReintegrate }: StarActions & { bl: BlSummary }) {
  const t = useT();
  const { blLines, isLoadingLines, linesError } = useBlDetail(bl.delivery_ref);
  if (isLoadingLines) return <SkeletonText lines={3} className="ml-8" />;
  if (linesError) return <p className="text-sm text-error">{t("ps.loadDetailErr")}</p>;
  return (
    <div className="ml-8 max-h-72 overflow-y-auto rounded-lg border border-border bg-surface-subtle/50">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-surface-subtle text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="w-10 px-3 py-1.5" aria-label={t("ps.exclure")} />
            <th className="px-3 py-1.5 font-semibold">{t("col.produit")}</th>
            <th className="px-3 py-1.5 text-right font-semibold">{t("col.qte")}</th>
            <th className="px-3 py-1.5 text-right font-semibold">{t("col.puAchat")}</th>
            <th className="px-3 py-1.5 text-right font-semibold">{t("col.total")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {blLines.map((ln, i) => {
            const out = ln.exclusion_id != null;
            return (
              <tr key={i}>
                <td className="px-3 py-1.5">
                  <StarToggle
                    checked={bl.already_excluded || out}
                    disabled={bl.already_excluded || isExcluding || ln.medicament_id == null}
                    aria-label={ln.product ?? t("ps.exclure")}
                    title={bl.already_excluded ? t("ps.wholeBlOut") : out ? t("ps.reintegrer") : t("ps.exclure")}
                    onChange={() => {
                      if (ln.medicament_id == null) return;
                      const target = {
                        kind: "line" as const,
                        medicamentId: ln.medicament_id,
                        ref: bl.delivery_ref,
                        ids: ln.exclusion_id != null ? [ln.exclusion_id] : [],
                        name: `${ln.product ?? ""} · BL ${bl.delivery_ref}`,
                      };
                      if (out) onReintegrate(target);
                      else onExclude(target);
                    }}
                  />
                </td>
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** One BL, the same in « BL » and « BL par Fournisseur »: ★ = the whole BL out; « Voir le contenu » = its products. */
function BlRow({
  bl,
  open,
  onToggle,
  ...actions
}: StarActions & { bl: BlSummary; open: boolean; onToggle: () => void }) {
  const t = useT();
  const { isExcluding, onExclude, onReintegrate } = actions;
  return (
    <Row
      icon={<FileText className="size-5" />}
      title={
        <>
          <span className="truncate font-mono">{bl.delivery_ref}</span>
          {bl.already_excluded && <AlreadyExcluded />}
        </>
      }
      facts={
        <>
          {[bl.supplier ?? "—", formatDate(bl.delivery_date), `${formatNumStr(bl.nb_products)} ${t("ps.ref")}`].join(
            " · ",
          )}
          {bl.matched_products.length > 0 && (
            <span className="text-primary">
              {" "}
              · {t("ps.contient")} {bl.matched_products.join(", ")}
            </span>
          )}
        </>
      }
      amount={formatMAD(bl.total)}
      expand={{ open, label: t("ps.seeContent"), onToggle }}
      actions={
        <ExcludeStar
          excluded={bl.already_excluded}
          disabled={isExcluding}
          onClick={() => {
            const target = { kind: "bl" as const, ref: bl.delivery_ref, name: `BL ${bl.delivery_ref}` };
            if (bl.already_excluded) onReintegrate(target);
            else onExclude(target);
          }}
        />
      }
    >
      {open && <BlContent bl={bl} {...actions} />}
    </Row>
  );
}

/** « BL »: the BLs found by reference or by a product they hold. */
export function BlResults({ bls, q, isSearching, ...actions }: Common & { bls: BlSummary[] }) {
  const t = useT();
  const [opened, setOpened] = useState<string | null>(null);
  return (
    <Found title={t("ps.groupBls")} q={q} count={bls.length} isSearching={isSearching}>
      {bls.map((b) => (
        <BlRow
          key={b.delivery_ref}
          bl={b}
          open={opened === b.delivery_ref}
          onToggle={() => setOpened(opened === b.delivery_ref ? null : b.delivery_ref)}
          {...actions}
        />
      ))}
    </Found>
  );
}

/** « Voir ses BL » of one supplier: every BL bought from it, newest first, the same rows as « BL ». */
function SupplierBls({ supplier, ...actions }: StarActions & { supplier: string }) {
  const t = useT();
  const { supplierBls, isLoadingBls, blsError } = useSupplierBls(supplier);
  const [opened, setOpened] = useState<string | null>(null);
  if (isLoadingBls) return <SkeletonText lines={3} className="ml-8" />;
  if (blsError) return <p className="text-sm text-error">{t("ps.loadDetailErr")}</p>;
  if (supplierBls.length === 0) return <p className="ml-8 text-sm text-muted-foreground">{t("ps.noBl")}</p>;
  return (
    <ul
      aria-label={t("ps.groupBls")}
      className="ml-8 flex flex-col divide-y divide-border rounded-xl border border-border bg-card"
    >
      {supplierBls.map((b) => (
        <BlRow
          key={b.delivery_ref}
          bl={b}
          open={opened === b.delivery_ref}
          onToggle={() => setOpened(opened === b.delivery_ref ? null : b.delivery_ref)}
          {...actions}
        />
      ))}
    </ul>
  );
}

/** « BL par Fournisseur »: the suppliers found; each opens its BLs. */
export function SupplierBlResults({
  suppliers,
  q,
  isSearching,
  ...actions
}: Common & { suppliers: SupplierSummary[] }) {
  const t = useT();
  const [opened, setOpened] = useState<string | null>(null);
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
          expand={{
            open: opened === s.supplier,
            label: t("ps.seeBls"),
            onToggle: () => setOpened(opened === s.supplier ? null : s.supplier),
          }}
        >
          {opened === s.supplier && <SupplierBls supplier={s.supplier} {...actions} />}
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
  onReintegrate,
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
            <ExcludeStar
              excluded={s.already_excluded}
              disabled={isExcluding}
              onClick={() => {
                const target = { kind: "supplier" as const, supplier: s.supplier, name: s.supplier };
                if (s.already_excluded) onReintegrate(target);
                else onExclude(target);
              }}
            />
          }
        />
      ))}
    </Found>
  );
}
