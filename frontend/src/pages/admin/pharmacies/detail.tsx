/** Screen 2 — admin pharmacy detail. Header + features grid + members table.
 *
 *  Permission editing: admin can edit owners AND employees. The dialog renders
 *  one ceiling pill per row for owners (Pharmacie) and two for employees
 *  (Pharmacie + Propriétaires) — the 3-layer intersection at read time still
 *  applies, so the second ceiling for employees is informational: it shows
 *  whether admin's grant would actually be effective. Owner-union comes from
 *  `detail.owners_union_permissions` in the GET response. */
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Pencil, SlidersHorizontal, Trash2, UserPlus, Users } from "lucide-react";

import { useT } from "@/i18n/I18nProvider";

import { AsyncButton } from "@/components/shared/AsyncButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { CreateUserDialog, ResetPasswordDialog } from "@/components/shared/members/CreateUserDialog";
import { FeaturePills } from "@/components/shared/members/FeaturePills";
import { MemberKebab } from "@/components/shared/members/MemberKebab";
import { UserPermissionsDialog } from "@/components/shared/members/UserPermissionsDialog";
import { ROLE_LABEL, STATUS_LABEL, allFeatures, toFeatureRecord, type FeatureKey } from "@/components/shared/members/constants";
import { ROUTES, type CreateUserIn, type CreateUserOut, type MemberOut, type PharmacyIn } from "@/types";
import { cn } from "@/utils/cn";

import { FeatureToggleGrid } from "./_components/FeatureToggleGrid";
import { PharmacyFormDialog } from "./_components/PharmacyFormDialog";
import {
  useAdminPharmacy,
  useArchivePharmacy,
  useCreateUser,
  useDeleteUser,
  useResetUserPassword,
  useSetPharmacyFeatures,
  useSetUserPermissions,
  useSetUserStatus,
  useUpdatePharmacy,
} from "./_hooks/useAdminPharmacies";


const PILL_BASE = "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold";


export default function AdminPharmacyDetail() {
  const t = useT();
  const { id: idParam } = useParams<{ id: string }>();
  const id = Number(idParam);
  const nav = useNavigate();

  const [editOpen,        setEditOpen]        = useState(false);
  const [createUserOpen,  setCreateUserOpen]  = useState(false);
  const [permDialogUser,  setPermDialogUser]  = useState<MemberOut | null>(null);
  const [deleteOpen,      setDeleteOpen]      = useState(false);
  const [resetTarget,     setResetTarget]     = useState<MemberOut | null>(null);
  const [removeTarget,    setRemoveTarget]    = useState<MemberOut | null>(null);

  // Pending feature toggles — separate from the server values; resets after save.
  const [pendingFeatures, setPendingFeatures] = useState<Record<FeatureKey, boolean> | null>(null);

  const detailQ = useAdminPharmacy(id);
  const detail  = detailQ.data ?? null;

  const updateMut   = useUpdatePharmacy(id);
  const archiveMut  = useArchivePharmacy(id);
  const featuresMut = useSetPharmacyFeatures(id);
  const permsMut    = useSetUserPermissions(id);
  const createMut   = useCreateUser(id);
  const resetPwdMut = useResetUserPassword();
  const statusMut   = useSetUserStatus(id);
  const removeMut   = useDeleteUser(id);

  const isSavingFeatures = featuresMut.isPending;
  const isSavingPerms    = permsMut.isPending;

  const serverFeatures: Record<FeatureKey, boolean> = useMemo(
    () => toFeatureRecord(detail?.enabled_features),
    [detail],
  );

  const featureValues = pendingFeatures ?? serverFeatures;

  const handleEdit = async (v: PharmacyIn) => {
    await updateMut.mutateAsync(v);
    setEditOpen(false);
  };
  const handleCreateUser = async (v: CreateUserIn): Promise<CreateUserOut> =>
    createMut.mutateAsync(v);
  const handleSaveFeatures = async () => {
    if (!pendingFeatures) return;
    await featuresMut.mutateAsync(pendingFeatures);
    setPendingFeatures(null);
  };
  const handleSavePerms = async (user: MemberOut, next: Record<FeatureKey, boolean>) => {
    await permsMut.mutateAsync({ userId: user.id, permissions: next });
    setPermDialogUser(null);
  };
  const handleDelete = async () => {
    await archiveMut.mutateAsync();
    nav(ROUTES.ADMIN_PHARMACIES);
  };
  const handleResetPassword = async (password: string) => {
    if (resetTarget) await resetPwdMut.mutateAsync({ userId: resetTarget.id, password });
  };
  const handleToggleStatus = async (member: MemberOut) => {
    const status = member.status === "active" ? "inactive" : "active";
    await statusMut.mutateAsync({ userId: member.id, status });
  };
  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    await removeMut.mutateAsync(removeTarget.id);
    setRemoveTarget(null);
  };
  const isLoading = detailQ.isLoading;

  if (isLoading || !detail) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 py-10 text-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  const owners    = detail.members.filter((m) => m.role === "owner");
  const employees = detail.members.filter((m) => m.role === "employee");

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4 pb-20">
      {/* Prominent back button — easy to spot when admin lands deep in a
          pharmacy detail. Breadcrumb below confirms location. */}
      <Link
        to={ROUTES.ADMIN_PHARMACIES}
        className="inline-flex h-9 w-fit cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-subtle"
      >
        <ArrowLeft className="size-4" />
        {t("adminPharm.backToPharmacies")}
      </Link>

      <nav className="flex items-center gap-1 text-xs text-muted-foreground">
        <Link to={ROUTES.ADMIN_PHARMACIES} className="hover:text-foreground">{t("adminPharm.pharmacies")}</Link>
        <ChevronRight className="size-3" />
        <span className="text-foreground">{detail.name}</span>
      </nav>

      {/* Header card */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">{detail.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {[detail.city, detail.code, detail.address].filter(Boolean).join(" · ") || <>&nbsp;</>}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {[detail.phone, detail.email].filter(Boolean).join(" · ") || <>&nbsp;</>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AsyncButton variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            {t("common.edit")}
          </AsyncButton>
          <AsyncButton variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" />
            {t("common.delete")}
          </AsyncButton>
        </div>
      </div>

      {/* Section A — pharmacy features */}
      <FeatureToggleGrid
        values={featureValues}
        serverValues={serverFeatures}
        isSaving={isSavingFeatures}
        onToggle={(k, next) => setPendingFeatures({ ...featureValues, [k]: next })}
        onEnableAll={() => setPendingFeatures(allFeatures(true))}
        onDisableAll={() => setPendingFeatures(allFeatures(false))}
        onSave={handleSaveFeatures}
        onCancel={() => setPendingFeatures(null)}
      />

      {/* Section B — members */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-semibold text-foreground">{t("adminPharm.members")}</h2>
            <p className="text-sm text-muted-foreground">{t("adminPharm.membersDesc")}</p>
          </div>
          <AsyncButton variant="secondary" onClick={() => setCreateUserOpen(true)}>
            <UserPlus className="size-4" />
            {t("adminPharm.newUser")}
          </AsyncButton>
        </div>

        {detail.members.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-11 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Users className="size-5" />
            </span>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t("adminPharm.membersEmpty")}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-subtle text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5">{t("adminPharm.colName")}</th>
                <th className="px-3 py-2.5">{t("adminPharm.colRole")}</th>
                <th className="px-3 py-2.5">{t("col.statut")}</th>
                <th className="px-3 py-2.5">{t("adminPharm.colPerms")}</th>
                <th className="px-3 py-2.5 text-right">{t("adminPharm.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {[...owners, ...employees].map((m) => {
                const manageBtn = (
                  <button
                    type="button"
                    onClick={() => setPermDialogUser(m)}
                    className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-border px-3 text-xs font-semibold text-foreground hover:bg-surface-subtle"
                  >
                    <SlidersHorizontal className="size-3.5" />
                    {t("adminPharm.managePerms")}
                  </button>
                );
                return (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-7 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground">
                          {(m.full_name ?? m.email).split(/\s+/).slice(0, 2).map((s: string) => s[0]?.toUpperCase()).join("")}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-[13px] font-semibold text-foreground">{m.full_name ?? "—"}</span>
                          <span className="text-xs text-muted-foreground">{m.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn(PILL_BASE, m.role === "owner" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                        {t(ROLE_LABEL[m.role])}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn(PILL_BASE, m.status === "active" ? "bg-success-subtle text-success" : "bg-muted text-muted-foreground")}>
                        {t(STATUS_LABEL[m.status])}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <FeaturePills features={m.granted_permissions} maxShown={3} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {manageBtn}
                        <MemberKebab
                          member={m}
                          onResetPassword={() => setResetTarget(m)}
                          onToggleStatus={() => handleToggleStatus(m)}
                          onRemove={() => setRemoveTarget(m)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Dialogs */}
      <PharmacyFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialValues={{
          name: detail.name, code: detail.code ?? "", city: detail.city ?? "",
          address: detail.address ?? "", phone: detail.phone ?? "", email: detail.email ?? "",
        }}
        pharmacyName={detail.name}
        onSubmit={async (v) => { await handleEdit(v); setEditOpen(false); }}
      />

      <CreateUserDialog
        open={createUserOpen}
        onClose={() => setCreateUserOpen(false)}
        pharmacies={[{ id: detail.id, name: detail.name, city: detail.city }]}
        defaultPharmacyId={detail.id}
        onSubmit={handleCreateUser}
      />

      <ResetPasswordDialog member={resetTarget} onClose={() => setResetTarget(null)} onSubmit={handleResetPassword} />

      <UserPermissionsDialog
        open={permDialogUser !== null}
        onClose={() => setPermDialogUser(null)}
        user={permDialogUser}
        contextStrip={
          permDialogUser?.role === "employee" ? (
            <>
              {t("adminPharm.ctxEmployeeBelongs")} <strong>{detail.name}</strong>. {t("adminPharm.ctxEmployeeRule")}
            </>
          ) : (
            <>
              {t("adminPharm.ctxUserBelongs")} <strong>{detail.name}</strong>. {t("adminPharm.ctxUserRule")}
            </>
          )
        }
        ceilings={
          permDialogUser?.role === "employee"
            ? [
                { label: t("adminPharm.ceilingPharmacy"),  values: serverFeatures },
                { label: t("adminPharm.ceilingOwners"),    values: toFeatureRecord(detail.owners_union_permissions) },
              ]
            : [{ label: t("adminPharm.ceilingPharmacy"), values: serverFeatures }]
        }
        serverPermissions={toFeatureRecord(permDialogUser?.granted_permissions)}
        isSaving={isSavingPerms}
        onSave={async (next) => {
          if (permDialogUser) await handleSavePerms(permDialogUser, next);
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t("adminPharm.deletePharmacyTitle", { name: detail.name })}
        description={t("adminPharm.deletePharmacyDesc")}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        variant="destructive"
        title={t("members.removeTitle", { who: removeTarget?.full_name ?? removeTarget?.email ?? t("members.thisMember") })}
        description={t("members.removeDesc", { pharmacy: detail.name })}
        onConfirm={handleConfirmRemove}
      />
    </div>
  );
}

