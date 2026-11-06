/** « Gestion des imports » (admin), tab « Produits Sobrus »: each catalogue import from Sobrus, newest first: when,
 *  whose owner's Sobrus account, pages read, products added, how it ended (running: the step now). */
import { Badge, type BadgeTone } from "@/_components/atoms/Badge";
import { Card } from "@/_components/atoms/Card";
import { Spinner } from "@/_components/atoms/Spinner";
import { EmptyState } from "@/_components/molecules/EmptyState";
import { LoadError } from "@/_components/molecules/LoadError";
import { SkeletonRows } from "@/_components/molecules/Skeletons";
import { DataTable, type ColumnDef } from "@/_components/organisms/DataTable";
import type { AdminSobrusImport, SobrusRun } from "@/types";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { formatDateTime, formatNumStr } from "@/utils/format";
import { runResult } from "@/utils/sobrus";

import { useSobrusProductImports } from "../hooks";

type Row = AdminSobrusImport["runs"][number];

const STATUS: Record<SobrusRun["status"], { tone: BadgeTone; label: string }> = {
  queued: { tone: "info", label: "imports.statusInProgress" },
  running: { tone: "info", label: "imports.statusInProgress" },
  success: { tone: "success", label: "imports.statusSuccess" },
  error: { tone: "error", label: "imports.statusError" },
  cancelled: { tone: "neutral", label: "imports.statusCancelled" },
};

const columns = (t: TFn): ColumnDef<Row>[] => [
  {
    key: "date",
    label: t("col.date"),
    sortable: false,
    render: ({ run }) => formatDateTime(run.started_at ?? run.created_at),
  },
  {
    key: "account",
    label: t("catalogue.factAccount"),
    sortable: false,
    render: ({ pharmacy_name }) => pharmacy_name,
  },
  {
    key: "pages",
    label: t("catalogue.factPages"),
    align: "right",
    sortable: false,
    render: ({ run }) => formatNumStr(run.chunk_current),
  },
  {
    key: "added",
    label: t("catalogue.factAdded"),
    align: "right",
    sortable: false,
    render: ({ run }) => <span className="font-semibold">{formatNumStr(run.lines_added)}</span>,
  },
  {
    key: "status",
    label: t("imports.colStatus"),
    sortable: false,
    render: ({ run }) => {
      const active = run.status === "queued" || run.status === "running";
      return (
        <span className="flex items-center gap-3">
          <Badge tone={STATUS[run.status].tone}>
            {active && <Spinner size="sm" />}
            {t(STATUS[run.status].label)}
          </Badge>
          {!active && <span className="text-sm text-foreground">{runResult(t, run)}</span>}
        </span>
      );
    },
  },
];

export function SobrusProductsTab() {
  const t = useT();
  const { runs, isLoading, isError, reload } = useSobrusProductImports(true);
  if (isError) return <LoadError onRetry={reload} />;
  if (isLoading) return <SkeletonRows rows={4} columns={5} />;
  if (runs.length === 0) return <EmptyState title={t("imports.sobrusEmpty")} hint={t("imports.sobrusEmptyHint")} />;
  return (
    <Card padding="none">
      <DataTable<Row> rows={runs} columns={columns(t)} rowKey={({ run }) => run.id} />
    </Card>
  );
}
