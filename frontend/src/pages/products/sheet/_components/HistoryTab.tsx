/** « Historique »: who changed this product and when — its edits (before → after), its
 *  observations, the imports that brought its lines. Newest first, 20 a page; nothing is ever
 *  removed (proof). The owner's « Historique » page shows the whole pharmacy. */
import { HistoryTable } from "@/_components/organisms/HistoryTable";
import { useT } from "@/i18n/I18nProvider";

import { useProductHistory } from "../hooks";
import { SheetCard } from "./SheetCard";

export function HistoryTab({ id }: { id: number }) {
  const t = useT();
  const { rows, total, page, setPage, isLoading, isError, reload } = useProductHistory(id);
  return (
    <SheetCard title={t("history.title")} hint={t("history.tabHint")}>
      <HistoryTable
        rows={rows}
        isLoading={isLoading}
        isError={isError}
        onRetry={reload}
        pagination={{ page, pageSize: 20, total, onPage: setPage, onPageSize: () => {}, pageSizes: [20] }}
      />
    </SheetCard>
  );
}
