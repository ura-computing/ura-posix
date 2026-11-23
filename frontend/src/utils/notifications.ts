/** A bell line as a sentence, in the page language: `notificationText(t, line)` →
 *  « 12 produits à classer dans le catalogue », « Votre boutique « Pharmacie Demo Shop » : En cours ». */
import type { TFn } from "@/i18n/I18nProvider";
import type { NotificationOut } from "@/types";
import { REQUEST_STATE_LABEL, type RequestState } from "@/types/storeWebsite";
import { formatNumStr } from "@/utils/format";

export function notificationText(t: TFn, { kind, params }: NotificationOut): string {
  switch (kind) {
    case "catalogueToClassify":
      return t("notifications.catalogueToClassify", { n: formatNumStr(Number(params.n)) });
    case "sobrusDone":
      return t(params.mode === "products" ? "notifications.sobrusCatalogueDone" : "notifications.sobrusDone", {
        n: formatNumStr(Number(params.n)),
      });
    case "sobrusFailed":
      return t("notifications.sobrusFailed", { reason: t(`errors.${params.error}`) });
    case "storeStep":
      return t("notifications.storeStep", {
        store: params.store,
        state: t(REQUEST_STATE_LABEL[params.state as RequestState]),
      });
    default:
      return t(`notifications.${kind}`, params);
  }
}
