/** /admin/pharmacies — « Pharmacies et utilisateurs ». Two tabs:
 *    Pharmacies   — the pharmacies list (_components/PharmaciesTab)
 *    Utilisateurs — EVERY account, with or without a pharmacy (_components/UsersTab):
 *                   the only admin view where nobody is hidden.
 *  The tab lives in the URL (?tab=utilisateurs) so a reload keeps it. */
import { useSearchParams, useNavigate, Link } from "react-router-dom";

import { TabBar } from "@/_components/TabBar";
import { useT } from "@/i18n/I18nProvider";

import { useMemo, useState } from "react";
import { ArrowRight, Plus, RefreshCw, UserPlus, Building2 } from "lucide-react";
import { AsyncButton } from "@/_components/AsyncButton";
import { matchesFields } from "@/utils/text";
import { DataTable, type ColumnDef } from "@/_components/DataTable";
import { FilterBar } from "@/_components/filterBar";
import type {
  CreateUserIn,
  CreateUserOut,
  PharmacyListRow,
  AdminUserRow,
  MemberOut,
  MemberRole,
  MemberStatus,
} from "@/types";
import { CreateUserDialog, ResetPasswordDialog } from "@/_components/CreateUserDialog";
import { FeaturePills } from "@/_components/FeaturePills";
import { PharmacyFormDialog } from "./_components/PharmacyFormDialog";
import {
  useAdminPharmaciesList,
  useCreatePharmacy,
  useCreateUser,
  useAdminUsers,
  useAssignPharmacy,
  useDeleteUser,
  useResetUserPassword,
  useSetUserStatus,
} from "./hooks";
import { toast } from "sonner";
import { ConfirmDialog } from "@/_components/ConfirmDialog";
import { SingleSelectPopover } from "@/_components/SingleSelectPopover";
import { MemberKebab } from "@/_components/MemberKebab";
import { Dialog, DialogContent } from "@/_components/dialog";
import { cn } from "@/utils/cn";

/** « Pharmacies » tab of /admin/pharmacies — the pharmacies list (was the
 *  whole page before the « Utilisateurs » tab). The TanStack hooks return
 *  list + mutations; this file owns dialog open/close + filter state. */

function PharmaciesTab() {
  const t = useT();
  const nav = useNavigate();

  const [search, setSearch] = useState("");
  const [createOpen,     setCreateOpen]     = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);

  const {
    pharmacies,
    isLoading,
    isError,
    reload,
  } = useAdminPharmaciesList();
  const rows: PharmacyListRow[] = useMemo(() => pharmacies ?? [], [pharmacies]);

  const { createPharmacy } = useCreatePharmacy();
  const { createUser } = useCreateUser();

  const handleCreate = async (v: import("@/types").PharmacyIn) => {
    const detail = await createPharmacy(v);
    setCreateOpen(false);
    nav(`/admin/pharmacies/${detail.id}`);
  };

  const handleCreateUser = (v: CreateUserIn): Promise<CreateUserOut> => createUser(v);

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
          <AsyncButton variant="secondary" onClick={reload}>
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

/** « Utilisateurs » tab of /admin/pharmacies — EVERY account (admin, owner,
 *  employee, developer), with or without a pharmacy, archived pharmacies
 *  included. The pharmacy pages only list the owner/employee members of active
 *  pharmacies, so an account without one used to be invisible to the admin.
 *
 *  Owner / employee rows get the shared member actions (MemberKebab) plus
 *  « Assigner une pharmacie » when they have none or an archived one. */

type Scope = "all" | "with" | "without";

const PILL = "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold";
const KNOWN_ROLES = ["admin", "owner", "employee", "developer"];
const SCOPE_ACTIVE = "bg-primary text-primary-foreground shadow-sm";

const isMember = (u: AdminUserRow) => u.role === "owner" || u.role === "employee";
const hasActivePharmacy = (u: AdminUserRow) => !!u.pharmacy && !u.pharmacy.archived_at;
const toMember = (u: AdminUserRow): MemberOut => ({
  id: u.id, full_name: u.full_name, email: u.email, granted_permissions: u.granted_permissions,
  role: u.role as MemberRole, status: u.status as MemberStatus,
});

function UsersTab() {
  const t = useT();
  const {
    users,
    isLoading: usersLoading,
    isError: usersError,
    reload: reloadUsers,
  } = useAdminUsers();
  const { pharmacies } = useAdminPharmaciesList();   // active ones only → assign targets

  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [resetTarget,  setResetTarget]  = useState<MemberOut | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AdminUserRow | null>(null);
  const [assignTarget, setAssignTarget] = useState<AdminUserRow | null>(null);

  // Pharmacy id 0: these hooks also refresh the whole pharmacies cache + this list.
  const { setUserStatus } = useSetUserStatus();
  const { resetUserPassword } = useResetUserPassword();
  const { deleteUser } = useDeleteUser();

  const rows = useMemo(() => users ?? [], [users]);
  const orphans  = rows.filter((u) => isMember(u) && !hasActivePharmacy(u)).length;
  const inactive = rows.filter((u) => u.status !== "active").length;

  // « Sans pharmacie » = no ACTIVE pharmacy (none, or an archived one).
  const filtered = useMemo(() => rows.filter((u) => {
    if (scope === "with" && !hasActivePharmacy(u)) return false;
    if (scope === "without" && hasActivePharmacy(u)) return false;
    return !search.trim() || matchesFields([u.full_name, u.email, u.phone, u.pharmacy?.name, u.pharmacy?.code], search);
  }), [rows, scope, search]);

  const roleLabel = (role: string) => (KNOWN_ROLES.includes(role) ? t(`roles.${role}`) : role);
  const statusLabel = (status: string) =>
    status === "active" ? t("adminFeat.statusActive") : status === "inactive" ? t("adminFeat.statusInactive") : status;

  const columns: ColumnDef<AdminUserRow>[] = [
    {
      key: "user", label: t("adminUsers.colUser"), sortable: false,
      render: (u) => (
        <div className="flex flex-col">
          <span className="text-[13px] font-semibold text-foreground">{u.full_name ?? "—"}</span>
          <span className="text-xs text-muted-foreground">{u.email}</span>
          {u.phone && <span className="font-mono text-[11px] text-muted-foreground">{u.phone}</span>}
        </div>
      ),
    },
    {
      key: "role", label: t("adminUsers.colRole"), sortable: false,
      render: (u) => <span className={cn(PILL, "bg-muted text-muted-foreground")}>{roleLabel(u.role)}</span>,
    },
    {
      key: "status", label: t("adminUsers.colStatus"), sortable: false,
      render: (u) => (
        <span className={cn(PILL, u.status === "active" ? "bg-success-subtle text-success" : "bg-muted text-muted-foreground")}>
          {statusLabel(u.status)}
        </span>
      ),
    },
    {
      key: "pharmacy", label: t("adminUsers.colPharmacy"), sortable: false,
      render: (u) => u.pharmacy ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Link to={`/admin/pharmacies/${u.pharmacy.id}`} className="text-sm font-medium text-primary hover:underline">
            {[u.pharmacy.code, u.pharmacy.name].filter(Boolean).join(" · ")}
          </Link>
          {u.pharmacy.archived_at && <span className={cn(PILL, "bg-warning-subtle text-warning")}>{t("adminUsers.archived")}</span>}
        </div>
      ) : (
        <span className={cn(PILL, isMember(u) ? "bg-warning-subtle text-warning" : "bg-muted text-muted-foreground")}>
          {t("adminUsers.noPharmacy")}
        </span>
      ),
    },
    {
      key: "last_login_at", label: t("adminUsers.colLastLogin"), sortable: false,
      render: (u) => (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {u.last_login_at
            ? new Date(u.last_login_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
            : t("adminUsers.never")}
        </span>
      ),
    },
    {
      key: "perms", label: t("adminUsers.colPerms"), sortable: false,
      render: (u) => isMember(u) ? <FeaturePills features={u.granted_permissions} maxShown={3} /> : <span className="text-muted-foreground">—</span>,
    },
    {
      key: "actions", label: t("adminUsers.colActions"), align: "right", sortable: false,
      render: (u) => !isMember(u) ? <span className="text-muted-foreground">—</span> : (
        <div className="flex items-center justify-end gap-1.5">
          {!hasActivePharmacy(u) && (
            <button
              type="button"
              onClick={() => setAssignTarget(u)}
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-border px-3 text-xs font-semibold text-foreground hover:bg-surface-subtle"
            >
              <Building2 className="size-3.5" />
              {t("adminUsers.assign")}
            </button>
          )}
          <MemberKebab
            member={toMember(u)}
            onResetPassword={() => setResetTarget(toMember(u))}
            onToggleStatus={() => void setUserStatus({ userId: u.id, status: u.status === "active" ? "inactive" : "active" })}
            onRemove={() => setRemoveTarget(u)}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <FilterBar<Scope>
        search={{ value: search, onChange: setSearch, placeholder: t("adminUsers.searchPh"), suggestions: null }}
        segment={{
          value: scope,
          onChange: setScope,
          options: [
            { value: "all",     label: t("adminUsers.scopeAll"),     activeBg: SCOPE_ACTIVE },
            { value: "with",    label: t("adminUsers.scopeWith"),    activeBg: SCOPE_ACTIVE },
            { value: "without", label: t("adminUsers.scopeWithout"), activeBg: SCOPE_ACTIVE },
          ],
        }}
      />

      {!usersLoading && !usersError && (
        <p className="text-sm text-muted-foreground">
          {t("adminUsers.summary", { total: rows.length, orphans, inactive })}
        </p>
      )}

      {usersError ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-error-border bg-error-subtle px-4 py-3 text-error-subtle-foreground">
          <span className="text-sm font-medium">{t("adminUsers.loadError")}</span>
          <AsyncButton variant="secondary" onClick={reloadUsers}>
            <RefreshCw className="size-3.5" />
            {t("common.retry")}
          </AsyncButton>
        </div>
      ) : (
        <DataTable
          rows={filtered}
          columns={columns}
          isLoading={usersLoading}
          rowKey={(u) => u.id}
          emptyTitle={t("adminUsers.empty")}
        />
      )}

      <ResetPasswordDialog
        member={resetTarget}
        onClose={() => setResetTarget(null)}
        onSubmit={async (password) => {
          // Guarded, not `resetTarget!.id`: the React Compiler reads `.id` at render to track deps.
          if (resetTarget) await resetUserPassword({ userId: resetTarget.id, password });
        }}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        variant="destructive"
        title={t("members.removeTitle", { who: removeTarget?.full_name ?? removeTarget?.email ?? t("members.thisMember") })}
        description={t("members.removeDesc", { pharmacy: removeTarget?.pharmacy?.name ?? "—" })}
        onConfirm={async () => {
          if (removeTarget) await deleteUser(removeTarget.id);
          setRemoveTarget(null);
        }}
      />

      <AssignPharmacyDialog
        user={assignTarget}
        pharmacies={(pharmacies ?? []).map((p) => ({ value: String(p.id), label: [p.code, p.name].filter(Boolean).join(" · ") }))}
        onClose={() => setAssignTarget(null)}
      />
    </>
  );
}

/** Pick an active pharmacy for an account that has none (or an archived one). */
function AssignPharmacyDialog({
  user, pharmacies, onClose,
}: {
  user:       AdminUserRow | null;
  pharmacies: { value: string; label: string }[];
  onClose:    () => void;
}) {
  const t = useT();
  const {
    assignPharmacy,
    isAssigning,
  } = useAssignPharmacy();
  const [pharmacyId, setPharmacyId] = useState("");

  // Reset on (re)open — derive-from-prop pattern (no effect).
  const [prevUser, setPrevUser] = useState(user);
  if (user !== prevUser) {
    setPrevUser(user);
    setPharmacyId("");
  }

  const submit = async () => {
    if (!user || !pharmacyId) return;
    await assignPharmacy({ userId: user.id, pharmacyId: Number(pharmacyId) });
    toast.success(t("adminUsers.assigned"));
    onClose();
  };

  return (
    <Dialog open={user !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <div className="flex flex-col gap-4 p-5">
          <header className="flex flex-col gap-1">
            <h3 className="text-[17px] font-semibold text-foreground">
              {t("adminUsers.assignTitle", { name: user?.full_name ?? user?.email ?? "" })}
            </h3>
            <p className="text-xs text-muted-foreground">{t("adminUsers.assignDesc")}</p>
          </header>
          <SingleSelectPopover
            label={t("adminUsers.colPharmacy")}
            options={pharmacies}
            value={pharmacyId}
            onChange={setPharmacyId}
          />
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <AsyncButton variant="secondary" onClick={onClose} disabled={isAssigning}>
              {t("common.cancel")}
            </AsyncButton>
            <AsyncButton variant="primary" onClick={() => void submit()} isLoading={isAssigning} disabled={!pharmacyId}>
              {t("adminUsers.assignBtn")}
            </AsyncButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPharmaciesIndex() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "utilisateurs" ? "users" : "pharmacies";

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("adminUsers.pageTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("adminUsers.pageSubtitle")}</p>
      </header>

      <TabBar
        tabs={[
          { id: "pharmacies", label: t("adminUsers.tabPharmacies") },
          { id: "users",      label: t("adminUsers.tabUsers") },
        ]}
        activeId={tab}
        onChange={(id) => setParams(id === "users" ? { tab: "utilisateurs" } : {})}
      />

      {tab === "pharmacies" ? <PharmaciesTab /> : <UsersTab />}
    </div>
  );
}
