/** « Voir tout (N) » of a Statistiques card: its whole list in a window (the list scrolls, the
 *  title and « Fermer » stay). Mounted only while open. */
import { X } from "lucide-react";

import { AsyncButton } from "@/_components/AsyncButton";
import { DataTable, type ColumnDef } from "@/_components/DataTable";
import { Dialog, DialogContent } from "@/_components/dialog";
import { useT } from "@/i18n/I18nProvider";

export function SeeAllDialog<R>({
  open,
  title,
  rows,
  columns,
  onClose,
}: {
  open: boolean;
  title: string;
  rows: R[];
  columns: ColumnDef<R>[];
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] max-w-2xl flex-col">
        <h3 className="border-b border-border px-5 py-4 text-[17px] font-semibold text-foreground">{title}</h3>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <DataTable<R> rows={rows} columns={columns} rowKey={(_, i) => i} />
        </div>
        <div className="flex justify-end border-t border-border bg-surface-subtle px-5 py-3.5">
          <AsyncButton variant="secondary" onClick={onClose}>
            <X className="size-4" />
            {t("common.close")}
          </AsyncButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
