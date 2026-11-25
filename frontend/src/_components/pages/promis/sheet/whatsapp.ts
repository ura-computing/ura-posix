/** « Envoyer sur WhatsApp »: the message for the customer, ready in WhatsApp (wa.me); a person reads it and sends it.
 *  Example: ready → « Bonjour Mme Alami, votre commande (2 × Doliprane 1000) est prête chez Pharmacie Demo. Vous
 *  pouvez la retirer jusqu'au 02 déc. 2026. » */
import type { TFn } from "@/i18n/I18nProvider";
import type { MessageKind, PromisSheet, PromisState } from "@/types/promis";
import { formatDate } from "@/utils/format";

/** No message due: the one that fits the state (none once it is over). */
const BY_STATE: Partial<Record<PromisState, MessageKind>> = {
  created: "created",
  to_order: "created",
  ordered: "created",
  received: "created",
  incident: "created",
  ready: "reminder",
  returned: "returned",
};

export function messageKind(sheet: PromisSheet): MessageKind | null {
  const { customer, message_due, state } = sheet;
  if (!customer.phone || !customer.whatsapp_ok) return null;
  return message_due ?? BY_STATE[state] ?? null;
}

export function whatsappUrl(t: TFn, sheet: PromisSheet, kind: MessageKind, pharmacy: string): string {
  const products = sheet.lines.map((l) => (l.quantity > 1 ? `${l.quantity} × ${l.name}` : l.name)).join(", ");
  const text = t(`promis.msg_${kind}`, {
    name: sheet.customer.name,
    products,
    pharmacy,
    date: formatDate(sheet.pickup_deadline),
  });
  return `https://wa.me/${(sheet.customer.phone ?? "").replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
