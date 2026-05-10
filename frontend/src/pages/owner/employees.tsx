import { useState } from "react";
import { useMe } from "@/hooks/useMe";
import { useOwnerEmployees, useEmployeePermissions, useInviteEmployee } from "@/hooks/useOwnerEmployees";
import {
  Users,
  UserCheck,
  UserX,
  Loader2,
  Mail,
  ShieldOff,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { PageLoader } from "@/components/shared/pageLoader";
import { ListView } from "@/components/shared/listView";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UserAdmin } from "@/types";
import { eUserRole, eUserStatus } from "@/types";
import { FEATURES } from "@/constants";

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name?: string, email?: string) {
  if (name) return name.slice(0, 2).toUpperCase();
  return (email ?? "?").slice(0, 2).toUpperCase();
}

function isFeatureAllowed(permissions: Record<string, boolean> | undefined, key: string): boolean {
  return permissions?.[key] !== false;
}

// ── Permission toggles row ────────────────────────────────────────────────────

function PermissionToggles({
  employee,
  ownerPermissions,
}: {
  employee: UserAdmin;
  ownerPermissions: Record<string, boolean> | undefined;
}) {
  const { updatePermissions, permissionsPending: isPending } = useEmployeePermissions();

  function handleToggle(key: string, checked: boolean) {
    const current = employee.permissions ?? {};
    updatePermissions({
      id: employee.id,
      permissions: { ...current, [key]: checked },
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-11 pt-1 pb-2">
      {FEATURES.map(({ key, label }) => {
        const ownerHas = isFeatureAllowed(ownerPermissions, key);
        const empHas = isFeatureAllowed(employee.permissions, key);
        return (
          <label
            key={key}
            className={`flex items-center gap-1.5 cursor-pointer select-none ${!ownerHas ? "opacity-40" : ""}`}
          >
            <Switch
              checked={empHas}
              disabled={isPending || !ownerHas}
              onCheckedChange={(v) => handleToggle(key, v)}
              className="scale-[0.8]"
            />
            <span className="text-xs text-muted-foreground">{label}</span>
          </label>
        );
      })}
      {isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OwnerEmployeesPage() {
  const { me: identity } = useMe();
  const [rejectTarget, setRejectTarget] = useState<UserAdmin | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<UserAdmin | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const isEmployee = identity?.role !== eUserRole.OWNER;

  const {
    employees,
    isLoading,
    approve,
    approving,
    reject,
    rejecting,
    revoke,
    revoking,
  } = useOwnerEmployees(!isEmployee);

  const pending = employees.filter((e) => e.status === eUserStatus.PENDING);
  const active = employees.filter((e) => e.status === eUserStatus.ACTIVE);

  if (isEmployee) return null;

  return (
    <ListView>
      <Breadcrumb />

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Mes employés</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez les demandes d'accès et les permissions des membres de votre pharmacie.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="gap-2 shrink-0">
          <Mail className="h-4 w-4" />
          Inviter un employé
        </Button>
      </div>

      <InviteEmployeeDialog open={inviteOpen} onOpenChange={setInviteOpen} />

      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="space-y-8">
          {/* Pending section */}
          {pending.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-amber-500" />
                <h2 className="text-base font-semibold">En attente d'approbation</h2>
                <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                  {pending.length}
                </Badge>
              </div>

              <div className="border rounded-xl overflow-hidden bg-card">
                <div className="divide-y">
                  <div className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-2.5 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <span>Employé</span>
                    <span className="w-28 text-center">Demande le</span>
                    <span className="w-36 text-center">Actions</span>
                  </div>
                  {pending.map((emp) => (
                    <div key={emp.id} className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto] gap-3 sm:gap-4 px-5 py-3 items-start sm:items-center">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {initials(emp.name, emp.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{emp.name ?? emp.email}</p>
                          {emp.name && <p className="text-xs text-muted-foreground truncate">{emp.email}</p>}
                        </div>
                      </div>

                      <span className="text-xs text-muted-foreground w-28 text-center">
                        {emp.created_at ? format(new Date(emp.created_at), "d MMM yyyy", { locale: fr }) : "—"}
                      </span>

                      <div className="flex items-center gap-2 w-36 justify-center">
                        <Button
                          size="sm"
                          className="h-7 gap-1.5 text-xs"
                          disabled={approving}
                          onClick={() => approve(emp.id)}
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          Approuver
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={rejecting}
                          onClick={() => setRejectTarget(emp)}
                        >
                          <UserX className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Active section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">Membres actifs</h2>
              <Badge variant="secondary">{active.length}</Badge>
            </div>

            <div className="border rounded-xl overflow-hidden bg-card">
              {active.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-14 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Aucun membre actif</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Les employés approuvés apparaîtront ici.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y">
                  {active.map((emp) => (
                    <div key={emp.id} className="px-5 py-3">
                      {/* Employee info row */}
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {initials(emp.name, emp.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{emp.name ?? emp.email}</p>
                          {emp.name && <p className="text-xs text-muted-foreground truncate">{emp.email}</p>}
                        </div>
                        <span className="hidden sm:block text-xs text-muted-foreground shrink-0">
                          {emp.created_at ? format(new Date(emp.created_at), "d MMM yyyy", { locale: fr }) : "—"}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                          onClick={() => setRevokeTarget(emp)}
                        >
                          <ShieldOff className="h-3.5 w-3.5" />
                          Révoquer
                        </Button>
                      </div>

                      {/* Permission toggles row */}
                      <PermissionToggles
                        employee={emp}
                        ownerPermissions={identity?.permissions}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject dialog */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(v) => { if (!v) setRejectTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refuser la demande de "{rejectTarget?.name ?? rejectTarget?.email}" ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cet employé ne pourra pas accéder au tableau de bord de votre pharmacie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rejecting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={rejecting}
              onClick={() => rejectTarget && reject(rejectTarget.id, { onSuccess: () => setRejectTarget(null) })}
            >
              {rejecting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Refuser
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke dialog */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(v) => { if (!v) setRevokeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer l'accès de "{revokeTarget?.name ?? revokeTarget?.email}" ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'employé passera en statut "en attente" et perdra l'accès au tableau de bord. Vous pourrez le réapprouver à tout moment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={revoking}
              onClick={() => revokeTarget && revoke(revokeTarget.id, { onSuccess: () => setRevokeTarget(null) })}
            >
              {revoking && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Révoquer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ListView>
  );
}

// ── Invite dialog ───────────────────────────────────────────────────────────

function InviteEmployeeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const { invite, inviting } = useInviteEmployee(() => {
    onOpenChange(false);
    setEmail("");
    setName("");
    setPhone("");
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    invite({
      email: email.trim(),
      name: name.trim() || undefined,
      phone: phone.trim() || undefined,
    });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Inviter un employé</DialogTitle>
          <DialogDescription>
            Saisissez l'email de l'employé. Il recevra un lien pour définir son mot de passe (valide 7 jours).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email" className="text-xs">Email *</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="employe@pharmacie.ma"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-name" className="text-xs">
              Nom <span className="text-muted-foreground font-normal">(optionnel)</span>
            </Label>
            <Input
              id="invite-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Karim El Amrani"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-phone" className="text-xs">
              Téléphone <span className="text-muted-foreground font-normal">(optionnel)</span>
            </Label>
            <Input
              id="invite-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06xx xx xx xx"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={inviting}>
              Annuler
            </Button>
            <Button type="submit" disabled={inviting || !email.trim()}>
              {inviting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Envoyer l'invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
