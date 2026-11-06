/** « Historique des modifications »: one line as a sentence, in the page language.
 *  `historyText(t, row)` → « PPV : 46,80 MAD → 50,00 MAD »,
 *  « Import Achats « Sobrus - Achats 2026… » : 1 234 lignes importées, 0 ignorées »; on a product's
 *  tab « Import Achats « … » : 247 lignes de ce produit ». */
import type { AuditRow } from "@/types";
import type { TFn } from "@/i18n/I18nProvider";
import { formatDate, formatMADStr, formatNumStr } from "@/utils/format";

/** The editable field's label, as on the product page. */
const FIELD_LABEL: Record<string, [string, Record<string, number>?]> = {
  product: ["col.produit"],
  laboratoire: ["col.laboratoire"],
  category: ["col.categorie"],
  tva: ["col.tva"],
  ppv: ["col.ppv"],
  pph: ["col.pph"],
  zone: ["products.location"],
  current_stock: ["products.stockCurrent"],
  stock_min: ["products.stockMin"],
  stock_max: ["products.stockMax"],
  expiry_date: ["products.expiryDate"],
  barcode1: ["products.barcodeN", { n: 1 }],
  barcode2: ["products.barcodeN", { n: 2 }],
  description: ["history.fieldDescription"],
};

function fieldValue(field: string, v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  if (field === "ppv" || field === "pph") return formatMADStr(Number(v));
  if (field === "current_stock" || field === "stock_min" || field === "stock_max") return formatNumStr(Number(v));
  if (field === "expiry_date") return formatDate(String(v));
  return String(v);
}

const IMPORT_TYPE: Record<string, string> = { achat: "nav.achats", vente: "nav.ventes", stock: "nav.stock" };

/** « Import » / « Fiche produit » / « Observation ». */
export function historyKind(t: TFn, row: AuditRow): string {
  if (row.action.startsWith("import_")) return t("history.kindImport");
  if (row.action.startsWith("note_")) return t("history.kindNote");
  if (row.action.startsWith("sobrus_")) return t("history.kindSobrus");
  return t("history.kindProduct");
}

export function historyText(t: TFn, row: AuditRow): string {
  const d = row.details;
  switch (row.action) {
    case "import_done":
    case "import_cancelled":
    case "import_failed":
    case "import_deleted":
      if (row.action === "import_done" && row.product_lines != null) {
        return t("history.import_product", {
          type: t(IMPORT_TYPE[String(d.type)] ?? "history.kindImport"),
          file: String(d.file ?? "—"),
          n: formatNumStr(row.product_lines),
        });
      }
      return t(`history.${row.action}`, {
        type: t(IMPORT_TYPE[String(d.type)] ?? "history.kindImport"),
        file: String(d.file ?? "—"),
        imported: formatNumStr(Number(d.imported ?? 0)),
        skipped: formatNumStr(Number(d.skipped ?? 0)),
      });
    case "product_edited":
    case "product_reverted": {
      const field = String(d.field);
      const [key, params] = FIELD_LABEL[field] ?? ["history.fieldOther"];
      return t(`history.${row.action}`, {
        field: t(key, params),
        before: fieldValue(field, d.before),
        after: fieldValue(field, d.after),
      });
    }
    case "note_added":
    case "note_deleted":
      return t(`history.${row.action}`, { text: String(d.text ?? ""), author: String(d.author ?? "—") });
    case "sobrus_connected":
    case "sobrus_password_updated":
    case "sobrus_disconnected":
    case "sobrus_login_refused":
      return t(`history.${row.action}`, { email: String(d.email ?? "—") });
    case "sobrus_products_fetched":
      return t("history.sobrus_products_fetched", {
        added: formatNumStr(Number(d.added ?? 0)),
        filled: formatNumStr(Number(d.filled ?? 0)),
      });
  }
}
