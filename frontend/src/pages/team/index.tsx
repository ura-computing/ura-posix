/** Gérer mon équipe — owner's employee management page.
 *
 *  Section A: read-only summary of the 10 features with their availability
 *    state (active / pharmacy-blocked / owner-blocked). Helps the owner
 *    understand the 2-layer ceiling before opening any dialog.
 *  Section B: employees table + actions (Inviter / Gérer les permissions /
 *    Réinitialiser / Désactiver / Supprimer).
 *
 *  Shares _components/ with the admin pharmacy page: MembersSection (the
 *  table), CreateUserDialog (role locked to "employee" via the roleLocked prop),
 *  UserPermissionsDialog (N ceiling layers — we pass [Pharmacie, Vous]). */
import { useState } from "react";

import { useT } from "@/i18n/I18nProvider";

import { ConfirmDialog } from "@/_components/ConfirmDialog";
import { CreateUserDialog, ResetPasswordDialog } from "@/_components/CreateUserDialog";
import { MembersSection } from "@/_components/MembersSection";
import { UserPermissionsDialog } from "@/_components/UserPermissionsDialog";
import { FEATURES, toFeatureRecord, type FeatureKey } from "@/_components/memberConstants";
import { useMe } from "@/hooks/useMe";
import { cn } from "@/utils/cn";
import type { CreateUserIn, CreateUserOut, MemberOut } from "@/types";

import {
  useCreateEmployee,
  useDeleteEmployee,
  useOwnerEmployees,
  useResetEmployeePassword,
  useSetEmployeePermissions,
  useSetEmployeeStatus,
} from "./hooks";
import { Page } from "@/_components/Page";

export default function OwnerEmployeesPage() {
  const t = useT();
  const { me } = useMe();

  const [createOpen, setCreateOpen] = useState(false);
  const [permDialogUser, setPermDialogUser] = useState<MemberOut | null>(null);
  const [removeTarget, setRemoveTarget] = useState<MemberOut | null>(null);
  const [resetTarget, setResetTarget] = useState<MemberOut | null>(null);

  const { team, isLoading } = useOwnerEmployees();
  const { createEmployee } = useCreateEmployee();
  const { setEmployeePermissions, isSavingPermissions } = useSetEmployeePermissions();
  const { setEmployeeStatus } = useSetEmployeeStatus();
  const { resetEmployeePassword } = useResetEmployeePassword();
  const { deleteEmployee } = useDeleteEmployee();

  if (isLoading || !team) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 py-10 text-center text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  const { employees, pharmacy_features, my_permissions } = team;
  const pharmFeats = toFeatureRecord(pharmacy_features);
  const myPerms = toFeatureRecord(my_permissions);

  const handleCreate = async (v: CreateUserIn): Promise<CreateUserOut> => createEmployee(v);

  const handleSavePerms = async (next: Record<FeatureKey, boolean>) => {
    if (!permDialogUser) return;
    await setEmployeePermissions({ employeeId: permDialogUser.id, permissions: next });
    setPermDialogUser(null);
  };

  const handleResetPassword = async (password: string) => {
    if (resetTarget) await resetEmployeePassword({ employeeId: resetTarget.id, password });
  };

  const handleToggleStatus = async (employee: MemberOut) => {
    const nextStatus = employee.status === "active" ? "inactive" : "active";
    await setEmployeeStatus({ employeeId: employee.id, status: nextStatus });
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    await deleteEmployee(removeTarget.id);
    setRemoveTarget(null);
  };

  const pharmacyName = me?.pharmacy?.name ?? t("employees.yourPharmacy");

  return (
    <Page title={t("employees.title")} subtitle={t("employees.subtitle")}>
      {/* Section A — pharmacy features summary (read-only) */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">{t("employees.featuresTitle")}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("employees.featuresDesc")}</p>
        </div>
        <div className="grid grid-cols-1 gap-2.5 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const phEnabled = pharmFeats[f.key];
            const ownerEnabled = myPerms[f.key];
            const fullyOk = phEnabled && ownerEnabled;
            const Icon = f.icon;

            // Three visual states: active (you can grant), locked-by-you (pharmacy ok, you don't have it),
            // locked-by-pharmacy (admin hasn't enabled it for this pharmacy).
            const stateTone = !phEnabled ? "muted" : !ownerEnabled ? "warning" : "ok";
            const stateLabel = !phEnabled
              ? t("employees.disabledForPharmacy")
              : !ownerEnabled
                ? t("employees.notGrantedToYou")
                : t("employees.available");

            return (
              <div
                key={f.key}
                data-tone={stateTone}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 data-[tone=muted]:border-dashed data-[tone=muted]:bg-surface-subtle"
              >
                <span
                  data-tone={stateTone}
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    fullyOk
                      ? "bg-primary/15 text-primary"
                      : phEnabled
                        ? "bg-warning-subtle text-warning"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold text-foreground">{t(f.label)}</span>
                  <span className="text-[11.5px] leading-snug text-muted-foreground">{stateLabel}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section B — employees (same card as the admin pharmacy page) */}
      <MembersSection
        title={t("employees.employees")}
        description={t("employees.employeesDesc")}
        addLabel={t("employees.invite")}
        onAdd={() => setCreateOpen(true)}
        emptyText={t("employees.empty")}
        members={employees}
        onManagePermissions={setPermDialogUser}
        onResetPassword={setResetTarget}
        onToggleStatus={handleToggleStatus}
        onRemove={setRemoveTarget}
      />

      {/* Dialogs */}
      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        pharmacies={me?.pharmacy ? [{ id: me.pharmacy.id, name: me.pharmacy.name, city: null }] : []}
        defaultPharmacyId={me?.pharmacy?.id}
        roleLocked="employee"
        onSubmit={handleCreate}
      />

      <ResetPasswordDialog member={resetTarget} onClose={() => setResetTarget(null)} onSubmit={handleResetPassword} />

      <UserPermissionsDialog
        open={permDialogUser !== null}
        onClose={() => setPermDialogUser(null)}
        user={permDialogUser}
        contextStrip={t("employees.permContext")}
        ceilings={[
          { label: t("employees.ceilingPharmacy"), values: pharmFeats },
          { label: t("employees.ceilingYou"), values: myPerms },
        ]}
        serverPermissions={toFeatureRecord(permDialogUser?.granted_permissions)}
        isSaving={isSavingPermissions}
        onSave={handleSavePerms}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        variant="destructive"
        title={t("members.removeTitle", {
          who: removeTarget?.full_name ?? removeTarget?.email ?? t("members.thisMember"),
        })}
        description={t("members.removeDesc", { pharmacy: pharmacyName })}
        onConfirm={handleConfirmRemove}
      />
    </Page>
  );
}
