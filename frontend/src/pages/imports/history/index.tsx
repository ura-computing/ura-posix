import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

import { Badge, type BadgeTone } from "@/_components/atoms/Badge";
import { Button } from "@/_components/atoms/Button";
import { Checkbox } from "@/_components/atoms/Checkbox";
import { ConfirmDialog } from "@/_components/molecules/ConfirmDialog";
import { TabBar } from "@/_components/molecules/TabBar";
import type { TabItem } from "@/_components/molecules/TabBar";
import { formatDateTime, formatNumStr, formatQty } from "@/utils/format";
import type { DataImport, ImportBatchStatus, ImportKind } from "@/types";

import { useMe } from "@/hooks/useMe";
import { isStaff } from "@/types";

import { SobrusProductsTab } from "./_components/SobrusProductsTab";
import { useDeleteImport, useDeleteImports, useImports } from "./hooks";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { Page } from "@/_components/templates/Page";
import { Card } from "@/_components/atoms/Card";
import { SkeletonRows } from "@/_components/molecules/Skeletons";
import { EmptyState } from "@/_components/molecules/EmptyState";
import { LoadError } from "@/_components/molecules/LoadError";

/** The admin also sees his catalogue imports from Sobrus (one owner's Sobrus account each). */
const buildTabs = (t: TFn, admin: boolean): TabItem[] => [
  { id: "imports", label: t("imports.tab") },
  ...(admin ? [{ id: "sobrus", label: t("imports.tabSobrus") }] : []),
];

const TYPE_LABEL: Record<ImportKind, string> = {
  achat: "imports.typeAchat",
  vente: "imports.typeVente",
  stock: "imports.typeStock",
  closing: "imports.typeClosing",
};

/** « Clôture de caisse » (the Sobrus robot): read again at every run, so never deleted. */
const readOnly = (row: DataImport) => row.file_type === "closing";

// Indigo (cancelled) / violet (deleted) = nothing to do; orange = act (import the file again).
const CANCELLED = "border-transparent bg-[color-mix(in_srgb,var(--chart-7)_14%,transparent)] text-[var(--chart-7)]";
const DELETED = "border-transparent bg-[color-mix(in_srgb,var(--chart-4)_14%,transparent)] text-[var(--chart-4)]";

const STATUS_TINT: Record<ImportBatchStatus, { tone: BadgeTone; className?: string; label: string }> = {
  in_progress: { tone: "info", label: "imports.statusInProgress" },
  success: { tone: "success", label: "imports.statusSuccess" },
  cancelled: { tone: "neutral", className: CANCELLED, label: "imports.statusCancelled" },
  error: { tone: "error", label: "imports.statusError" },
  interrupted: { tone: "warning", label: "imports.statusInterrupted" },
};

function relativeDate(iso: string, t: TFn): string {
  const diffSec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diffSec < 60) return t("imports.now");
  if (diffSec < 3600) return t("imports.minsAgo", { n: Math.floor(diffSec / 60) });
  if (diffSec < 86_400) return t("imports.hoursAgo", { n: Math.floor(diffSec / 3600) });
  return t("imports.daysAgo", { n: Math.floor(diffSec / 86_400) });
}

export default function ImportsPage() {
  const t = useT();
  const { me } = useMe();
  const admin = isStaff(me?.role);
  const [active, setActive] = useState("imports");

  return (
    <Page title={t("imports.title")} subtitle={t("imports.subtitle")}>
      <TabBar tabs={buildTabs(t, admin)} activeId={active} onChange={setActive} />
      <div>
        {active === "imports" && <ImportsTab />}
        {active === "sobrus" && admin && <SobrusProductsTab />}
      </div>
    </Page>
  );
}

function ImportsTab() {
  const t = useT();
  const { imports, isLoading, isError, reload } = useImports();
  const { deleteImport, isDeleting } = useDeleteImport();
  const { deleteImports, isDeletingMany } = useDeleteImports();
  const [pendingRow, setPendingRow] = useState<DataImport | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [confirmMany, setConfirmMany] = useState(false);

  const sorted = useMemo(() => [...imports].sort((a, b) => b.imported_at.localeCompare(a.imported_at)), [imports]);
  // Only imports not deleted yet (and not read-only) can be ticked; an id that left the list is simply ignored.
  const deletable = useMemo(() => sorted.filter((r) => r.deleted_at === null && !readOnly(r)), [sorted]);
  const selectedRows = useMemo(() => deletable.filter((r) => selected.has(r.id)), [deletable, selected]);
  const allSelected = deletable.length > 0 && selectedRows.length === deletable.length;

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(deletable.map((r) => r.id)));

  if (isLoading) {
    return (
      <Card padding="none">
        <SkeletonRows rows={6} />
      </Card>
    );
  }
  if (isError && sorted.length === 0) return <LoadError onRetry={reload} />;
  if (sorted.length === 0) {
    return <EmptyState title={t("imports.empty")} />;
  }

  const confirmCopy = pendingRow
    ? t("imports.confirmCopy", { name: pendingRow.filename ?? t("imports.noName"), rows: pendingRow.rows_inserted })
    : "";

  return (
    <>
      {/* Always there (users look for it), usable once a line is ticked. */}
      <div className="mb-3 flex flex-wrap items-center justify-end gap-3">
        {selectedRows.length === 0 && <span className="text-sm text-muted-foreground">{t("imports.selectHint")}</span>}
        <Button variant="danger" disabled={selectedRows.length === 0} onClick={() => setConfirmMany(true)}>
          <Trash2 className="size-4" />
          {t("imports.deleteSelection", { n: selectedRows.length })}
        </Button>
      </div>
      <Card as="div" padding="none">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-subtle text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="w-10 px-4 py-2.5">
                <Checkbox
                  aria-label={t("imports.selectAll")}
                  title={t("imports.selectAll")}
                  checked={allSelected}
                  mixed={selectedRows.length > 0 && !allSelected}
                  disabled={deletable.length === 0}
                  onChange={toggleAll}
                />
              </th>
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
                  <td className="px-4 py-3">
                    {!isDeleted && (
                      <Checkbox
                        aria-label={t("imports.selectRow", { name: row.filename ?? t("imports.noName") })}
                        title={readOnly(row) ? t("imports.closingReadOnly") : undefined}
                        checked={selected.has(row.id)}
                        disabled={readOnly(row)}
                        onChange={() => toggle(row.id)}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums text-muted-foreground">
                    {formatDateTime(row.imported_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium"
                      style={{
                        background: `var(--color-doc-${row.file_type}-bg)`,
                        color: `var(--color-doc-${row.file_type})`,
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
                    <span className={isDeleted ? "text-muted-foreground" : "text-foreground"}>
                      {formatQty(row.rows_inserted)}
                    </span>
                    {row.rows_skipped > 0 && (
                      <span className="ml-1 text-muted-foreground">
                        · {formatQty(row.rows_skipped)} {t("imports.skipped")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isDeleted ? (
                      <Badge className={DELETED}>
                        <Trash2 className="size-3" />
                        {t("imports.deletedBy", {
                          who: row.deleted_by_full_name ?? row.deleted_by_email ?? "—",
                          when: relativeDate(row.deleted_at!, t),
                        })}
                      </Badge>
                    ) : (
                      <Badge tone={status.tone} className={status.className}>
                        {t(status.label)}
                      </Badge>
                    )}
                    {!isDeleted && row.status === "interrupted" && (
                      <p className="mt-1 text-xs text-muted-foreground">{t("imports.interruptedHint")}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!isDeleted && (
                      <div className="flex flex-col items-end gap-1">
                        <Button
                          variant="danger-outline"
                          size="sm"
                          disabled={readOnly(row)}
                          onClick={() => setPendingRow(row)}
                        >
                          <Trash2 className="size-3.5" />
                          {t("imports.deleteBtn")}
                        </Button>
                        {readOnly(row) && (
                          <span className="whitespace-nowrap text-xs text-muted-foreground">
                            {t("imports.closingReadOnly")}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <ConfirmDialog
        open={pendingRow !== null}
        onClose={() => setPendingRow(null)}
        onConfirm={() => {
          if (!pendingRow) return;
          deleteImport(pendingRow.id, { onSuccess: () => setPendingRow(null) });
        }}
        title={t("imports.confirmTitle")}
        description={confirmCopy}
        variant="destructive"
        confirmLabel={t("imports.deleteBtn")}
        loadingLabel={t("imports.deleting")}
        isLoading={isDeleting}
      />

      <ConfirmDialog
        open={confirmMany}
        onClose={() => setConfirmMany(false)}
        onConfirm={() => {
          void deleteImports(selectedRows).then(() => {
            setSelected(new Set());
            setConfirmMany(false);
          });
        }}
        title={t("imports.confirmManyTitle", { n: selectedRows.length })}
        description={t("imports.confirmManyCopy")}
        bullets={selectedRows.map(
          (r) =>
            `${r.filename ?? t("imports.noName")} · ${t("imports.confirmManyRows", { rows: formatNumStr(r.rows_inserted) })}`,
        )}
        variant="destructive"
        confirmLabel={t("imports.deleteMany", { n: selectedRows.length })}
        loadingLabel={t("imports.deleting")}
        isLoading={isDeletingMany}
      />
    </>
  );
}
