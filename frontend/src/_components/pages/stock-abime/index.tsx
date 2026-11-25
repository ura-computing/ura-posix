/** « Stock abîmé » (owner, employee with « Stock abîmé »): every declaration of damaged boxes (declared from the product
 *  sheet, reason and note optional), newest first. Boxes stay off PharmaGest's free stock until « Remis en vente ». Each row moves on with
 *  « ⋮ » → « Que s'est-il passé ? » (a window of plain choices): rendues au fournisseur, jetées, or « Erreur : les boîtes sont
 *  bonnes » (back in the free stock). */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, MessageCircleQuestion } from "lucide-react";

import { Badge } from "@/_components/atoms/Badge";
import { KebabItem, KebabMenu } from "@/_components/molecules/KebabMenu";
import { DataTable, type ColumnDef } from "@/_components/organisms/DataTable";
import { FilterBar, type ActiveFilter } from "@/_components/organisms/FilterBar";
import { Page } from "@/_components/templates/Page";
import { useMe } from "@/hooks/useMe";
import { useT } from "@/i18n/I18nProvider";
import type { Damage, DamageStatus } from "@/types/damaged";
import { formatDateTime, formatNumStr, formatQty } from "@/utils/format";

import { DamageStateDialog } from "./_components/DamageStateDialog";
import { NEXT, STATUS_LABEL, useStockAbimePage } from "./hooks";

const STATUSES: DamageStatus[] = ["pending", "returned", "destroyed", "back_on_sale"];
const STATUS_TONE: Record<DamageStatus, "warning" | "neutral" | "success"> = {
  pending: "warning",
  returned: "neutral",
  destroyed: "neutral",
  back_on_sale: "success",
};
export default function StockAbimePage() {
  const t = useT();
  const { me } = useMe();
  const role = me?.role;
  const {
    boxesOff,
    filters,
    handleExport,
    isError,
    isLoading,
    isMoving,
    moveDamage,
    reload,
    reset,
    rows,
    setPage,
    setPageSize,
    setSearch,
    setStatus,
    total,
  } = useStockAbimePage();
  const [open, setOpen] = useState<Damage | null>(null);

  const COLUMNS: ColumnDef<Damage>[] = [
    {
      key: "created_at",
      label: t("col.date"),
      width: 150,
      sortable: false,
      render: (d) => formatDateTime(d.created_at),
    },
    {
      key: "product",
      label: t("col.produit"),
      sortable: false,
      render: (d) => (
        <Link to={`/${role}/produits/${d.medicament_id}`} className="font-medium text-foreground hover:underline">
          {d.product}
        </Link>
      ),
    },
    {
      key: "quantity",
      label: t("damaged.quantity"),
      width: 90,
      align: "right",
      sortable: false,
      render: (d) => <span className="font-mono font-semibold">{formatQty(d.quantity)}</span>,
    },
    {
      key: "reason",
      label: t("damaged.reason"),
      sortable: false,
      render: (d) => (
        <span className="flex flex-col">
          <span>{d.reason ?? <span className="text-muted-foreground">—</span>}</span>
          {d.note && <span className="text-xs text-muted-foreground">{d.note}</span>}
        </span>
      ),
    },
    {
      key: "status",
      label: t("damaged.state"),
      width: 170,
      sortable: false,
      render: (d) => <Badge tone={STATUS_TONE[d.status]}>{t(STATUS_LABEL[d.status])}</Badge>,
    },
    { key: "by", label: t("damaged.by"), width: 150, sortable: false, render: (d) => d.created_by_name },
    {
      key: "actions",
      label: "",
      width: 60,
      align: "right",
      sortable: false,
      render: (d) =>
        NEXT[d.status].length > 0 && (
          <KebabMenu label={t("damaged.whatHappened")}>
            {(close) => (
              <KebabItem icon={<MessageCircleQuestion className="size-4" />} onSelect={() => setOpen(d)} close={close}>
                {t("damaged.whatHappened")}
              </KebabItem>
            )}
          </KebabMenu>
        ),
    },
  ];

  const activeFilters = [
    filters.search
      ? {
          key: "search",
          label: <>{t("damaged.filterSearch", { value: filters.search })}</>,
          onClear: () => setSearch(""),
        }
      : null,
    filters.status
      ? { key: "status", label: <>{t(STATUS_LABEL[filters.status])}</>, onClear: () => setStatus(null) }
      : null,
  ].filter(Boolean) as ActiveFilter[];

  return (
    <Page title={t("damaged.title")} subtitle={t("damaged.subtitle")}>
      <FilterBar
        search={{
          value: filters.search,
          onChange: setSearch,
          placeholder: t("damaged.searchPlaceholder"),
          suggestions: null,
        }}
        singleSelect={{
          label: t("damaged.state"),
          options: [
            { value: "", label: t("damaged.allStates") },
            ...STATUSES.map((s) => ({ value: s, label: t(STATUS_LABEL[s]) })),
          ],
          value: filters.status ?? "",
          onChange: (v) => setStatus(v === "" ? null : (v as DamageStatus)),
        }}
        rightActions={[
          {
            label: t("common.export"),
            icon: <Download className="size-4" />,
            variant: "outline",
            onClick: () => void handleExport(),
          },
        ]}
        activeFilters={activeFilters}
        onResetAll={reset}
      />

      <p className="text-sm font-medium text-foreground">{t("damaged.boxesOff", { n: formatNumStr(boxesOff) })}</p>

      <DataTable<Damage>
        rows={rows}
        columns={COLUMNS}
        isLoading={isLoading}
        isError={isError}
        onRetry={reload}
        pagination={{
          page: filters.page,
          pageSize: filters.limit,
          total,
          onPage: setPage,
          onPageSize: setPageSize,
          pageSizes: [25, 50, 100],
        }}
        emptyTitle={t("damaged.emptyTitle")}
        emptyHint={t("damaged.emptyHint")}
        rowKey={(d) => d.id}
      />
      <DamageStateDialog damage={open} onSave={moveDamage} isSaving={isMoving} onClose={() => setOpen(null)} />
    </Page>
  );
}
