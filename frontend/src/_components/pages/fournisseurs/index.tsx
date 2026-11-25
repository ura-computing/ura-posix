/** « Fournisseurs » (admin, Support): the supplier list shared by every pharmacy (laboratoires, grossistes, sociétés),
 *  filled by « Importer depuis Sobrus ». Search by name or city, filter by kind, « Archivés »; a click opens its sheet. */
import { Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { DataTable, type ColumnDef } from "@/_components/organisms/DataTable";
import { FilterBar, type ActiveFilter } from "@/_components/organisms/FilterBar";
import { SobrusImportCard } from "@/_components/organisms/SobrusImportCard";
import { Page } from "@/_components/templates/Page";
import { useMe } from "@/hooks/useMe";
import { useT } from "@/i18n/I18nProvider";
import type { Supplier, SupplierKind } from "@/types/suppliers";

import { useFournisseursPage } from "./hooks";

const KINDS: SupplierKind[] = ["laboratoire", "grossiste", "societe"];

const dash = (v: string | null) => v || <span className="text-muted-foreground">—</span>;

export default function FournisseursPage() {
  const t = useT();
  const { me } = useMe();
  const navigate = useNavigate();
  const {
    filters,
    isError,
    isLoading,
    reload,
    reset,
    rows,
    setArchived,
    setKind,
    setPage,
    setPageSize,
    setSearch,
    setSort,
    total,
  } = useFournisseursPage();

  const COLUMNS: ColumnDef<Supplier>[] = [
    {
      key: "name",
      label: t("suppliers.colName"),
      render: (s) => (
        <span className="flex items-center gap-2 font-medium text-foreground">
          <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          {s.name}
        </span>
      ),
    },
    {
      key: "kind",
      label: t("suppliers.colKind"),
      width: 140,
      render: (s) => (s.kind ? t(`suppliers.kind.${s.kind}`) : dash(null)),
    },
    { key: "phone", label: t("suppliers.colPhone"), width: 160, sortable: false, render: (s) => dash(s.phone) },
    { key: "email", label: t("suppliers.colEmail"), width: 220, sortable: false, render: (s) => dash(s.email) },
    { key: "city", label: t("suppliers.colCity"), width: 140, render: (s) => dash(s.city) },
    { key: "address", label: t("suppliers.colAddress"), sortable: false, render: (s) => dash(s.address) },
  ];

  const activeFilters: ActiveFilter[] = [
    filters.search
      ? {
          key: "search",
          label: <>{t("suppliers.filterSearch", { value: filters.search })}</>,
          onClear: () => setSearch(""),
        }
      : null,
    filters.kind
      ? { key: "kind", label: <>{t(`suppliers.kind.${filters.kind}`)}</>, onClear: () => setKind(null) }
      : null,
  ].filter(Boolean) as ActiveFilter[];

  return (
    <Page title={t("suppliers.title")} subtitle={t("suppliers.subtitle")}>
      <SobrusImportCard kind="suppliers" />

      <FilterBar<"active" | "archived">
        segment={{
          value: filters.archived ? "archived" : "active",
          onChange: (v) => setArchived(v === "archived"),
          options: [
            { value: "active", label: t("suppliers.scopeActive") },
            { value: "archived", label: t("suppliers.scopeArchived") },
          ],
        }}
        search={{
          value: filters.search,
          onChange: setSearch,
          placeholder: t("suppliers.searchPlaceholder"),
          suggestions: null,
        }}
        singleSelect={{
          label: t("suppliers.colKind"),
          options: [
            { value: "", label: t("suppliers.allKinds") },
            ...KINDS.map((k) => ({ value: k, label: t(`suppliers.kind.${k}`) })),
          ],
          value: filters.kind ?? "",
          onChange: (v) => setKind(v === "" ? null : (v as SupplierKind)),
        }}
        activeFilters={activeFilters}
        onResetAll={reset}
      />

      <DataTable<Supplier>
        rows={rows}
        columns={COLUMNS}
        isLoading={isLoading}
        isError={isError}
        onRetry={reload}
        sortBy={filters.sort_by}
        sortOrder={filters.sort_order}
        onSort={setSort}
        pagination={{
          page: filters.page,
          pageSize: filters.limit,
          total,
          onPage: setPage,
          onPageSize: setPageSize,
          pageSizes: [25, 50, 100],
        }}
        emptyTitle={t("suppliers.emptyTitle")}
        emptyHint={t("suppliers.emptyHint")}
        rowKey={(s) => s.id}
        onRowClick={(s) => void navigate(`/${me?.role}/fournisseurs/${s.id}`)}
      />
    </Page>
  );
}
