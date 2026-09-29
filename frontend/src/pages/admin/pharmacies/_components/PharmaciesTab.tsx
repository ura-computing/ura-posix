/** « Pharmacies » tab of /admin/pharmacies — the pharmacies list (was the
 *  whole page before the « Utilisateurs » tab). The TanStack hooks return
 *  list + mutations; this file owns dialog open/close + filter state. */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Plus, RefreshCw, UserPlus } from "lucide-react";

import { useT } from "@/i18n/I18nProvider";
import { AsyncButton } from "@/components/shared/AsyncButton";
import { matchesFields } from "@/utils/text";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { FilterBar } from "@/components/shared/filterBar";
import type { CreateUserIn, CreateUserOut, PharmacyListRow } from "@/types";

import { CreateUserDialog } from "@/components/shared/members/CreateUserDialog";
import { FeaturePills } from "@/components/shared/members/FeaturePills";

import { PharmacyFormDialog } from "./PharmacyFormDialog";
import {
  useAdminPharmaciesList,
  useCreatePharmacy,
  useCreateUser,
} from "../_hooks/useAdminPharmacies";


export function PharmaciesTab() {
  const t = useT();
  const nav = useNavigate();

  const [search, setSearch] = useState("");
  const [createOpen,     setCreateOpen]     = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);

  const list = useAdminPharmaciesList();
  const rows: PharmacyListRow[] = useMemo(() => list.data ?? [], [list.data]);
  const isLoading = list.isLoading;
  const isError   = list.isError;
  const refetch   = list.refetch;

  const createMut = useCreatePharmacy();
  // pharmacy_id = 0 acts as a sentinel — the dialog overrides via direct API
  // call (see handleCreateUser below). This hook stays alive purely for the
  // invalidation side-effects after a successful create.
  const createUserMut = useCreateUser(0);
  void createUserMut;

  const handleCreate = async (v: import("@/types").PharmacyIn) => {
    const detail = await createMut.mutateAsync(v);
    setCreateOpen(false);
    nav(`/admin/pharmacies/${detail.id}`);
  };

  const handleCreateUser = async (v: CreateUserIn): Promise<CreateUserOut> => {
    // Call the underlying API directly so we use the pharmacy_id the user
    // picked in the dialog (the hook's pharmacyId is frozen at mount time).
    const { createUser } = await import("@/api/adminPharmacies");
    const result = await createUser(v.pharmacy_id, v);
    void list.refetch();
    return result;
  };

  // Filter rows client-side. Cheap (admin has a small N of pharmacies).
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    return rows.filter((p) => matchesFields([p.name, p.code, p.city], search));
  }, [rows, search]);

  const columns: ColumnDef<PharmacyListRow>[] = [
    {
      key: "name",
      label: t("adminPharm.colName"),
      sortable: true,
      render: (p) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{p.name}</span>
          <span className="text-xs text-muted-foreground">
            {[p.city, p.code].filter(Boolean).join(" · ") || <>&nbsp;</>}
          </span>
        </div>
      ),
    },
    {
      key: "members",
      label: t("adminPharm.members"),
      sortable: false,
      render: (p) => <AvatarStack initials={p.member_initials} count={p.members_count} />,
    },
    {
      key: "features",
      label: t("adminPharm.colFeaturesEnabled"),
      sortable: false,
      render: (p) => <FeaturePills features={p.enabled_features} />,
    },
    {
      key: "actions",
      label: t("adminPharm.colActions"),
      align: "right",
      sortable: false,
      render: (p) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); nav(`/admin/pharmacies/${p.id}`); }}
          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-surface-subtle"
        >
          {t("adminPharm.open")}
          <ArrowRight className="size-3.5" />
        </button>
      ),
    },
  ];

  return (
    <>
      <FilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: t("adminPharm.searchPlaceholder"),
          suggestions: null,
          onPick: () => {},
        }}
        rightActions={[
          { label: t("adminPharm.newUser"),     variant: "outline", icon: <UserPlus className="size-4" />, onClick: () => setCreateUserOpen(true) },
          { label: t("adminPharm.newPharmacy"), variant: "primary", icon: <Plus className="size-4" />,     onClick: () => setCreateOpen(true) },
        ]}
      />

      {isError ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-error-border bg-error-subtle px-4 py-3 text-error-subtle-foreground">
          <span className="text-sm font-medium">{t("adminPharm.loadError")}</span>
          <AsyncButton variant="secondary" onClick={() => void refetch()}>
            <RefreshCw className="size-3.5" />
            {t("common.retry")}
          </AsyncButton>
        </div>
      ) : (
        <DataTable
          rows={filtered}
          columns={columns}
          isLoading={isLoading}
          rowKey={(r) => r.id}
          emptyTitle={t("adminPharm.emptyTitle")}
          emptyHint={t("adminPharm.emptyHint")}
        />
      )}

      <PharmacyFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (v) => { await handleCreate(v); setCreateOpen(false); }}
      />

      <CreateUserDialog
        open={createUserOpen}
        onClose={() => setCreateUserOpen(false)}
        pharmacies={rows.map((p) => ({ id: p.id, name: p.name, city: p.city }))}
        onSubmit={handleCreateUser}
      />
    </>
  );
}


function AvatarStack({ initials, count }: { initials: string[]; count: number }) {
  const shown = initials.slice(0, 3);
  const extra = count - shown.length;
  return (
    <div className="flex items-center gap-2">
      <div className="flex">
        {shown.map((ini, i) => (
          <span
            key={i}
            className="-ml-1.5 flex size-6 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-bold text-foreground first:ml-0"
          >
            {ini}
          </span>
        ))}
        {extra > 0 && (
          <span className="-ml-1.5 flex size-6 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-bold text-muted-foreground">
            +{extra}
          </span>
        )}
      </div>
      <span className="font-mono text-xs tabular-nums text-muted-foreground">{count}</span>
    </div>
  );
}
