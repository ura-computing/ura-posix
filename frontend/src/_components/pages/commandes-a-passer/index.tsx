/** « Commandes à passer » (admin, Support): the orders the pharmacies sent, « À passer » first. Filter by state and
 *  search by pharmacy or supplier (each card's timeline already says where it stands). Each order: « Bon de commande (Excel) » (the supplier's order form: French headers, from the frozen copy), then
 *  « Je l'ai passée » → « Elle est livrée »; « Annuler » asks why (big choices). The pharmacy's owners get a line in
 *  their bell at each step. */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleX, ClipboardCheck, Download, PackageCheck, Truck } from "lucide-react";
import { toast } from "sonner";

import { API, refresh } from "@/api/api";
import { api } from "@/api/client";
import { Button } from "@/_components/atoms/Button";
import { Dialog, DialogContent } from "@/_components/atoms/Dialog";
import { ChoiceCard } from "@/_components/molecules/ChoiceCard";
import { DialogBody, DialogFooter, DialogHeader } from "@/_components/molecules/DialogShell";
import { EmptyState } from "@/_components/molecules/EmptyState";
import { FormField, FormInput } from "@/_components/molecules/FormField";
import { LoadError } from "@/_components/molecules/LoadError";
import { SkeletonCard } from "@/_components/molecules/Skeletons";
import { FilterBar, type ActiveFilter } from "@/_components/organisms/FilterBar";
import { SentOrderCard } from "@/_components/organisms/SentOrderCard";
import { Page } from "@/_components/templates/Page";
import { useT } from "@/i18n/I18nProvider";
import type { SentOrder, SentState } from "@/types/orders";
import { formatDateTime, formatPctStr } from "@/utils/format";
import { downloadXlsx, exportFilename } from "@/utils/table";

const STATES: SentState[] = ["validated", "sent", "delivered", "cancelled"];
const WHY = ["orders.why_supplier", "orders.why_pharmacy", "orders.why_other"];

/** The supplier's order form: who orders, then one row per product. */
async function orderForm(o: SentOrder) {
  const header = ["PID", "Produit", "Quantité", "Prix unitaire (MAD)", "Remise", "Net (MAD)"];
  const rows = o.order.lines.map((l) => [
    l.pid,
    l.product,
    l.quantity,
    l.unit_price ?? "",
    l.discount_pct ? formatPctStr(l.discount_pct) : "",
    l.net_total,
  ]);
  await downloadXlsx(
    [
      ["Pharmacie", `${o.pharmacy.name}${o.pharmacy.code ? ` (${o.pharmacy.code})` : ""}`],
      ["Fournisseur", o.order.supplier?.name ?? ""],
      ["Date", formatDateTime(o.validated_at)],
      [],
      header,
      ...rows,
      [],
      ["", "Total net (MAD)", "", "", "", o.order.net_total],
    ],
    exportFilename(`BON DE COMMANDE ${o.order.supplier?.name ?? ""} ${o.pharmacy.code ?? ""}`, "xlsx"),
    "Bon de commande",
  );
}

function CancelDialog({
  order,
  onCancel,
  onClose,
}: {
  order: SentOrder;
  onCancel: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const t = useT();
  const [why, setWhy] = useState<string | null>(null);
  const [text, setText] = useState("");
  const other = why === "orders.why_other";
  const reason = other ? text.trim() : why ? t(why) : "";
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader
        icon={<CircleX className="size-4" />}
        title={t("orders.cancelTitle")}
        subtitle={`${order.pharmacy.name} · ${order.order.supplier?.name ?? ""}`}
        onClose={onClose}
      />
      <DialogBody>
        <div role="radiogroup" aria-label={t("orders.cancelTitle")} className="flex flex-col gap-2">
          {WHY.map((w) => (
            <ChoiceCard key={w} selected={why === w} onSelect={() => setWhy(w)} className="p-4">
              <span className="text-base font-semibold text-foreground">{t(w)}</span>
            </ChoiceCard>
          ))}
        </div>
        {other && (
          <FormField label={t("orders.whyOtherField")}>
            <FormInput value={text} onChange={setText} maxLength={300} autoFocus />
          </FormField>
        )}
        <p className="text-sm text-muted-foreground">{t("orders.cancelHint")}</p>
      </DialogBody>
      <DialogFooter>
        {!reason && <span className="mr-auto text-sm text-muted-foreground">{t("orders.chooseReason")}</span>}
        <Button variant="secondary" onClick={onClose}>
          {t("common.back")}
        </Button>
        <Button variant="danger" disabled={!reason} onClick={() => void onCancel(reason).then(onClose)}>
          {t("orders.cancel")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default function OrdersToPlacePage() {
  const t = useT();
  const qc = useQueryClient();
  const [state, setState] = useState<SentState | null>(null);
  const [search, setSearch] = useState("");
  const [cancelling, setCancelling] = useState<SentOrder | null>(null);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.orders.toPlace.key({ state, search }),
    queryFn: () =>
      api.get<SentOrder[]>(API.orders.toPlace.url, {
        params: { state: state ?? undefined, search: search || undefined },
      }),
  });
  const { mutateAsync: move, isPending } = useMutation({
    mutationFn: ({ id, state, reason }: { id: number; state: SentState; reason?: string }) =>
      api.post<SentOrder>(API.orders.move.url(id), { state, reason }),
    onSuccess: (_, { state }) => {
      toast.success(t(`orders.moved_${state}`));
      void refresh(qc, API.orders.move);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const orders = data ?? [];

  return (
    <Page title={t("orders.toPlaceTitle")} subtitle={t("orders.toPlaceSubtitle")}>
      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t("orders.searchToPlace"), suggestions: null }}
        singleSelect={{
          label: t("orders.stateFilter"),
          options: [
            { value: "", label: t("orders.allStates") },
            ...STATES.map((s) => ({ value: s, label: t(`orders.state_${s}`) })),
          ],
          value: state ?? "",
          onChange: (v) => setState(v === "" ? null : (v as SentState)),
        }}
        activeFilters={
          [
            search
              ? {
                  key: "search",
                  label: <>{t("orders.filterSearch", { value: search })}</>,
                  onClear: () => setSearch(""),
                }
              : null,
            state ? { key: "state", label: <>{t(`orders.state_${state}`)}</>, onClear: () => setState(null) } : null,
          ].filter(Boolean) as ActiveFilter[]
        }
        onResetAll={() => {
          setSearch("");
          setState(null);
        }}
      />
      {isLoading ? (
        <SkeletonCard lines={6} />
      ) : isError ? (
        <LoadError onRetry={() => void refetch()} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="size-6" />}
          title={t(state || search ? "orders.emptyFiltered" : "orders.emptyToPlace")}
        />
      ) : (
        orders.map((o) => (
          <SentOrderCard
            key={o.id}
            order={o}
            title={`${o.pharmacy.name} · ${o.order.supplier?.name ?? ""}`}
            actions={
              <>
                <Button variant="outline" onClick={() => void orderForm(o)}>
                  <Download className="size-4" />
                  {t("orders.orderForm")}
                </Button>
                {(o.state === "validated" || o.state === "sent") && (
                  <Button variant="danger-outline" onClick={() => setCancelling(o)}>
                    {t("orders.cancel")}
                  </Button>
                )}
                {o.state === "validated" && (
                  <Button isLoading={isPending} onClick={() => void move({ id: o.id, state: "sent" })}>
                    <Truck className="size-4" />
                    {t("orders.markSent")}
                  </Button>
                )}
                {o.state === "sent" && (
                  <Button isLoading={isPending} onClick={() => void move({ id: o.id, state: "delivered" })}>
                    <PackageCheck className="size-4" />
                    {t("orders.markDelivered")}
                  </Button>
                )}
              </>
            }
          />
        ))
      )}
      <Dialog open={cancelling !== null} onOpenChange={(o) => !o && setCancelling(null)}>
        {cancelling && (
          <CancelDialog
            order={cancelling}
            onCancel={(reason) => move({ id: cancelling.id, state: "cancelled", reason }).then(() => undefined)}
            onClose={() => setCancelling(null)}
          />
        )}
      </Dialog>
    </Page>
  );
}
