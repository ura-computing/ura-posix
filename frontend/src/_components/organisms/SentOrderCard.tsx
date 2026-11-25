/** An order sent to the admin, the same card on both sides (« Commandes du jour » → « Envoyées » for the pharmacy,
 *  « Commandes à passer » for the admin): left, its products (frozen copy: quantity, price, discount, net) and totals;
 *  right, its timeline (`Stepper` vertical): Préparée → Envoyée à l'administrateur → Passée chez le fournisseur →
 *  Livrée, each reached step with when and who; « Annulée » in red with its reason. `actions`: the admin's buttons. */
import type { ReactNode } from "react";

import { Badge, type BadgeTone } from "@/_components/atoms/Badge";
import { SectionCard } from "@/_components/molecules/SectionCard";
import { Stepper } from "@/_components/molecules/Stepper";
import { useT } from "@/i18n/I18nProvider";
import type { SentOrder, SentState } from "@/types/orders";
import { formatDateTime, formatMADStr, formatPctStr, formatQty } from "@/utils/format";

const SENT_TONE: Record<SentState, BadgeTone> = {
  validated: "warning",
  sent: "info",
  delivered: "success",
  cancelled: "neutral",
};

const PATH = ["draft", "validated", "sent", "delivered"] as const;

export function SentOrderCard({ order: o, title, actions }: { order: SentOrder; title: string; actions?: ReactNode }) {
  const t = useT();
  const when = (at: string | null, who?: string | null) =>
    at ? [formatDateTime(at), who].filter(Boolean).join(" · ") : null;
  const notes: Record<(typeof PATH)[number], string | null> = {
    draft: when(o.order.created_at),
    validated: when(o.validated_at, o.validated_by_name),
    sent: when(o.sent_at, o.handled_by_name),
    delivered: when(o.delivered_at, o.handled_by_name),
  };
  // Cancelled: the steps it went through, then « Annulée » in red.
  const reached = o.state === "cancelled" ? PATH.filter((s) => notes[s]) : PATH;
  const steps = o.state === "cancelled" ? [...reached, "cancelled" as const] : [...PATH];
  const current =
    o.state === "delivered" ? steps.length : o.state === "cancelled" ? reached.length : PATH.indexOf(o.state);
  const stepNotes = steps.map((s) =>
    s === "cancelled" ? [o.cancel_reason, o.handled_by_name].filter(Boolean).join(" · ") : notes[s],
  );

  return (
    <SectionCard
      title={title}
      hint={t("orders.nLines", { n: o.order.lines.length })}
      actions={
        <span className="flex flex-wrap items-center gap-2">
          <Badge size="md" tone={SENT_TONE[o.state]}>
            {t(`orders.state_${o.state}`)}
          </Badge>
          {actions}
        </span>
      }
    >
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_280px]">
        <div className="flex min-w-0 flex-col">
          <ul className="flex flex-col divide-y divide-border">
            {o.order.lines.map((l) => (
              <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2 text-sm">
                <span className="min-w-0 flex-1 basis-56 font-medium text-foreground">{l.product}</span>
                <span className="font-mono">{formatQty(l.quantity)} ×</span>
                <span className="w-40 text-right text-xs text-muted-foreground">
                  {l.unit_price != null && formatMADStr(l.unit_price)}
                  {l.discount_pct > 0 && <> − {formatPctStr(l.discount_pct)}</>}
                </span>
                <span className="w-28 text-right font-mono font-semibold">{formatMADStr(l.net_total)}</span>
              </li>
            ))}
          </ul>
          <p className="flex flex-wrap justify-end gap-x-4 border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">
              {t("orders.gross", { amount: formatMADStr(o.order.gross_total) })}
            </span>
            <span className="font-semibold text-foreground">
              {t("orders.net", { amount: formatMADStr(o.order.net_total) })}
            </span>
          </p>
        </div>
        <Stepper
          vertical
          steps={steps.map((s) => t(`orders.step_${s}`))}
          current={current}
          tone={o.state === "cancelled" ? "error" : "success"}
          notes={stepNotes}
        />
      </div>
    </SectionCard>
  );
}
