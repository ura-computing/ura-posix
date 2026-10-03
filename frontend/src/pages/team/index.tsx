/** Gérer mon équipe — owner's employee management page.
 *
 *  Section A: read-only summary of the 9 features with their availability
 *    state (active / pharmacy-blocked / owner-blocked). Helps the owner
 *    understand the 2-layer ceiling before opening any dialog.
 *  Section B: employees table + actions (Inviter / Gérer les permissions /
 *    Réinitialiser / Désactiver / Supprimer).
 *
 *  Shares components/shared/members/ with the admin pharmacy page:
 *  CreateUserDialog (role locked to "employee" via the roleLocked prop),
 *  UserPermissionsDialog (N ceiling layers — we pass [Pharmacie, Vous]) and
 *  MemberKebab. */
import { useState } from "react";
import { SlidersHorizontal, UserPlus, Users } from "lucide-react";

import { useT } from "@/i18n/I18nProvider";

import { AsyncButton } from "@/_components/AsyncButton";
import { ConfirmDialog } from "@/_components/ConfirmDialog";
import { CreateUserDialog, ResetPasswordDialog } from "@/_components/CreateUserDialog";
import { FeaturePills } from "@/_components/FeaturePills";
import { MemberKebab } from "@/_components/MemberKebab";
import { UserPermissionsDialog } from "@/_components/UserPermissionsDialog";
import { FEATURES, ROLE_LABEL, STATUS_LABEL, toFeatureRecord, type FeatureKey } from "@/_components/memberConstants";
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

const PILL_BASE = "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold";

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
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4 pb-30">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("employees.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("employees.subtitle")}</p>
      </header>

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

      {/* Section B — employees */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-semibold text-foreground">{t("employees.employees")}</h2>
            <p className="text-sm text-muted-foreground">{t("employees.employeesDesc")}</p>
          </div>
          <AsyncButton variant="primary" onClick={() => setCreateOpen(true)}>
            <UserPlus className="size-4" />
            {t("employees.invite")}
          </AsyncButton>
        </div>

        {employees.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-11 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Users className="size-5" />
            </span>
            <p className="max-w-sm text-sm text-muted-foreground">{t("employees.empty")}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-subtle text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5">{t("employees.colName")}</th>
                <th className="px-3 py-2.5">{t("employees.colRole")}</th>
                <th className="px-3 py-2.5">{t("employees.colStatus")}</th>
                <th className="px-3 py-2.5">{t("employees.colPerms")}</th>
                <th className="px-3 py-2.5 text-right">{t("employees.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-7 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground">
                        {(m.full_name ?? m.email)
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((s: string) => s[0]?.toUpperCase())
                          .join("")}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-[13px] font-semibold text-foreground">{m.full_name ?? "—"}</span>
                        <span className="text-xs text-muted-foreground">{m.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn(PILL_BASE, "bg-muted text-muted-foreground")}>{t(ROLE_LABEL[m.role])}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        PILL_BASE,
                        m.status === "active" ? "bg-success-subtle text-success" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {t(STATUS_LABEL[m.status])}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <FeaturePills features={m.granted_permissions} maxShown={3} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPermDialogUser(m)}
                        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-border px-3 text-xs font-semibold text-foreground hover:bg-surface-subtle"
                      >
                        <SlidersHorizontal className="size-3.5" />
                        {t("employees.managePerms")}
                      </button>
                      <MemberKebab
                        member={m}
                        onResetPassword={() => setResetTarget(m)}
                        onToggleStatus={() => handleToggleStatus(m)}
                        onRemove={() => setRemoveTarget(m)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

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
    </div>
  );
}
