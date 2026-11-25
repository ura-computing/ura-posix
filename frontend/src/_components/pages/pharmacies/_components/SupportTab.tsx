/** « Support » tab of /admin/pharmacies: the admin's helpers (role `support`, every right of the admin and above
 *  it, no pharmacy). Only Support adds one (types the password, « Ouvrir dans Gmail ») and has the row menu (reset
 *  the password / the lock code, deactivate, delete); the admin sees the list, « Ajouter » disabled with its reason. */
import { useMemo, useState } from "react";
import { UserPlus } from "lucide-react";

import { Badge } from "@/_components/atoms/Badge";
import { ConfirmDialog } from "@/_components/molecules/ConfirmDialog";
import { LoadError } from "@/_components/molecules/LoadError";
import { CreateUserDialog, ResetPasswordDialog } from "@/_components/organisms/CreateUserDialog";
import { DataTable, type ColumnDef } from "@/_components/organisms/DataTable";
import { FilterBar } from "@/_components/organisms/FilterBar";
import { MemberKebab } from "@/_components/organisms/MemberKebab";
import { STATUS_LABEL } from "@/_components/organisms/memberConstants";
import { useMe } from "@/hooks/useMe";
import { useT } from "@/i18n/I18nProvider";
import { ROLES } from "@/types";
import type { AccountRef, SupportAccountRow } from "@/types/members";
import { formatDateTime } from "@/utils/format";
import { matchesFields } from "@/utils/text";

import {
  useCreateSupport,
  useDeleteUser,
  useResetUserPassword,
  useResetUserPin,
  useSetUserStatus,
  useSupportAccounts,
} from "../hooks";

const toAccount = (s: SupportAccountRow): AccountRef => ({
  id: s.id,
  full_name: s.full_name,
  email: s.email,
  role: "support",
});

export function SupportTab() {
  const t = useT();
  const { accounts, isLoading, isError, reload } = useSupportAccounts();
  const { createSupport, isCreatingSupport } = useCreateSupport();
  const { resetUserPassword } = useResetUserPassword();
  const { resetUserPin } = useResetUserPin();
  const { setUserStatus } = useSetUserStatus();
  const { deleteUser } = useDeleteUser();
  const { me } = useMe();
  const canManage = me?.role === ROLES.SUPPORT;

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<AccountRef | null>(null);
  const [pinTarget, setPinTarget] = useState<AccountRef | null>(null);
  const [removeTarget, setRemoveTarget] = useState<SupportAccountRow | null>(null);

  const filtered = useMemo(
    () => accounts.filter((s) => !search.trim() || matchesFields([s.full_name, s.email], search)),
    [accounts, search],
  );

  const columns: ColumnDef<SupportAccountRow>[] = [
    {
      key: "person",
      label: t("adminSupport.colPerson"),
      sortable: false,
      render: (s) => (
        <div className="flex flex-col">
          <span className="text-[13px] font-semibold text-foreground">{s.full_name ?? "—"}</span>
          <span className="text-xs text-muted-foreground">{s.email}</span>
        </div>
      ),
    },
    {
      key: "status",
      label: t("adminUsers.colStatus"),
      sortable: false,
      render: (s) => <Badge tone={s.status === "active" ? "success" : "neutral"}>{t(STATUS_LABEL[s.status])}</Badge>,
    },
    {
      key: "open_requests",
      label: t("adminSupport.colStores"),
      sortable: false,
      render: (s) => <span className="font-mono tabular-nums">{s.open_requests}</span>,
    },
    {
      key: "last_login_at",
      label: t("adminUsers.colLastLogin"),
      sortable: false,
      render: (s) => (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {s.last_login_at ? formatDateTime(s.last_login_at) : t("adminUsers.never")}
        </span>
      ),
    },
    {
      key: "actions",
      label: t("adminUsers.colActions"),
      align: "right",
      sortable: false,
      render: (s) =>
        canManage ? (
          <div className="flex justify-end">
            <MemberKebab
              member={s}
              onResetPassword={() => setResetTarget(toAccount(s))}
              onResetPin={() => setPinTarget(toAccount(s))}
              onToggleStatus={() =>
                void setUserStatus({ userId: s.id, status: s.status === "active" ? "inactive" : "active" })
              }
              onRemove={() => setRemoveTarget(s)}
            />
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {t("adminSupport.intro")} {!canManage && t("adminSupport.supportOnly")}
      </p>

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: t("adminSupport.searchPh"), suggestions: null }}
        rightActions={[
          {
            label: t("adminSupport.add"),
            variant: "primary",
            icon: <UserPlus className="size-4" />,
            onClick: () => setCreateOpen(true),
            disabled: !canManage,
          },
        ]}
      />

      {isError ? (
        <LoadError message={t("adminSupport.loadError")} onRetry={reload} />
      ) : (
        <DataTable
          rows={filtered}
          columns={columns}
          isLoading={isLoading}
          rowKey={(s) => s.id}
          emptyTitle={t("adminSupport.empty")}
          emptyHint={t("adminSupport.emptyHint")}
        />
      )}

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        pharmacies={[]}
        support
        isSaving={isCreatingSupport}
        onSubmit={async ({ full_name, email, password }) => ({
          member: toAccount(await createSupport({ full_name: full_name ?? "", email, password })),
        })}
      />

      <ResetPasswordDialog
        member={resetTarget}
        onClose={() => setResetTarget(null)}
        onSubmit={async (password) => {
          if (resetTarget) await resetUserPassword({ userId: resetTarget.id, password });
        }}
      />

      <ResetPasswordDialog
        kind="pin"
        member={pinTarget}
        onClose={() => setPinTarget(null)}
        onSubmit={async (pin) => {
          if (pinTarget) await resetUserPin({ userId: pinTarget.id, pin });
        }}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        variant="destructive"
        title={t("members.removeTitle", {
          who: removeTarget?.full_name ?? removeTarget?.email ?? t("members.thisMember"),
        })}
        description={t("adminSupport.removeDesc")}
        onConfirm={async () => {
          if (removeTarget) await deleteUser(removeTarget.id);
          setRemoveTarget(null);
        }}
      />
    </>
  );
}
