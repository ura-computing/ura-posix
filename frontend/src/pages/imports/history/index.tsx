import { useMemo, useState } from "react";
import { Loader2, Trash2, TriangleAlert } from "lucide-react";

import { ConfirmDialog } from "@/_components/ConfirmDialog";
import { TabBar } from "@/_components/TabBar";
import type { TabItem } from "@/_components/TabBar";
import { formatQty } from "@/utils/format";
import type { DataImport, DocType, ImportBatchStatus } from "@/types";

import { useDeleteImport, useImports } from "./hooks";
import { useT, type TFn } from "@/i18n/I18nProvider";


const buildTabs = (t: TFn): TabItem[] => [{ id: "imports", label: t("imports.tab") }];

const TYPE_LABEL: Record<DocType, string> = { achat: "imports.typeAchat", vente: "imports.typeVente", stock: "imports.typeStock" };

const STATUS_TINT: Record<ImportBatchStatus, { bg: string; fg: string; label: string }> = {
  in_progress: { bg: "bg-info-subtle",    fg: "text-info",    label: "imports.statusInProgress" },
  success:     { bg: "bg-success-subtle", fg: "text-success", label: "imports.statusSuccess"    },
  cancelled:   { bg: "bg-warning-subtle", fg: "text-warning", label: "imports.statusCancelled"  },
  error:       { bg: "bg-error-subtle",   fg: "text-error",   label: "imports.statusError"      },
};


function relativeDate(iso: string, t: TFn): string {
  const diffSec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diffSec < 60)     return t("imports.now");
  if (diffSec < 3600)   return t("imports.minsAgo", { n: Math.floor(diffSec / 60) });
  if (diffSec < 86_400) return t("imports.hoursAgo", { n: Math.floor(diffSec / 3600) });
  return t("imports.daysAgo", { n: Math.floor(diffSec / 86_400) });
}


export default function ImportsPage() {
  const t = useT();
  const [active, setActive] = useState("imports");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("imports.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("imports.subtitle")}</p>
      </header>
      <TabBar tabs={buildTabs(t)} activeId={active} onChange={setActive} />
      <div>{active === "imports" && <ImportsTab />}</div>
    </div>
  );
}


function ImportsTab() {
  const t = useT();
  const { imports, isLoading } = useImports();
  const { deleteImport, isPending } = useDeleteImport();
  const [pendingRow, setPendingRow] = useState<DataImport | null>(null);

  const sorted = useMemo(
    () => [...imports].sort((a, b) => b.imported_at.localeCompare(a.imported_at)),
    [imports],
  );

  if (isLoading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> {t("imports.loading")}</div>;
  }
  if (sorted.length === 0) {
    return <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{t("imports.empty")}</div>;
  }

  const confirmCopy = pendingRow
    ? pendingRow.file_type === "stock"
      ? t("imports.confirmStockCopy", { name: pendingRow.filename ?? t("imports.noName") })
      : t("imports.confirmCopy", { name: pendingRow.filename ?? t("imports.noName"), rows: pendingRow.rows_inserted })
    : "";

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-subtle text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5">{t("imports.colDate")}</th>
              <th className="px-4 py-2.5">{t("imports.colType")}</th>
              <th className="px-4 py-2.5">{t("imports.colFile")}</th>
              <th className="px-4 py-2.5">{t("imports.colBy")}</th>
              <th className="px-4 py-2.5 text-right">{t("imports.colRows")}</th>
              <th className="px-4 py-2.5">{t("imports.colStatus")}</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const isDeleted = row.deleted_at !== null;
              const status = STATUS_TINT[row.status];
              return (
                <tr
                  key={row.id}
                  className={`border-b border-border last:border-0 ${isDeleted ? "bg-surface-subtle/40" : "hover:bg-surface-subtle/50"}`}
                >
                  <td className="px-4 py-3 font-mono text-xs tabular-nums text-muted-foreground">
                    {new Date(row.imported_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                      style={{
                        background: `var(--color-doc-${row.file_type}-bg)`,
                        color:      `var(--color-doc-${row.file_type})`,
                      }}
                    >
                      {t(TYPE_LABEL[row.file_type])}
                    </span>
                  </td>
                  <td
                    className={`max-w-[280px] truncate px-4 py-3 ${isDeleted ? "text-muted-foreground line-through" : "text-foreground"}`}
                    title={row.filename ?? ""}
                  >
                    {row.filename ?? <span className="italic text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {row.created_by_full_name || row.created_by_email ? (
                      <div className="flex flex-col leading-tight">
                        <span className="text-foreground">{row.created_by_full_name ?? row.created_by_email}</span>
                        {row.created_by_full_name && row.created_by_email && (
                          <span className="text-xs text-muted-foreground">{row.created_by_email}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs tabular-nums">
                    <span className={isDeleted ? "text-muted-foreground" : "text-foreground"}>{formatQty(row.rows_inserted)}</span>
                    {row.rows_skipped > 0 && (
                      <span className="ml-1 text-muted-foreground">· {formatQty(row.rows_skipped)} {t("imports.skipped")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isDeleted ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-warning-subtle px-2 py-0.5 text-xs font-medium text-warning">
                        <TriangleAlert className="size-3" />
                        {t("imports.deletedBy", { who: row.deleted_by_full_name ?? row.deleted_by_email ?? "—", when: relativeDate(row.deleted_at!, t) })}
                      </span>
                    ) : (
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${status.bg} ${status.fg}`}>
                        {t(status.label)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!isDeleted && (
                      <button
                        type="button"
                        onClick={() => setPendingRow(row)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-destructive/30 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/5"
                      >
                        <Trash2 className="size-3.5" />
                        {t("imports.deleteBtn")}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={pendingRow !== null}
        onClose={() => setPendingRow(null)}
        onConfirm={() => {
          if (!pendingRow) return;
          deleteImport(pendingRow.id, { onSuccess: () => setPendingRow(null) });
        }}
        title={pendingRow?.file_type === "stock" ? t("imports.confirmStockTitle") : t("imports.confirmTitle")}
        description={confirmCopy}
        variant="destructive"
        confirmLabel={pendingRow?.file_type === "stock" ? t("imports.markDeleted") : t("imports.deleteBtn")}
        loadingLabel={t("imports.deleting")}
        isLoading={isPending}
      />
    </>
  );
}
