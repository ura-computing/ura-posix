/** A condition in plain words, in the page language: « Dès 100 unités : 20 % · dès 200 unités : 23 % »,
 *  « Commande minimum : 5 000,00 MAD », « Escompte 2,00 % si payé sous 60 jours ». */
import type { TFn } from "@/i18n/I18nProvider";
import type { Condition, ConditionInput } from "@/types/suppliers";
import { formatMADStr, formatNumStr, formatPctStr } from "@/utils/format";

type Rule = Pick<Condition | ConditionInput, "kind" | "basis" | "value" | "days" | "tiers" | "text">;

/** « 100 unités », « 4 000,00 MAD », « 5 références ». */
export function amount(t: TFn, basis: Rule["basis"], n: number): string {
  if (basis === "mad") return formatMADStr(n);
  return t(basis === "references" ? "conditions.nReferences" : "conditions.nUnits", { n: formatNumStr(n) });
}

export function conditionText(t: TFn, c: Rule): string {
  const value = c.value ?? 0;
  switch (c.kind) {
    case "minimum_order":
      return t("conditions.text_minimum_order", { amount: amount(t, c.basis, value) });
    case "qty_tiers":
    case "amount_tiers":
      return (c.tiers ?? [])
        .map((tier) =>
          t("conditions.tier", {
            from: amount(t, c.kind === "qty_tiers" ? "units" : "mad", tier.from),
            pct: formatPctStr(tier.pct),
          }),
        )
        .join(" · ");
    case "product_discount":
      return t("conditions.text_product_discount", { pct: formatPctStr(value) });
    case "payment_discount":
      return t("conditions.text_payment_discount", { pct: formatPctStr(value), days: c.days ?? 0 });
    case "transport":
      return t("conditions.text_transport", { amount: formatMADStr(value) });
    case "packaging":
      return t("conditions.text_packaging", { n: formatNumStr(value) });
    case "pack":
    case "return_rule":
      return c.text ?? "";
  }
}
