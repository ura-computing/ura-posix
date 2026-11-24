/** /admin/pharmacies, /support/pharmacies — « Pharmacies et utilisateurs ». Three tabs:
 *    Pharmacies   — the pharmacies list (PharmaciesTab)
 *    Utilisateurs — EVERY account, with or without a pharmacy (UsersTab):
 *                   the only admin view where nobody is hidden.
 *    Demandes (N) — pending « Créer un compte » (_components/SignupRequestsTab).
 *    Support      — the admin's helpers, same rights as the admin (_components/SupportTab).
 *  The tab lives in the URL (?tab=utilisateurs / ?tab=demandes / ?tab=support) so a reload keeps it. */
import { useSearchParams, useNavigate, Link } from "react-router-dom";

import { TabBar } from "@/_components/molecules/TabBar";
import { useT } from "@/i18n/I18nProvider";

import { useMemo, useState } from "react";
import { ArrowRight, Plus, UserPlus, Building2 } from "lucide-react";
import { Button } from "@/_components/atoms/Button";
import { useAdminPharmaciesList } from "@/hooks/useSharedQueries";
import { formatDateTime } from "@/utils/format";
import { matchesFields } from "@/utils/text";
import { DataTable, type ColumnDef } from "@/_components/organisms/DataTable";
import { FilterBar } from "@/_components/organisms/FilterBar";
import type {
  CreateUserIn,
  CreateUserOut,
  PharmacyListRow,
  AdminUserRow,
  MemberOut,
  MemberRole,
  MemberStatus,
} from "@/types";
import { CreateUserDialog, ResetPasswordDialog } from "@/_components/organisms/CreateUserDialog";
import { FeaturePills } from "@/_components/molecules/FeaturePills";
import { PharmacyFormDialog } from "./_components/PharmacyFormDialog";
import { SignupRequestsTab } from "./_components/SignupRequestsTab";
import { SupportTab } from "./_components/SupportTab";
import {
  useCreatePharmacy,
  useCreateUser,
  useAdminUsers,
  useAssignPharmacy,
  useDeleteUser,
  useResetUserPassword,
  useResetUserPin,
  useSetUserStatus,
  useSignupRequests,
} from "./hooks";
import { toast } from "sonner";
import { ConfirmDialog } from "@/_components/molecules/ConfirmDialog";
import { SingleSelect } from "@/_components/molecules/SingleSelect";
import { MemberKebab } from "@/_components/organisms/MemberKebab";
import { Dialog, DialogContent } from "@/_components/atoms/Dialog";
import { DialogBody, DialogFooter, DialogHeader } from "@/_components/molecules/DialogShell";
import { Page } from "@/_components/templates/Page";
import { LoadError } from "@/_components/molecules/LoadError";
import { Badge } from "@/_components/atoms/Badge";

/** « Pharmacies » tab of /admin/pharmacies — the pharmacies list (was the
 *  whole page before the « Utilisateurs » tab). The TanStack hooks return
 *  list + mutations; this file owns dialog open/close + filter state. */

function PharmaciesTab() {
  const t = useT();
  const nav = useNavigate();

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);

  const { pharmacies, isLoading, isError, reload } = useAdminPharmaciesList();
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
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            nav(`/admin/pharmacies/${p.id}`);
          }}
        >
          {t("adminPharm.open")}
          <ArrowRight className="size-3.5" />
        </Button>
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
          {
            label: t("adminPharm.newUser"),
            variant: "outline",
            icon: <UserPlus className="size-4" />,
            onClick: () => setCreateUserOpen(true),
          },
          {
            label: t("adminPharm.newPharmacy"),
            variant: "primary",
            icon: <Plus className="size-4" />,
            onClick: () => setCreateOpen(true),
          },
        ]}
      />

      {isError ? (
        <LoadError message={t("adminPharm.loadError")} onRetry={reload} />
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
        onSubmit={async (v) => {
          await handleCreate(v);
          setCreateOpen(false);
        }}
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
 *  employee, Support), with or without a pharmacy, archived pharmacies
 *  included. The pharmacy pages only list the owner/employee members of active
 *  pharmacies, so an account without one used to be invisible to the admin.
 *
 *  Owner / employee rows get the shared member actions (MemberKebab) plus
 *  « Assigner une pharmacie » when they have none or an archived one. */

type Scope = "all" | "with" | "without";

const KNOWN_ROLES = ["admin", "support", "owner", "employee"];
const SCOPE_ACTIVE = "bg-primary text-primary-foreground shadow-sm";

const isMember = (u: AdminUserRow) => u.role === "owner" || u.role === "employee";
const hasActivePharmacy = (u: AdminUserRow) => !!u.pharmacy && !u.pharmacy.archived_at;
const toMember = (u: AdminUserRow): MemberOut => ({
  id: u.id,
  full_name: u.full_name,
  email: u.email,
  granted_permissions: u.granted_permissions,
  role: u.role as MemberRole,
  status: u.status as MemberStatus,
});

function UsersTab() {
  const t = useT();
  const { users, isLoading: usersLoading, isError: usersError, reload: reloadUsers } = useAdminUsers();
  const { pharmacies } = useAdminPharmaciesList(); // active ones only → assign targets

  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [resetTarget, setResetTarget] = useState<MemberOut | null>(null);
  const [pinTarget, setPinTarget] = useState<MemberOut | null>(null);
  const { resetUserPin } = useResetUserPin();
  const [removeTarget, setRemoveTarget] = useState<AdminUserRow | null>(null);
  const [assignTarget, setAssignTarget] = useState<AdminUserRow | null>(null);

  // These hooks refresh the whole pharmacies cache + this list.
  const { setUserStatus } = useSetUserStatus();
  const { resetUserPassword } = useResetUserPassword();
  const { deleteUser } = useDeleteUser();

  const rows = useMemo(() => users ?? [], [users]);
  const { orphans, inactive } = useMemo(
    () => ({
      orphans: rows.filter((u) => isMember(u) && !hasActivePharmacy(u)).length,
      inactive: rows.filter((u) => u.status !== "active").length,
    }),
    [rows],
  );

  // « Sans pharmacie » = no ACTIVE pharmacy (none, or an archived one).
  const filtered = useMemo(
    () =>
      rows.filter((u) => {
        if (scope === "with" && !hasActivePharmacy(u)) return false;
        if (scope === "without" && hasActivePharmacy(u)) return false;
        return (
          !search.trim() || matchesFields([u.full_name, u.email, u.phone, u.pharmacy?.name, u.pharmacy?.code], search)
        );
      }),
    [rows, scope, search],
  );

  const roleLabel = (role: string) => (KNOWN_ROLES.includes(role) ? t(`roles.${role}`) : role);
  const statusLabel = (status: string) =>
    status === "active" ? t("adminFeat.statusActive") : status === "inactive" ? t("adminFeat.statusInactive") : status;

  const columns: ColumnDef<AdminUserRow>[] = [
    {
      key: "user",
      label: t("adminUsers.colUser"),
      sortable: false,
      render: (u) => (
        <div className="flex flex-col">
          <span className="text-[13px] font-semibold text-foreground">{u.full_name ?? "—"}</span>
          <span className="text-xs text-muted-foreground">{u.email}</span>
          {u.phone && <span className="font-mono text-[11px] text-muted-foreground">{u.phone}</span>}
        </div>
      ),
    },
    {
      key: "role",
      label: t("adminUsers.colRole"),
      sortable: false,
      render: (u) => <Badge>{roleLabel(u.role)}</Badge>,
    },
    {
      key: "status",
      label: t("adminUsers.colStatus"),
      sortable: false,
      render: (u) => <Badge tone={u.status === "active" ? "success" : "neutral"}>{statusLabel(u.status)}</Badge>,
    },
    {
      key: "pharmacy",
      label: t("adminUsers.colPharmacy"),
      sortable: false,
      render: (u) =>
        u.pharmacy ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              to={`/admin/pharmacies/${u.pharmacy.id}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              {[u.pharmacy.code, u.pharmacy.name].filter(Boolean).join(" · ")}
            </Link>
            {u.pharmacy.archived_at && <Badge tone="warning">{t("adminUsers.archived")}</Badge>}
          </div>
        ) : (
          <Badge tone={isMember(u) ? "warning" : "neutral"}>{t("adminUsers.noPharmacy")}</Badge>
        ),
    },
    {
      key: "last_login_at",
      label: t("adminUsers.colLastLogin"),
      sortable: false,
      render: (u) => (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {u.last_login_at ? formatDateTime(u.last_login_at) : t("adminUsers.never")}
        </span>
      ),
    },
    {
      key: "perms",
      label: t("adminUsers.colPerms"),
      sortable: false,
      render: (u) =>
        isMember(u) ? (
          <FeaturePills features={u.granted_permissions} maxShown={3} />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "actions",
      label: t("adminUsers.colActions"),
      align: "right",
      sortable: false,
      render: (u) =>
        !isMember(u) ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <div className="flex items-center justify-end gap-1.5">
            {!hasActivePharmacy(u) && (
              <Button variant="outline" size="sm" onClick={() => setAssignTarget(u)}>
                <Building2 className="size-3.5" />
                {t("adminUsers.assign")}
              </Button>
            )}
            <MemberKebab
              member={toMember(u)}
              onResetPassword={() => setResetTarget(toMember(u))}
              onResetPin={() => setPinTarget(toMember(u))}
              onToggleStatus={() =>
                void setUserStatus({ userId: u.id, status: u.status === "active" ? "inactive" : "active" })
              }
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
            { value: "all", label: t("adminUsers.scopeAll"), activeBg: SCOPE_ACTIVE },
            { value: "with", label: t("adminUsers.scopeWith"), activeBg: SCOPE_ACTIVE },
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
        <LoadError message={t("adminUsers.loadError")} onRetry={reloadUsers} />
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
        kind="pin"
        member={pinTarget}
        onClose={() => setPinTarget(null)}
        onSubmit={async (pin) => {
          if (pinTarget) await resetUserPin({ userId: pinTarget.id, pin });
        }}
      />

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
        title={t("members.removeTitle", {
          who: removeTarget?.full_name ?? removeTarget?.email ?? t("members.thisMember"),
        })}
        description={t("members.removeDesc", { pharmacy: removeTarget?.pharmacy?.name ?? "—" })}
        onConfirm={async () => {
          if (removeTarget) await deleteUser(removeTarget.id);
          setRemoveTarget(null);
        }}
      />

      <AssignPharmacyDialog
        user={assignTarget}
        pharmacies={(pharmacies ?? []).map((p) => ({
          value: String(p.id),
          label: [p.code, p.name].filter(Boolean).join(" · "),
        }))}
        onClose={() => setAssignTarget(null)}
      />
    </>
  );
}

/** Pick an active pharmacy for an account that has none (or an archived one). */
function AssignPharmacyDialog({
  user,
  pharmacies,
  onClose,
}: {
  user: AdminUserRow | null;
  pharmacies: { value: string; label: string }[];
  onClose: () => void;
}) {
  const t = useT();
  const { assignPharmacy, isAssigning } = useAssignPharmacy();
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
    <Dialog
      open={user !== null}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader
          title={t("adminUsers.assignTitle", { name: user?.full_name ?? user?.email ?? "" })}
          subtitle={t("adminUsers.assignDesc")}
          onClose={onClose}
        />
        <DialogBody>
          <SingleSelect
            label={t("adminUsers.colPharmacy")}
            options={pharmacies}
            value={pharmacyId}
            onChange={setPharmacyId}
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isAssigning}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={() => void submit()} isLoading={isAssigning} disabled={!pharmacyId}>
            {t("adminUsers.assignBtn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** URL value of each tab (?tab=…); the pharmacies list has none. */
const TAB_PARAM: Record<string, string | null> = {
  pharmacies: null,
  users: "utilisateurs",
  requests: "demandes",
  support: "support",
};

export default function AdminPharmaciesIndex() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const tab = Object.keys(TAB_PARAM).find((id) => TAB_PARAM[id] === params.get("tab")) ?? "pharmacies";
  const { requests } = useSignupRequests(); // the count on the « Demandes » tab

  return (
    <Page title={t("adminUsers.pageTitle")} subtitle={t("adminUsers.pageSubtitle")}>
      <TabBar
        tabs={[
          { id: "pharmacies", label: t("adminUsers.tabPharmacies") },
          { id: "users", label: t("adminUsers.tabUsers") },
          { id: "requests", label: t("adminUsers.tabRequests", { n: requests.length }) },
          { id: "support", label: t("adminUsers.tabSupport") },
        ]}
        activeId={tab}
        onChange={(id) => {
          const value = TAB_PARAM[id];
          setParams(value ? { tab: value } : {});
        }}
      />

      {tab === "pharmacies" ? (
        <PharmaciesTab />
      ) : tab === "users" ? (
        <UsersTab />
      ) : tab === "requests" ? (
        <SignupRequestsTab />
      ) : (
        <SupportTab />
      )}
    </Page>
  );
}
