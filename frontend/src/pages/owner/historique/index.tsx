/** /owner/historique — « Historique des modifications »: who changed what, and when (imports,
 *  product edits, observations), kept as proof: nothing can be deleted. Filters: text (product,
 *  file, observation), dates, type, person; Excel = every matching line. */
import { Download } from "lucide-react";

import { FilterBar, type ActiveFilter } from "@/_components/organisms/FilterBar";
import { HistoryTable } from "@/_components/organisms/HistoryTable";
import { Page } from "@/_components/templates/Page";
import type { HistoryKind } from "@/types";
import { useT } from "@/i18n/I18nProvider";
import { formatDate } from "@/utils/format";

import { useHistoryPage } from "./hooks";

const ACTIVE = "bg-primary text-primary-foreground shadow-sm";
const EVERYONE = "";

export default function HistoryPage() {
  const t = useT();
  const {
    filters,
    handleExport,
    isError,
    isLoading,
    people,
    reload,
    reset,
    rows,
    setDateRange,
    setKind,
    setPage,
    setPageSize,
    setPerson,
    setSearch,
    total,
  } = useHistoryPage();

  const kinds: { value: HistoryKind; label: string; activeBg: string }[] = [
    { value: "all", label: t("history.kindAll"), activeBg: ACTIVE },
    { value: "imports", label: t("history.kindImports"), activeBg: ACTIVE },
    { value: "product", label: t("history.kindProducts"), activeBg: ACTIVE },
    { value: "notes", label: t("history.kindNotes"), activeBg: ACTIVE },
  ];
  const activeFilters = [
    filters.search
      ? { key: "search", label: `${t("common.recherche")} ${filters.search}`, onClear: () => setSearch("") }
      : null,
    filters.person ? { key: "person", label: filters.person, onClear: () => setPerson(null) } : null,
    filters.date_from || filters.date_to
      ? {
          key: "dates",
          label: `${filters.date_from ? formatDate(filters.date_from) : "…"} → ${filters.date_to ? formatDate(filters.date_to) : "…"}`,
          onClear: () => setDateRange(null, null),
        }
      : null,
  ].filter(Boolean) as ActiveFilter[];

  return (
    <Page title={t("history.title")} subtitle={t("history.subtitle")}>
      <FilterBar
        search={{ value: filters.search, onChange: setSearch, placeholder: t("history.searchPh") }}
        dateRange={{ from: filters.date_from, to: filters.date_to, onChange: setDateRange }}
        segment={{ value: filters.kind, onChange: setKind, options: kinds }}
        singleSelect={{
          label: t("history.person"),
          options: [{ value: EVERYONE, label: t("history.everyone") }, ...people.map((p) => ({ value: p, label: p }))],
          value: filters.person ?? EVERYONE,
          onChange: (v) => setPerson(v === EVERYONE ? null : v),
        }}
        rightActions={[
          {
            label: t("common.export"),
            icon: <Download className="size-4" />,
            variant: "outline",
            onClick: handleExport,
          },
        ]}
        activeFilters={activeFilters}
        onResetAll={reset}
      />
      <HistoryTable
        rows={rows}
        isLoading={isLoading}
        isError={isError}
        onRetry={reload}
        withProduct
        pagination={{ page: filters.page, pageSize: filters.limit, total, onPage: setPage, onPageSize: setPageSize }}
      />
    </Page>
  );
}
