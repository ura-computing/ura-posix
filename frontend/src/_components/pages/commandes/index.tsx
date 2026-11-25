/** « Commandes du jour » (owner, employee with « Commander »): what to order today, one card per supplier, already
 *  filled by the calculation (free stock, promis, the supplier's confirmed conditions). The person checks the orange
 *  lines, changes a quantity if needed, then « Valider la commande ». Each card says what the supplier asks: minimum
 *  reached or not, the next discount tier (shown, never added), free transport. Groups at the top filter the lines.
 *  « Envoyer à l'administrateur »: the admin places it with the supplier. Tab « Envoyées » (?tab=envoyees): each sent
 *  order with its timeline (Envoyée → Passée → Livrée). */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { ClipboardList, RefreshCw } from "lucide-react";

import { Badge } from "@/_components/atoms/Badge";
import { Button } from "@/_components/atoms/Button";
import { ConfirmDialog } from "@/_components/molecules/ConfirmDialog";
import { EmptyState } from "@/_components/molecules/EmptyState";
import { LoadError } from "@/_components/molecules/LoadError";
import { SectionCard } from "@/_components/molecules/SectionCard";
import { PageSkeleton } from "@/_components/molecules/Skeletons";
import { TabBar } from "@/_components/molecules/TabBar";
import { ToggleChip } from "@/_components/molecules/ToggleChip";
import { SentOrderCard } from "@/_components/organisms/SentOrderCard";
import { API } from "@/api/api";
import { api } from "@/api/client";
import { Page } from "@/_components/templates/Page";
import { useT } from "@/i18n/I18nProvider";
import type { DailyOrder, OrderGroup, SentOrder } from "@/types/orders";
import { formatMADStr, formatNumStr, formatPctStr } from "@/utils/format";

import { OrderLineRow } from "./_components/OrderLineRow";
import { useDailyOrders } from "./hooks";

const GROUPS: OrderGroup[] = ["urgent", "promis", "restock", "check"];

export default function DailyOrdersPage() {
  const t = useT();
  const {
    orders,
    counts,
    isLoading,
    isError,
    reload,
    refresh,
    isRefreshing,
    setQuantity,
    removeLine,
    validateOrder,
    isValidating,
  } = useDailyOrders();
  const [group, setGroup] = useState<OrderGroup | null>(null);
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "envoyees" ? "sent" : "draft";
  const { data: sent, isLoading: isLoadingSent } = useQuery({
    queryKey: API.orders.sent.key,
    queryFn: () => api.get<SentOrder[]>(API.orders.sent.url),
    enabled: tab === "sent",
  });
  const [validating, setValidating] = useState<DailyOrder | null>(null);

  const amount = (basis: "units" | "mad" | "references", n: number) =>
    basis === "mad" ? formatMADStr(n) : t(`orders.n_${basis}`, { n: formatNumStr(n) });
  const shown = orders
    .map((o) => ({ ...o, lines: group ? o.lines.filter((l) => l.group === group) : o.lines }))
    .filter((o) => o.lines.length > 0);

  return (
    <Page
      title={t("orders.title")}
      subtitle={t("orders.subtitle")}
      actions={
        tab === "draft" && (
          <Button
            size="lg"
            variant="outline"
            onClick={refresh}
            isLoading={isRefreshing}
            loadingText={t("orders.refreshing")}
          >
            <RefreshCw className="size-4" />
            {t("orders.refresh")}
          </Button>
        )
      }
    >
      <TabBar<"draft" | "sent">
        tabs={[
          { id: "draft", label: t("orders.tab_draft") },
          { id: "sent", label: t("orders.tab_sentList") },
        ]}
        activeId={tab}
        onChange={(id) => setParams(id === "sent" ? { tab: "envoyees" } : {})}
      />
      {tab === "sent" ? (
        isLoadingSent ? (
          <PageSkeleton />
        ) : (sent ?? []).length === 0 ? (
          <EmptyState icon={<ClipboardList className="size-6" />} title={t("orders.empty_sentList")} />
        ) : (
          (sent ?? []).map((o) => <SentOrderCard key={o.id} order={o} title={o.order.supplier?.name ?? ""} />)
        )
      ) : isLoading ? (
        <PageSkeleton />
      ) : isError ? (
        <LoadError onRetry={reload} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-6" />}
          title={t("orders.emptyTitle")}
          hint={t("orders.emptyHint")}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("orders.groups")}>
            <ToggleChip pressed={group === null} onToggle={() => setGroup(null)}>
              {t("orders.all")}
            </ToggleChip>
            {GROUPS.filter((g) => counts[g]).map((g) => (
              <ToggleChip key={g} pressed={group === g} onToggle={() => setGroup(group === g ? null : g)}>
                {t(`orders.group_${g}`)} · {counts[g]}
              </ToggleChip>
            ))}
          </div>

          {shown.map((o) => (
            <SectionCard
              key={o.id}
              title={o.supplier?.name ?? t("orders.noSupplier")}
              hint={t("orders.nLines", { n: o.lines.length })}
              actions={
                <span className="flex flex-wrap items-center gap-3">
                  {!o.supplier && <span className="text-sm text-muted-foreground">{t("orders.needSupplier")}</span>}
                  <Button disabled={!o.supplier} onClick={() => setValidating(o)}>
                    {t("orders.validate")}
                  </Button>
                </span>
              }
            >
              <div className="flex flex-wrap gap-2">
                {o.minimums.map((m, i) => (
                  <Badge key={i} size="md" tone={m.reached ? "success" : "warning"}>
                    {t("orders.minimum", {
                      current: amount(m.basis, m.current),
                      required: amount(m.basis, m.required),
                    })}
                  </Badge>
                ))}
                {o.next_tiers.map((n, i) => (
                  <Badge key={i} size="md" tone="info">
                    {t("orders.nextTier", { more: amount(n.basis, n.more), pct: formatPctStr(n.pct) })}
                  </Badge>
                ))}
                {o.transport_missing > 0 && (
                  <Badge size="md">{t("orders.transport", { more: formatMADStr(o.transport_missing) })}</Badge>
                )}
                {o.unverified_rules > 0 && (
                  <Badge size="md" tone="warning">
                    {t("orders.unverified", { n: o.unverified_rules })}
                  </Badge>
                )}
              </div>
              <ul className="flex flex-col divide-y divide-border">
                {o.lines.map((line) => (
                  <OrderLineRow key={line.id} line={line} onQuantity={setQuantity} onRemove={removeLine} />
                ))}
              </ul>
              <p className="flex flex-wrap justify-end gap-x-4 border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">
                  {t("orders.gross", { amount: formatMADStr(o.gross_total) })}
                </span>
                <span className="font-semibold text-foreground">
                  {t("orders.net", { amount: formatMADStr(o.net_total) })}
                </span>
              </p>
            </SectionCard>
          ))}
        </>
      )}

      <ConfirmDialog
        open={validating !== null}
        onClose={() => setValidating(null)}
        title={t("orders.validateTitle", { supplier: validating?.supplier?.name ?? "" })}
        description={
          validating
            ? t("orders.validateDesc", { n: validating.lines.length, amount: formatMADStr(validating.net_total) })
            : ""
        }
        confirmLabel={t("orders.validate")}
        isLoading={isValidating}
        onConfirm={async () => {
          if (validating) await validateOrder(validating.id);
          setValidating(null);
        }}
      />
    </Page>
  );
}
