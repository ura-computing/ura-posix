/** « Historique »: who changed this product and when — its edits (before → after), its
 *  observations, the imports that brought its lines. Newest first, 20 a page; nothing is ever
 *  removed (proof). The owner's « Historique » page shows the whole pharmacy. */
import { HistoryTable } from "@/_components/HistoryTable";
import { useT } from "@/i18n/I18nProvider";

import { useProductHistory } from "../hooks";

export function HistoryTab({ id }: { id: number }) {
  const t = useT();
  const { rows, total, page, setPage, isLoading } = useProductHistory(id);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t("history.tabHint")}</p>
      <HistoryTable
        rows={rows}
        isLoading={isLoading}
        pagination={{ page, pageSize: 20, total, onPage: setPage, onPageSize: () => {}, pageSizes: [20] }}
      />
    </div>
  );
}
