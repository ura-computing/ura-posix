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
import { ArrowLeft, ChevronRight, Pencil, Trash2, Check } from "lucide-react";

import { useT } from "@/i18n/I18nProvider";

import { Button } from "@/_components/atoms/Button";
import { ConfirmDialog } from "@/_components/molecules/ConfirmDialog";
import { CreateUserDialog, ResetPasswordDialog } from "@/_components/organisms/CreateUserDialog";
import { MembersSection } from "@/_components/organisms/MembersSection";
import { UserPermissionsDialog } from "@/_components/organisms/UserPermissionsDialog";
import { allFeatures, toFeatureRecord, type FeatureKey, FEATURES } from "@/_components/organisms/memberConstants";
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
import { Switch } from "@/_components/atoms/Switch";
import { Page } from "@/_components/templates/Page";
import { Spinner } from "@/_components/atoms/Spinner";
import { PageSkeleton } from "@/_components/molecules/Skeletons";

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
  values: Record<FeatureKey, boolean>;
  /** Server's current state — used to compute dirty-count. */
  serverValues: Record<FeatureKey, boolean>;
  isSaving?: boolean;
  onToggle: (key: FeatureKey, next: boolean) => void;
  onEnableAll: () => void;
  onDisableAll: () => void;
  onSave: () => void;
  onCancel: () => void;
}

function FeatureToggleGrid({
  values,
  serverValues,
  isSaving,
  onToggle,
  onEnableAll,
  onDisableAll,
  onSave,
  onCancel,
}: FeatureToggleGridProps) {
  const t = useT();
  const enabledCount = FEATURES.filter((f) => values[f.key]).length;
  const dirtyCount = FEATURES.filter((f) => values[f.key] !== serverValues[f.key]).length;
  const isDirty = dirtyCount > 0;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex max-w-[620px] flex-col gap-0.5">
          <h2 className="text-base font-semibold text-foreground">{t("adminPharm.pharmacyFeaturesTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("adminPharm.pharmacyFeaturesDesc")}</p>
        </div>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {enabledCount} / 9 {t("adminPharm.activatedFem")}
        </span>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const on = values[f.key];
            const dirty = on !== serverValues[f.key];
            const Icon = f.icon;
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
          <Button variant="ghost" onClick={onEnableAll} className="!h-8 !px-2 text-xs">
            <Check className="size-3.5" />
            {t("adminPharm.enableAll")}
          </Button>
          <Button variant="ghost" onClick={onDisableAll} className="!h-8 !px-2 text-xs">
            {t("adminPharm.disableAll")}
          </Button>
        </div>
      </div>

      {/* Dirty action bar — appears only when at least one toggle differs from the server. */}
      {isDirty && (
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-primary/30 bg-primary/10 px-5 py-3">
          <span className="text-sm font-semibold text-primary">
            {dirtyCount} {t(dirtyCount > 1 ? "adminPharm.unsavedChangesPlural" : "adminPharm.unsavedChangesSingular")}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={onSave} disabled={isSaving}>
              {isSaving && <Spinner size="sm" />}
              {t("common.save")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function AdminPharmacyDetail() {
  const t = useT();
  const { id: idParam } = useParams<{ id: string }>();
  const id = Number(idParam);
  const nav = useNavigate();

  const [editOpen, setEditOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [permDialogUser, setPermDialogUser] = useState<MemberOut | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<MemberOut | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MemberOut | null>(null);

  // Pending feature toggles — separate from the server values; resets after save.
  const [pendingFeatures, setPendingFeatures] = useState<Record<FeatureKey, boolean> | null>(null);

  const { pharmacy, isLoading } = useAdminPharmacy(id);
  const detail = pharmacy ?? null;

  const { updatePharmacy } = useUpdatePharmacy(id);
  const { archivePharmacy } = useArchivePharmacy(id);
  const { setPharmacyFeatures, isSavingFeatures } = useSetPharmacyFeatures(id);
  const { setUserPermissions, isSavingPermissions: isSavingPerms } = useSetUserPermissions();
  const { createUser } = useCreateUser();
  const { resetUserPassword } = useResetUserPassword();
  const { setUserStatus } = useSetUserStatus();
  const { deleteUser } = useDeleteUser();

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
    return <PageSkeleton />;
  }

  return (
    <Page
      above={
        <>
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
            <Link to={ROUTES.ADMIN_PHARMACIES} className="hover:text-foreground">
              {t("adminPharm.pharmacies")}
            </Link>
            <ChevronRight className="size-3" />
            <span className="text-foreground">{detail.name}</span>
          </nav>
        </>
      }
      title={detail.name}
      subtitle={
        <>
          <p>{[detail.city, detail.code, detail.address].filter(Boolean).join(" · ")}</p>
          <p>{[detail.phone, detail.email].filter(Boolean).join(" · ")}</p>
        </>
      }
      actions={
        <>
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            {t("common.edit")}
          </Button>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" />
            {t("common.delete")}
          </Button>
        </>
      }
    >
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

      {/* Section B — members (same card as « Gérer mon équipe ») */}
      <MembersSection
        title={t("adminPharm.members")}
        description={t("adminPharm.membersDesc")}
        addLabel={t("adminPharm.newUser")}
        onAdd={() => setCreateUserOpen(true)}
        emptyText={t("adminPharm.membersEmpty")}
        members={detail.members}
        onManagePermissions={setPermDialogUser}
        onResetPassword={setResetTarget}
        onToggleStatus={handleToggleStatus}
        onRemove={setRemoveTarget}
      />

      {/* Dialogs */}
      <PharmacyFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialValues={{
          name: detail.name,
          code: detail.code ?? "",
          city: detail.city ?? "",
          address: detail.address ?? "",
          phone: detail.phone ?? "",
          email: detail.email ?? "",
        }}
        pharmacyName={detail.name}
        onSubmit={async (v) => {
          await handleEdit(v);
          setEditOpen(false);
        }}
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
                { label: t("adminPharm.ceilingPharmacy"), values: serverFeatures },
                { label: t("adminPharm.ceilingOwners"), values: toFeatureRecord(detail.owners_union_permissions) },
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
        title={t("members.removeTitle", {
          who: removeTarget?.full_name ?? removeTarget?.email ?? t("members.thisMember"),
        })}
        description={t("members.removeDesc", { pharmacy: detail.name })}
        onConfirm={handleConfirmRemove}
      />
    </Page>
  );
}
