/** « Historique des modifications »: one line per change, newest first — when, who, the kind
 *  (Import / Fiche produit / Observation), on the owner's page the product (a link to its page),
 *  then what (a sentence). Used by the owner's page and a product's « Historique » tab. */
import { Link } from "react-router-dom";

import { DataTable, type ColumnDef, type DataTablePagination } from "@/_components/organisms/DataTable";
import { ROUTES, type AuditRow } from "@/types";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import { formatDateTime } from "@/utils/format";
import { historyKind, historyText } from "@/utils/history";

const KIND_TONE: Record<string, string> = {
  import: "bg-info-subtle text-info-subtle-foreground",
  note: "bg-warning-subtle text-warning-subtle-foreground",
  product: "bg-success-subtle text-success-subtle-foreground",
};
const toneOf = (row: AuditRow) =>
  row.action.startsWith("import_")
    ? KIND_TONE.import
    : row.action.startsWith("note_")
      ? KIND_TONE.note
      : KIND_TONE.product;

const columns = (t: TFn, withProduct: boolean): ColumnDef<AuditRow>[] => [
  {
    key: "created_at",
    label: t("history.colDate"),
    width: 150,
    sortable: false,
    render: (r) => <span className="whitespace-nowrap">{formatDateTime(r.created_at)}</span>,
  },
  {
    key: "user_name",
    label: t("history.colPerson"),
    width: 170,
    sortable: false,
    render: (r) => r.user_name || <span className="text-muted-foreground">—</span>,
  },
  {
    key: "kind",
    label: t("history.colType"),
    width: 190,
    sortable: false,
    render: (r) => (
      <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-semibold", toneOf(r))}>
        {historyKind(t, r)}
      </span>
    ),
  },
  ...(withProduct
    ? [
        {
          key: "product",
          label: t("history.colProduct"),
          width: 300,
          sortable: false,
          render: (r: AuditRow) =>
            r.medicament_id ? (
              <Link
                to={ROUTES.PRODUIT.replace(":id", String(r.medicament_id))}
                className="line-clamp-2 break-words text-primary hover:underline"
              >
                {r.product}
              </Link>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
      ]
    : []),
  {
    key: "detail",
    label: t("history.colDetail"),
    sortable: false,
    render: (r) => <span className="break-words">{historyText(t, r)}</span>,
  },
];

export function HistoryTable({
  rows,
  isLoading,
  isError,
  onRetry,
  pagination,
  withProduct = false,
}: {
  rows: AuditRow[];
  isLoading: boolean;
  /** Not loaded: « Réessayer » in place of « Aucune modification ». */
  isError?: boolean;
  onRetry?: () => void;
  pagination: DataTablePagination;
  /** The owner's page: a « Produit » column (a product's tab does not need it). */
  withProduct?: boolean;
}) {
  const t = useT();
  return (
    <DataTable<AuditRow>
      rows={rows}
      columns={columns(t, withProduct)}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      pagination={pagination}
      emptyTitle={t("history.empty")}
      rowKey={(r) => r.id}
    />
  );
}
