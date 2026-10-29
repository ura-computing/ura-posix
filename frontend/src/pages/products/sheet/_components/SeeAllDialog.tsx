/** « Voir tout (N) » of a Statistiques card: its whole list in a window (the list scrolls, the
 *  title and « Fermer » stay). Mounted only while open. */
import { X } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { DataTable, type ColumnDef } from "@/_components/organisms/DataTable";
import { Dialog, DialogContent } from "@/_components/atoms/Dialog";
import { DialogBody, DialogFooter, DialogHeader } from "@/_components/molecules/DialogShell";
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
        <DialogHeader title={title} onClose={onClose} />
        <DialogBody>
          <DataTable<R> rows={rows} columns={columns} rowKey={(_, i) => i} />
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            <X className="size-4" />
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
