/** « Promis » (owner, employee with « Promis »): every product promised to a customer, newest first (a click opens its sheet);
 *  « Nouveau promis » opens the step-by-step form. */
import { Download, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/_components/atoms/Badge";
import { ButtonLink } from "@/_components/atoms/Button";
import { DataTable, type ColumnDef } from "@/_components/organisms/DataTable";
import { FilterBar, type ActiveFilter } from "@/_components/organisms/FilterBar";
import { Page } from "@/_components/templates/Page";
import { useMe } from "@/hooks/useMe";
import { useT } from "@/i18n/I18nProvider";
import type { Promis, PromisState } from "@/types/promis";
import { formatDateTime, formatQty } from "@/utils/format";

import { STATE_TONE, STATES } from "./constants";
import { usePromisPage } from "./hooks";

export default function PromisPage() {
  const t = useT();
  const { me } = useMe();
  const navigate = useNavigate();
  const {
    filters,
    handleExport,
    isError,
    isLoading,
    reload,
    reset,
    rows,
    setPage,
    setPageSize,
    setSearch,
    setState,
    total,
  } = usePromisPage();

  const COLUMNS: ColumnDef<Promis>[] = [
    {
      key: "number",
      label: t("promis.number"),
      width: 70,
      sortable: false,
      render: (p) => <span className="font-mono font-semibold">{p.number}</span>,
    },
    {
      key: "created_at",
      label: t("col.date"),
      width: 150,
      sortable: false,
      render: (p) => formatDateTime(p.created_at),
    },
    {
      key: "customer",
      label: t("promis.customer"),
      width: 200,
      sortable: false,
      render: (p) => (
        <span className="flex flex-col">
          <span className="font-medium text-foreground">{p.customer_name}</span>
          {p.customer_phone && <span className="text-xs text-muted-foreground">{p.customer_phone}</span>}
        </span>
      ),
    },
    {
      key: "products",
      label: t("promis.products"),
      sortable: false,
      render: (p) => (
        <span className="flex flex-col">
          {p.lines.map((l, i) => (
            <span key={i}>
              {formatQty(l.quantity)} × {l.name}
            </span>
          ))}
          {p.note && <span className="text-xs text-muted-foreground">{p.note}</span>}
        </span>
      ),
    },
    {
      key: "state",
      label: t("promis.state"),
      width: 160,
      sortable: false,
      render: (p) => <Badge tone={STATE_TONE[p.state]}>{t(`promis.state_${p.state}`)}</Badge>,
    },
    { key: "by", label: t("promis.by"), width: 150, sortable: false, render: (p) => p.created_by_name },
  ];

  const activeFilters = [
    filters.search
      ? {
          key: "search",
          label: <>{t("promis.filterSearch", { value: filters.search })}</>,
          onClear: () => setSearch(""),
        }
      : null,
    filters.state
      ? { key: "state", label: <>{t(`promis.state_${filters.state}`)}</>, onClear: () => setState(null) }
      : null,
  ].filter(Boolean) as ActiveFilter[];

  return (
    <Page
      title={t("promis.title")}
      subtitle={t("promis.subtitle")}
      actions={
        <ButtonLink size="lg" to={`/${me?.role}/promis/nouveau`}>
          <Plus className="size-5" />
          {t("promis.new")}
        </ButtonLink>
      }
    >
      <FilterBar
        search={{
          value: filters.search,
          onChange: setSearch,
          placeholder: t("promis.searchPlaceholder"),
          suggestions: null,
        }}
        singleSelect={{
          label: t("promis.state"),
          options: [
            { value: "", label: t("promis.allStates") },
            ...STATES.map((s) => ({ value: s, label: t(`promis.state_${s}`) })),
          ],
          value: filters.state ?? "",
          onChange: (v) => setState(v === "" ? null : (v as PromisState)),
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

      <DataTable<Promis>
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
        emptyTitle={t("promis.emptyTitle")}
        emptyHint={t("promis.emptyHint")}
        rowKey={(p) => p.id}
        onRowClick={(p) => void navigate(`/${me?.role}/promis/${p.id}`)}
      />
    </Page>
  );
}
