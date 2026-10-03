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
import {
  ArrowLeft,
  ChevronRight,
  Pencil,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  Users,
  Check,
  Loader2,
} from "lucide-react";

import { useT } from "@/i18n/I18nProvider";

import { AsyncButton } from "@/_components/AsyncButton";
import { ConfirmDialog } from "@/_components/ConfirmDialog";
import { CreateUserDialog, ResetPasswordDialog } from "@/_components/CreateUserDialog";
import { FeaturePills } from "@/_components/FeaturePills";
import { MemberKebab } from "@/_components/MemberKebab";
import { UserPermissionsDialog } from "@/_components/UserPermissionsDialog";
import {
  ROLE_LABEL,
  STATUS_LABEL,
  allFeatures,
  toFeatureRecord,
  type FeatureKey,
  FEATURES,
} from "@/_components/memberConstants";
import { ROUTES, type CreateUserIn, type CreateUserOut, type MemberOut, type PharmacyIn } from "@/types";
import { cn } from "@/utils/cn";

import { PharmacyFormDialog } from "../_components/PharmacyFormDialog";
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
} from "../hooks";
import { Switch } from "@/_components/Switch";

/** Section A of the pharmacy detail page — pharmacy-level feature toggles.
 *
 *  BATCHED SAVE (per locked decision): the parent holds two states — the
 *  server's current value (`enabledFeatures`) and the pending edits
 *  (`pendingValues`). This component just renders the toggles + the dirty
 *  action bar. Single bulk PUT fires on Enregistrer.
 *
 *  Drops the handoff's per-toggle pendingKey/saveState — those belonged to
 *  the original optimistic-save plan we overrode.
 */

interface FeatureToggleGridProps {
  /** Pending values — what the user has currently set in the dialog. */
  values:        Record<FeatureKey, boolean>;
  /** Server's current state — used to compute dirty-count. */
  serverValues:  Record<FeatureKey, boolean>;
  isSaving?:     boolean;
  onToggle:      (key: FeatureKey, next: boolean) => void;
  onEnableAll:   () => void;
  onDisableAll:  () => void;
  onSave:        () => void;
  onCancel:      () => void;
}

function FeatureToggleGrid({
  values, serverValues, isSaving, onToggle, onEnableAll, onDisableAll, onSave, onCancel,
}: FeatureToggleGridProps) {
  const t = useT();
  const enabledCount = FEATURES.filter((f) => values[f.key]).length;
  const dirtyCount   = FEATURES.filter((f) => values[f.key] !== serverValues[f.key]).length;
  const isDirty      = dirtyCount > 0;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex max-w-[620px] flex-col gap-0.5">
          <h2 className="text-base font-semibold text-foreground">{t("adminPharm.pharmacyFeaturesTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("adminPharm.pharmacyFeaturesDesc")}
          </p>
        </div>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {enabledCount} / 9 {t("adminPharm.activatedFem")}
        </span>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const on    = values[f.key];
            const dirty = on !== serverValues[f.key];
            const Icon  = f.icon;
            return (
              <div
                key={f.key}
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors",
                  dirty && "border-primary/40 bg-primary/5",
                )}
              >
                <span
                  data-on={on}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground data-[on=true]:bg-primary/15 data-[on=true]:text-primary"
                >
                  <Icon className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold text-foreground">{t(f.label)}</span>
                  <span className="text-[11.5px] leading-snug text-muted-foreground">{t(f.description)}</span>
                </div>
                <Switch checked={on} onChange={(next) => onToggle(f.key, next)} />
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3.5">
          <AsyncButton variant="ghost" onClick={onEnableAll} className="!h-8 !px-2 text-xs">
            <Check className="size-3.5" />
            {t("adminPharm.enableAll")}
          </AsyncButton>
          <AsyncButton variant="ghost" onClick={onDisableAll} className="!h-8 !px-2 text-xs">
            {t("adminPharm.disableAll")}
          </AsyncButton>
        </div>
      </div>

      {/* Dirty action bar — appears only when at least one toggle differs from the server. */}
      {isDirty && (
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-primary/30 bg-primary/10 px-5 py-3">
          <span className="text-sm font-semibold text-primary">
            {dirtyCount} {t(dirtyCount > 1 ? "adminPharm.unsavedChangesPlural" : "adminPharm.unsavedChangesSingular")}
          </span>
          <div className="flex items-center gap-2">
            <AsyncButton variant="ghost" onClick={onCancel} disabled={isSaving}>
              {t("common.cancel")}
            </AsyncButton>
            <AsyncButton variant="primary" onClick={onSave} disabled={isSaving}>
              {isSaving && <Loader2 className="size-3.5 animate-spin" />}
              {t("common.save")}
            </AsyncButton>
          </div>
        </div>
      )}
    </section>
  );
}

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

  const {
    pharmacy,
    isLoading,
  } = useAdminPharmacy(id);
  const detail = pharmacy ?? null;

  const { updatePharmacy } = useUpdatePharmacy(id);
  const { archivePharmacy } = useArchivePharmacy(id);
  const {
    setPharmacyFeatures,
    isSavingFeatures,
  } = useSetPharmacyFeatures(id);
  const {
    setUserPermissions,
    isSavingPermissions: isSavingPerms,
  } = useSetUserPermissions(id);
  const { createUser } = useCreateUser();
  const { resetUserPassword } = useResetUserPassword();
  const { setUserStatus } = useSetUserStatus(id);
  const { deleteUser } = useDeleteUser(id);

  const serverFeatures: Record<FeatureKey, boolean> = useMemo(
    () => toFeatureRecord(detail?.enabled_features),
    [detail],
  );

  const featureValues = pendingFeatures ?? serverFeatures;

  const handleEdit = async (v: PharmacyIn) => {
    await updatePharmacy(v);
    setEditOpen(false);
  };
  const handleCreateUser = async (v: CreateUserIn): Promise<CreateUserOut> => createUser(v);
  const handleSaveFeatures = async () => {
    if (!pendingFeatures) return;
    await setPharmacyFeatures(pendingFeatures);
    setPendingFeatures(null);
  };
  const handleSavePerms = async (user: MemberOut, next: Record<FeatureKey, boolean>) => {
    await setUserPermissions({ userId: user.id, permissions: next });
    setPermDialogUser(null);
  };
  const handleDelete = async () => {
    await archivePharmacy();
    nav(ROUTES.ADMIN_PHARMACIES);
  };
  const handleResetPassword = async (password: string) => {
    if (resetTarget) await resetUserPassword({ userId: resetTarget.id, password });
  };
  const handleToggleStatus = async (member: MemberOut) => {
    const status = member.status === "active" ? "inactive" : "active";
    await setUserStatus({ userId: member.id, status });
  };
  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    await deleteUser(removeTarget.id);
    setRemoveTarget(null);
  };

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

