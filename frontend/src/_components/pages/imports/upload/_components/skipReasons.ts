import type { UploadStockResult } from "@/types/imports";
import { type TFn } from "@/i18n/I18nProvider";
import { formatNumStr } from "@/utils/format";
import type { UploadProgress } from "@/hooks/useUpload";

/** Why lines were not imported (Success card, list of files imported together). Stock: unknown
 *  PIDs; achats / ventes: one line per reason the backend counted. formatNumStr (plain string), not
 *  formatQty (JSX): these are strings. */
export function skipReasonsOf(t: TFn, progress: UploadProgress, stockResult: UploadStockResult | null): string[] {
  const reasons: string[] = stockResult
    ? stockResult.skipped_unknown.length > 0
      ? [t("uploadFile.skipUnknownPid", { n: formatNumStr(stockResult.skipped_unknown.length) })]
      : []
    : [
        ...(progress.skipped_duplicate
          ? [t("uploadFile.skipDuplicate", { n: formatNumStr(progress.skipped_duplicate) })]
          : []),
        ...(progress.skipped_no_pid ? [t("uploadFile.skipNoPid", { n: formatNumStr(progress.skipped_no_pid) })] : []),
        ...(progress.skipped_no_medicament
          ? [t("uploadFile.skipNoMed", { n: formatNumStr(progress.skipped_no_medicament) })]
          : []),
        ...(progress.skipped_bad_date
          ? [t("uploadFile.skipBadDate", { n: formatNumStr(progress.skipped_bad_date) })]
          : []),
      ];
  // Defensive fallback: total skipped > 0 but no per-reason data (shouldn't happen).
  if (reasons.length === 0 && progress.skipped > 0) {
    reasons.push(t("uploadFile.skipGeneric", { n: formatNumStr(progress.skipped) }));
  }
  return reasons;
}
