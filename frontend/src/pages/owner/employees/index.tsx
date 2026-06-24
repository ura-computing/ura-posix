/** Gérer mon équipe — owner's employee management page.
 *
 *  Section A: read-only summary of the 9 features with their availability
 *    state (active / pharmacy-blocked / owner-blocked). Helps the owner
 *    understand the 2-layer ceiling before opening any dialog.
 *  Section B: employees table + actions (Inviter / Gérer les permissions /
 *    Réinitialiser / Désactiver / Supprimer).
 *
 *  Reuses admin's CreateUserDialog (role locked to "employee" via the
 *  roleLocked prop) and UserPermissionsDialog (generalized to N ceiling
 *  layers — we pass [Pharmacie, Vous]). */
import { useState } from "react";
import { MoreVertical, RefreshCw, SlidersHorizontal, Trash2, UserPlus, Users } from "lucide-react";

import { AsyncButton } from "@/components/shared/AsyncButton";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { CreateUserDialog } from "@/pages/admin/pharmacies/_components/CreateUserDialog";
import { UserPermissionsDialog } from "@/pages/admin/pharmacies/_components/UserPermissionsDialog";
import { FEATURES, ROLE_LABEL, STATUS_LABEL, type FeatureKey } from "@/pages/admin/pharmacies/_components/constants";
import { FeaturePills } from "@/pages/admin/pharmacies/_components/FeaturePills";
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
} from "./_hooks/useOwnerEmployees";


const PILL_BASE = "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold";
const FEATURE_KEYS = ["rapports", "import", "achats", "ventes", "stock", "analyse", "accounting", "bl_exclusions", "special_products"] as const;


export default function OwnerEmployeesPage() {
  const { me } = useMe();

  const [createOpen,     setCreateOpen]     = useState(false);
  const [permDialogUser, setPermDialogUser] = useState<MemberOut | null>(null);
  const [removeTarget,   setRemoveTarget]   = useState<MemberOut | null>(null);

  const q = useOwnerEmployees();
  const createMut   = useCreateEmployee();
  const permsMut    = useSetEmployeePermissions();
  const statusMut   = useSetEmployeeStatus();
  const resetPwdMut = useResetEmployeePassword();
  const removeMut   = useDeleteEmployee();

  if (q.isLoading || !q.data) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 py-10 text-center text-sm text-muted-foreground">
        Chargement…
      </div>
    );
  }

  const { employees, pharmacy_features, my_permissions } = q.data;
  const pharmFeats = toRecord(pharmacy_features);
  const myPerms    = toRecord(my_permissions);

  const handleCreate = async (v: CreateUserIn): Promise<CreateUserOut> =>
    createMut.mutateAsync(v);

  const handleSavePerms = async (next: Record<FeatureKey, boolean>) => {
    if (!permDialogUser) return;
    await permsMut.mutateAsync({ employeeId: permDialogUser.id, permissions: next });
    setPermDialogUser(null);
  };

  const handleResetPassword = async (employeeId: number) => {
    const result = await resetPwdMut.mutateAsync(employeeId);
    window.alert(
      `Nouveau mot de passe : ${result.temp_password}\n\n` +
      "Transmettez-le à l'employé ; il devra le changer à la première connexion.",
    );
  };

  const handleToggleStatus = async (employee: MemberOut) => {
    const nextStatus = employee.status === "active" ? "inactive" : "active";
    await statusMut.mutateAsync({ employeeId: employee.id, status: nextStatus });
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    await removeMut.mutateAsync(removeTarget.id);
    setRemoveTarget(null);
  };

  const pharmacyName = me?.pharmacy?.name ?? "votre pharmacie";

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Gérer mon équipe</h1>
        <p className="text-sm text-muted-foreground">
          Créez des comptes employés et choisissez les fonctionnalités qu'ils peuvent utiliser.
        </p>
      </header>

      {/* Section A — pharmacy features summary (read-only) */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Fonctionnalités de votre pharmacie</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Vous ne pouvez accorder à vos employés que les fonctionnalités que la pharmacie et vous-même avez activées.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2.5 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const phEnabled    = pharmFeats[f.key];
            const ownerEnabled = myPerms[f.key];
            const fullyOk      = phEnabled && ownerEnabled;
            const Icon         = f.icon;

            // Three visual states: active (you can grant), locked-by-you (pharmacy ok, you don't have it),
            // locked-by-pharmacy (admin hasn't enabled it for this pharmacy).
            const stateTone  = !phEnabled ? "muted" : !ownerEnabled ? "warning" : "ok";
            const stateLabel = !phEnabled ? "Désactivée pour la pharmacie"
                              : !ownerEnabled ? "Non accordée à vous"
                              : "Disponible";

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
                    fullyOk         ? "bg-primary/15 text-primary"
                    : phEnabled     ? "bg-warning-subtle text-warning"
                    :                 "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold text-foreground">{f.label}</span>
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
            <h2 className="text-base font-semibold text-foreground">Employés</h2>
            <p className="text-sm text-muted-foreground">Comptes employés rattachés à votre pharmacie.</p>
          </div>
          <AsyncButton variant="primary" onClick={() => setCreateOpen(true)}>
            <UserPlus className="size-4" />
            Inviter un employé
          </AsyncButton>
        </div>

        {employees.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-11 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Users className="size-5" />
            </span>
            <p className="max-w-sm text-sm text-muted-foreground">
              Aucun employé. Cliquez sur « Inviter un employé » pour créer un compte.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-subtle text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5">Nom</th>
                <th className="px-3 py-2.5">Rôle</th>
                <th className="px-3 py-2.5">Statut</th>
                <th className="px-3 py-2.5">Permissions accordées</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((m) => (
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
                    <span className={cn(PILL_BASE, "bg-muted text-muted-foreground")}>{ROLE_LABEL[m.role]}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn(PILL_BASE, m.status === "active" ? "bg-success-subtle text-success" : "bg-muted text-muted-foreground")}>
                      {STATUS_LABEL[m.status]}
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
                        Gérer les permissions
                      </button>
                      <EmployeeKebab
                        employee={m}
                        onResetPassword={() => handleResetPassword(m.id)}
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

      <UserPermissionsDialog
        open={permDialogUser !== null}
        onClose={() => setPermDialogUser(null)}
        user={permDialogUser}
        contextStrip={
          <>
            Une permission n'est effective que si la pharmacie ET vous-même l'avez activée pour vous.
          </>
        }
        ceilings={[
          { label: "Pharmacie", values: pharmFeats },
          { label: "Vous",      values: myPerms    },
        ]}
        serverPermissions={memberPermsToRecord(permDialogUser)}
        isSaving={permsMut.isPending}
        onSave={handleSavePerms}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        title={`Supprimer définitivement ${removeTarget?.full_name ?? removeTarget?.email ?? "cet employé"} ?`}
        description={`Cette action est irréversible. Le compte sera retiré de ${pharmacyName} et perdra immédiatement l'accès.`}
        onConfirm={handleConfirmRemove}
      />
    </div>
  );
}


// ─── Helpers ────────────────────────────────────────────────────────────────

function toRecord(keys: string[]): Record<FeatureKey, boolean> {
  const set = new Set(keys);
  const out = {} as Record<FeatureKey, boolean>;
  for (const k of FEATURE_KEYS) out[k] = set.has(k);
  return out;
}

function memberPermsToRecord(m: MemberOut | null): Record<FeatureKey, boolean> {
  return toRecord(m?.granted_permissions ?? []);
}


function EmployeeKebab({
  employee, onResetPassword, onToggleStatus, onRemove,
}: {
  employee:        MemberOut;
  onResetPassword: () => void;
  onToggleStatus:  () => void;
  onRemove:        () => void;
}) {
  const [open, setOpen] = useState(false);
  const toggleLabel = employee.status === "active" ? "Désactiver" : "Réactiver";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Plus d'actions"
        className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-surface-subtle hover:text-foreground"
      >
        <MoreVertical className="size-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-md border border-border bg-card p-1 shadow-lg">
            <button
              type="button"
              onClick={() => { onResetPassword(); setOpen(false); }}
              className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-surface-subtle"
            >
              <RefreshCw className="size-3.5" />
              Réinitialiser le mot de passe
            </button>
            <button
              type="button"
              onClick={() => { onToggleStatus(); setOpen(false); }}
              className="block w-full cursor-pointer rounded-sm px-2 py-1.5 text-left text-sm hover:bg-surface-subtle"
            >
              {toggleLabel}
            </button>
            <button
              type="button"
              onClick={() => { onRemove(); setOpen(false); }}
              className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/5"
            >
              <Trash2 className="size-3.5" />
              Supprimer
            </button>
          </div>
        </>
      )}
    </div>
  );
}

