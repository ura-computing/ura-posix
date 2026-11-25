/** A bell line as a sentence, in the page language: `notificationText(t, line)` →
 *  « 12 produits à classer dans le catalogue », « Votre boutique « Pharmacie Demo Shop » : En cours ». */
import type { TFn } from "@/i18n/I18nProvider";
import type { NotificationOut } from "@/types/notifications";
import { REQUEST_STATE_LABEL, type RequestState } from "@/types/storeWebsite";
import { formatNumStr } from "@/utils/format";

/** The admin's Sobrus runs have their own « done » text; every other run: « N lignes ajoutées ». */
const SOBRUS_DONE: Record<string, string> = {
  products: "notifications.sobrusCatalogueDone",
  suppliers: "notifications.sobrusSuppliersDone",
};

export function notificationText(t: TFn, { kind, params }: NotificationOut): string {
  switch (kind) {
    case "catalogueToClassify":
      return t("notifications.catalogueToClassify", { n: formatNumStr(Number(params.n)) });
    case "sobrusDone":
      return t(SOBRUS_DONE[String(params.mode)] ?? "notifications.sobrusDone", { n: formatNumStr(Number(params.n)) });
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
