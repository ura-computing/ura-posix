import { ArrowRightLeft, Banknote, CreditCard, Plus, Receipt } from "lucide-react";

import { formatMAD } from "@/utils/format";
import { PAYMENT_METHODS, type PaymentEntry, type PaymentMethod } from "@/types";


/**
 * 4-card grid showing the active month's payment-method totals. Click a card
 * to open the edit dialog. The dialog owns its own state; this grid is pure
 * presentational + dispatches the "open dialog for this method" callback.
 *
 * Each method has its own color theme so the cards are visually distinct at
 * a glance — matches the apcm-pharma palette.
 */

const METHOD_LABEL: Record<PaymentMethod, string> = {
  tpe:      "TPE",
  especes:  "Espèces",
  cheques:  "Chèques",
  virement: "Virement et autres",
};

const METHOD_ICON: Record<PaymentMethod, React.ReactNode> = {
  tpe:      <CreditCard className="size-5" />,
  especes:  <Banknote className="size-5" />,
  cheques:  <Receipt className="size-5" />,
  virement: <ArrowRightLeft className="size-5" />,
};

/** Tailwind-friendly tint per method. Light bg + dark icon, mirrors the old
 *  apcm-pharma color story (blue / green / purple / amber). */
const METHOD_TINT: Record<PaymentMethod, { bg: string; fg: string; border: string }> = {
  tpe:      { bg: "bg-blue-50",   fg: "text-blue-600",   border: "border-blue-200" },
  especes:  { bg: "bg-green-50",  fg: "text-green-600",  border: "border-green-200" },
  cheques:  { bg: "bg-purple-50", fg: "text-purple-600", border: "border-purple-200" },
  virement: { bg: "bg-amber-50",  fg: "text-amber-600",  border: "border-amber-200" },
};


export function PaymentMethodGrid({
  payments, onOpenMethod,
}: {
  payments:     PaymentEntry[];
  onOpenMethod: (method: PaymentMethod) => void;
}) {
  /** Map method → entry for O(1) lookup; missing keys render the empty (add) state. */
  const byMethod = new Map(payments.map((p) => [p.method, p] as const));

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {PAYMENT_METHODS.map((method) => (
        <Card
          key={method}
          method={method}
          entry={byMethod.get(method) ?? null}
          onClick={() => onOpenMethod(method)}
        />
      ))}
    </div>
  );
}


function Card({
  method, entry, onClick,
}: { method: PaymentMethod; entry: PaymentEntry | null; onClick: () => void }) {
  const tint  = METHOD_TINT[method];
  const total = entry ? entry.pharmacie_amount + entry.parapharmacie_amount : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex cursor-pointer flex-col gap-3 rounded-xl border ${tint.border} bg-card p-5 text-left shadow-sm transition-shadow hover:shadow-md`}
    >
      <div className="flex items-center justify-between">
        <div className={`flex size-9 items-center justify-center rounded-xl ${tint.bg} ${tint.fg}`}>
          {METHOD_ICON[method]}
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {METHOD_LABEL[method]}
        </span>
      </div>

      {entry ? (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-xl font-semibold tabular-nums text-foreground">
            {formatMAD(total)}
          </span>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Ph {formatMAD(entry.pharmacie_amount)}</span>
            <span>Para {formatMAD(entry.parapharmacie_amount)}</span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {entry.count} transaction{entry.count > 1 ? "s" : ""}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Plus className="size-4" />
          <span>Ajouter</span>
        </div>
      )}
    </button>
  );
}
