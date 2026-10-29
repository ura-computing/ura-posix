// src/pages/alertes/_components/AlertDetailDialog.tsx
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Dialog, DialogContent } from "@/_components/atoms/Dialog";
import { Badge } from "@/_components/atoms/Badge";
import { Button } from "@/_components/atoms/Button";
import { DialogBody, DialogFooter, DialogHeader } from "@/_components/molecules/DialogShell";
import { EmptyState } from "@/_components/molecules/EmptyState";
import { SortButton } from "@/_components/molecules/SortButton";
import type { AlertColumn } from "./alertColumns";
import { cn } from "@/utils/cn";
import { formatQty } from "@/utils/format";
import { downloadXlsx, exportFilename } from "@/utils/table";
import { translateFr, useT } from "@/i18n/I18nProvider";

export interface AlertDetailDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- one window for 4 row types
  products: any[];
  columns: AlertColumn[];
  defaultSortKey: string;
  dateFrom?: string;
  dateTo?: string;
}

/** Mounted only while open, once per alert (`title`): the sort starts from
 *  `defaultSortKey` on every open, no reset effect needed. */
export function AlertDetailDialog(props: AlertDetailDialogProps) {
  if (!props.open) return null;
  return <AlertDetailBody key={`${props.title}|${props.defaultSortKey}`} {...props} />;
}

function AlertDetailBody({
  open,
  onClose,
  title,
  subtitle,
  products,
  columns,
  defaultSortKey,
  dateFrom,
  dateTo,
}: AlertDetailDialogProps) {
  const t = useT();
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return products;
    const val = col.sortValue ?? col.raw;
    const dir = sortOrder === "asc" ? 1 : -1;
    return [...products].sort((a, b) => {
      const x = val(a),
        y = val(b);
      if (typeof x === "string" || typeof y === "string") return String(x).localeCompare(String(y), "fr") * dir;
      return ((x as number) - (y as number)) * dir;
    });
  }, [products, columns, sortKey, sortOrder]);

  const toggleSort = (key: string) => {
    if (key === sortKey) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const handleExport = () => {
    if (sorted.length === 0) return;
    const aoa = [columns.map((c) => translateFr(c.label)), ...sorted.map((r) => columns.map((c) => c.raw(r)))];
    downloadXlsx(aoa, exportFilename(`ALERTES ${title}`, "xlsx", dateFrom, dateTo));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[88vh] w-full max-w-[1400px] flex-col gap-0 p-0">
        <DialogHeader title={title} subtitle={subtitle} onClose={onClose}>
          <Badge className="mt-1 w-fit tabular-nums">
            {formatQty(products.length)} {t("common.wProduits")}
          </Badge>
        </DialogHeader>

        <DialogBody>
          {products.length === 0 ? (
            <EmptyState title={t("alertes.emptyCat")} />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-[13px]">
                  <thead>
                    <tr>
                      {columns.map((c) => {
                        return (
                          <th
                            key={c.key}
                            className={cn(
                              "sticky top-0 z-[1] select-none whitespace-nowrap border-b border-border bg-surface-subtle p-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground",
                              c.align === "right" ? "text-right" : "text-left",
                            )}
                          >
                            {/* A button (not onClick on <th>): sortable with the keyboard, like DataTable. */}
                            <SortButton
                              active={sortKey === c.key}
                              order={sortOrder}
                              alignRight={c.align === "right"}
                              onSort={() => toggleSort(c.key)}
                            >
                              {t(c.label)}
                            </SortButton>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row, i) => (
                      <tr key={i} className="hover:bg-surface-subtle">
                        {columns.map((c) => (
                          <td
                            key={c.key}
                            className={cn(
                              "border-b border-border/60 p-2.5 align-top",
                              c.align === "right"
                                ? "whitespace-nowrap text-right"
                                : "whitespace-normal break-words text-left",
                            )}
                          >
                            {c.cell(row)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={handleExport} disabled={sorted.length === 0}>
            <Download className="size-4" /> {t("common.export")}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
