import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Phone,
  MapPin,
  Users,
  ShieldCheck,
  UserCog,
  UserCheck,
  UserX,
  ShieldOff,
  X,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { ListView } from "@/components/refine-ui/views/list-view";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { QUERY_KEYS } from "@/constants";
import type { Pharmacy, UserAdmin, UserRole } from "@/types";
import { eUserRole } from "@/types";

const FEATURES: { key: string; label: string }[] = [
  { key: "rapports", label: "Rapports" },
  { key: "import", label: "Import" },
  { key: "achat", label: "Achats" },
  { key: "ventes", label: "Ventes" },
  { key: "stock", label: "Stock" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<UserRole, { label: string; className: string; icon: React.ReactNode }> = {
  admin: {
    label: "Admin",
    className: "bg-primary/10 text-primary border-primary/20",
    icon: <ShieldCheck className="h-3 w-3" />,
  },
  owner: {
    label: "Propriétaire",
    className: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
    icon: <UserCheck className="h-3 w-3" />,
  },
  employee: {
    label: "Employé",
    className: "bg-muted text-muted-foreground border-border",
    icon: <UserCog className="h-3 w-3" />,
  },
};

function RoleBadge({ role }: { role: UserRole }) {
  const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.employee;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", cfg.className)}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function initials(name?: string, email?: string) {
  if (name) return name.slice(0, 2).toUpperCase();
  return (email ?? "?").slice(0, 2).toUpperCase();
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active:  { label: "Actif",    className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800" },
  pending: { label: "En attente", className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800" },
  rejected:{ label: "Refusé",   className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", cfg.className)}>
      {cfg.label}
    </span>
  );
}

// ── Pharmacy form dialog ───────────────────────────────────────────────────────

type PharmacyFormProps = {
  open: boolean;
  onClose: () => void;
  pharmacy?: Pharmacy | null;
};

function PharmacyFormDialog({ open, onClose, pharmacy }: PharmacyFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!pharmacy;

  const [name, setName] = useState(pharmacy?.name ?? "");
  const [address, setAddress] = useState(pharmacy?.address ?? "");
  const [phone, setPhone] = useState(pharmacy?.phone ?? "");
  const [email, setEmail] = useState(pharmacy?.email ?? "");

  useEffect(() => {
    if (open) {
      setName(pharmacy?.name ?? "");
      setAddress(pharmacy?.address ?? "");
      setPhone(pharmacy?.phone ?? "");
      setEmail(pharmacy?.email ?? "");
    }
  }, [open, pharmacy]);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      isEdit
        ? api.admin.updatePharmacy(pharmacy!.id, { name, address: address || undefined, phone: phone || undefined, email: email || undefined })
        : api.admin.createPharmacy({ name, address: address || undefined, phone: phone || undefined, email: email || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pharmacies });
      toast.success(isEdit ? "Pharmacie mise à jour" : "Pharmacie créée");
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !isPending) onClose(); }}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-4 px-6 pt-6 pb-5 border-b bg-primary/[0.03]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
            <Building2 className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="space-y-1 pt-0.5">
            <p className="text-base font-semibold leading-none">
              {isEdit ? "Modifier la pharmacie" : "Nouvelle pharmacie"}
            </p>
            <p className="text-sm text-muted-foreground">
              {isEdit ? "Mettez à jour les informations de la pharmacie." : "Ajoutez une nouvelle pharmacie à la plateforme."}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Nom <span className="text-destructive">*</span></Label>
              <Input
                id="p-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Pharmacie Al Amal"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-address">Adresse</Label>
              <Input
                id="p-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="12 Rue Mohammed V, Casablanca"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-phone">Téléphone</Label>
                <Input
                  id="p-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0522 000 000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-email">Email</Label>
                <Input
                  id="p-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@pharmacie.ma"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 pb-6 gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()} className="gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Users panel (slide-in within page) ───────────────────────────────────────

type UsersPanelProps = {
  pharmacy: Pharmacy;
  onClose: () => void;
  allPharmacies: Pharmacy[];
};

function UsersPanel({ pharmacy, onClose, allPharmacies }: UsersPanelProps) {
  const queryClient = useQueryClient();
  const panelQueryKey = [...QUERY_KEYS.adminUsers, pharmacy.id];

  const { data: users = [], isLoading } = useQuery({
    queryKey: panelQueryKey,
    queryFn: () => api.admin.listUsers(pharmacy.id),
  });

  const { mutate: updateRole } = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: UserRole }) =>
      api.admin.updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: panelQueryKey });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pharmacies });
      toast.success("Rôle mis à jour");
    },
    onError: (err) => toast.error(err.message),
  });

  const { mutate: updatePharmacy } = useMutation({
    mutationFn: ({ userId, pharmacyId }: { userId: number; pharmacyId: number | null }) =>
      api.admin.updateUserPharmacy(userId, pharmacyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: panelQueryKey });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pharmacies });
      toast.success("Pharmacie mise à jour");
    },
    onError: (err) => toast.error(err.message),
  });

  const { mutate: updatePermissions, isPending: updatingPerms } = useMutation({
    mutationFn: ({ userId, permissions }: { userId: number; permissions: Record<string, boolean> }) =>
      api.admin.updateUserPermissions(userId, permissions),
    onSuccess: (updated) => {
      queryClient.setQueryData<UserAdmin[]>(panelQueryKey, (prev) =>
        prev?.map((u) => (u.id === updated.id ? updated : u)) ?? []
      );
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Membres — {pharmacy.name}</span>
          <Badge variant="secondary" className="text-xs">{users.length}</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Users className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Aucun membre assigné à cette pharmacie.</p>
        </div>
      ) : (
        <div className="divide-y">
          {users.map((user: UserAdmin) => (
            <div key={user.id} className="px-5 py-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {initials(user.name, user.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{user.name ?? user.email}</p>
                  {user.name && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={user.role}
                    onValueChange={(role) => updateRole({ userId: user.id, role: role as UserRole })}
                  >
                    <SelectTrigger className="h-7 text-xs w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="owner">Propriétaire</SelectItem>
                      <SelectItem value="employee">Employé</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={user.pharmacy_id?.toString() ?? "none"}
                    onValueChange={(v) => updatePharmacy({ userId: user.id, pharmacyId: v === "none" ? null : Number(v) })}
                  >
                    <SelectTrigger className="h-7 text-xs w-36">
                      <SelectValue placeholder="Pharmacie…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Aucune —</SelectItem>
                      {allPharmacies.map((p) => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Owner feature restrictions */}
              {user.role === eUserRole.OWNER && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-11 pt-2">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide w-full">
                    Restrictions d'accès
                  </span>
                  {FEATURES.map(({ key, label }) => {
                    const allowed = user.permissions?.[key] !== false;
                    return (
                      <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
                        <Switch
                          checked={allowed}
                          disabled={updatingPerms}
                          onCheckedChange={(v) =>
                            updatePermissions({
                              userId: user.id,
                              permissions: { ...(user.permissions ?? {}), [key]: v },
                            })
                          }
                          className="scale-[0.8]"
                        />
                        <span className="text-xs text-muted-foreground">{label}</span>
                      </label>
                    );
                  })}
                  {updatingPerms && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PharmaciesAdminPage() {
  const queryClient = useQueryClient();

  const { data: pharmacies = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.pharmacies,
    queryFn: api.admin.listPharmacies,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Pharmacy | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Pharmacy | null>(null);
  const [usersTarget, setUsersTarget] = useState<Pharmacy | null>(null);

  const { mutate: deletePharmacy, isPending: deleting } = useMutation({
    mutationFn: (id: number) => api.admin.deletePharmacy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pharmacies });
      toast.success("Pharmacie supprimée");
      setDeleteTarget(null);
      if (usersTarget?.id === deleteTarget?.id) setUsersTarget(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const openCreate = () => { setEditTarget(null); setFormOpen(true); };
  const openEdit = (p: Pharmacy) => { setEditTarget(p); setFormOpen(true); };

  return (
    <ListView>
      <Breadcrumb />

      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Pharmacies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez les pharmacies et leurs membres.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Nouvelle pharmacie
        </Button>
      </div>

      {/* Pharmacies grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : pharmacies.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Aucune pharmacie</p>
            <p className="text-sm text-muted-foreground mt-1">Créez votre première pharmacie pour commencer.</p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Créer une pharmacie
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pharmacies.map((p) => (
            <Card
              key={p.id}
              className={cn(
                "transition-all cursor-pointer hover:shadow-md hover:border-primary/30",
                usersTarget?.id === p.id && "border-primary/50 shadow-md ring-1 ring-primary/20"
              )}
              onClick={() => setUsersTarget(usersTarget?.id === p.id ? null : p)}
            >
              <CardContent className="p-5">
                {/* Card header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Building2 className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{p.name}</p>
                      {p.created_at && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(p.created_at), "d MMM yyyy", { locale: fr })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(p)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <Separator className="my-3" />

                {/* Owner info */}
                <div className="space-y-1.5">
                  {p.address && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{p.address}</span>
                    </div>
                  )}
                  {(p.owners && p.owners.length > 0) ? (
                    <div className="space-y-1.5 pt-0.5">
                      {p.owners.map((owner) => (
                        <div key={owner.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[9px] font-bold mt-0.5">
                            {(owner.name ?? owner.email ?? "?").slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            {owner.name && <p className="font-medium text-foreground truncate">{owner.name}</p>}
                            <p className="truncate">{owner.email}</p>
                            {owner.phone && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Phone className="h-2.5 w-2.5 shrink-0" />
                                <span>{owner.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/50 italic">Aucun propriétaire</p>
                  )}
                </div>

                {/* Footer */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>{p.user_count} membre{p.user_count !== 1 ? "s" : ""}</span>
                  </div>
                  <span className={cn(
                    "text-xs font-medium transition-colors",
                    usersTarget?.id === p.id ? "text-primary" : "text-muted-foreground"
                  )}>
                    {usersTarget?.id === p.id ? "Fermer ↑" : "Voir membres →"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Users panel */}
      {usersTarget && (
        <UsersPanel
          pharmacy={usersTarget}
          onClose={() => setUsersTarget(null)}
          allPharmacies={pharmacies}
        />
      )}

      {/* Pending owners section */}
      <PendingOwnersSection />

      {/* All users section */}
      <AllUsersSection pharmacies={pharmacies} />

      {/* Dialogs */}
      <PharmacyFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        pharmacy={editTarget}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer "{deleteTarget?.name}" ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette pharmacie sera supprimée définitivement. Les membres resteront mais seront désassociés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={() => deleteTarget && deletePharmacy(deleteTarget.id)}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ListView>
  );
}

// ── Pending owners section ────────────────────────────────────────────────────

function PendingOwnersSection() {
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<UserAdmin | null>(null);

  const { data: pendingOwners = [], isLoading } = useQuery({
    queryKey: ["pendingOwners"],
    queryFn: api.admin.listPendingOwners,
  });

  const { mutate: approve, isPending: approving } = useMutation({
    mutationFn: (userId: number) => api.admin.approveUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingOwners"] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pharmacies });
      toast.success("Propriétaire approuvé — pharmacie créée");
    },
    onError: (err) => toast.error(err.message),
  });

  const { mutate: reject, isPending: rejecting } = useMutation({
    mutationFn: (userId: number) => api.admin.rejectUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingOwners"] });
      toast.success("Demande refusée");
      setRejectTarget(null);
    },
    onError: (err) => toast.error(err.message),
  });

  if (!isLoading && pendingOwners.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-amber-500" />
        <h2 className="text-base font-semibold">Demandes d'accès propriétaires</h2>
        {!isLoading && <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">{pendingOwners.length}</Badge>}
      </div>

      <div className="border rounded-xl overflow-hidden bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="divide-y">
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2.5 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span>Demandeur</span>
              <span className="w-40">Pharmacie demandée</span>
              <span className="w-28 text-center">Date</span>
              <span className="w-36 text-center">Actions</span>
            </div>
            {pendingOwners.map((user: UserAdmin) => (
              <div key={user.id} className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto_auto] gap-3 sm:gap-4 px-5 py-3 items-start sm:items-center">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {initials(user.name, user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{user.name ?? user.email}</p>
                    {user.name && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
                  </div>
                </div>

                <span className="text-sm text-muted-foreground w-40 truncate">
                  {user.pharmacy_name ?? <span className="italic text-muted-foreground/50">Non renseigné</span>}
                </span>

                <span className="text-xs text-muted-foreground w-28 text-center">
                  {user.created_at ? format(new Date(user.created_at), "d MMM yyyy", { locale: fr }) : "—"}
                </span>

                <div className="flex items-center gap-2 w-36 justify-center">
                  <Button
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    disabled={approving}
                    onClick={() => approve(user.id)}
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    Approuver
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={rejecting}
                    onClick={() => setRejectTarget(user)}
                  >
                    <UserX className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!rejectTarget} onOpenChange={(v) => { if (!v) setRejectTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refuser la demande de "{rejectTarget?.name ?? rejectTarget?.email}" ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'utilisateur ne pourra pas accéder au tableau de bord. Cette action peut être annulée manuellement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rejecting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={rejecting}
              onClick={() => rejectTarget && reject(rejectTarget.id)}
            >
              {rejecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Refuser
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── All users section ─────────────────────────────────────────────────────────

function AllUsersSection({ pharmacies }: { pharmacies: Pharmacy[] }) {
  const queryClient = useQueryClient();
  const [revokeTarget, setRevokeTarget] = useState<UserAdmin | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.adminUsers,
    queryFn: () => api.admin.listUsers(),
  });

  const { mutate: updateRole } = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: UserRole }) =>
      api.admin.updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminUsers });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pharmacies });
      toast.success("Rôle mis à jour");
    },
    onError: (err) => toast.error(err.message),
  });

  const { mutate: updatePharmacy } = useMutation({
    mutationFn: ({ userId, pharmacyId }: { userId: number; pharmacyId: number | null }) =>
      api.admin.updateUserPharmacy(userId, pharmacyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminUsers });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pharmacies });
      toast.success("Pharmacie mise à jour");
    },
    onError: (err) => toast.error(err.message),
  });

  const { mutate: revoke, isPending: revoking } = useMutation({
    mutationFn: (userId: number) => api.admin.revokeUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminUsers });
      queryClient.invalidateQueries({ queryKey: ["pendingOwners"] });
      toast.success("Accès retiré — compte repassé en attente");
      setRevokeTarget(null);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-base font-semibold">Tous les utilisateurs</h2>
        {!isLoading && <Badge variant="secondary">{users.length}</Badge>}
      </div>

      <div className="border rounded-xl overflow-hidden bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Aucun utilisateur.</p>
          </div>
        ) : (
          <div className="divide-y">
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-2.5 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span>Utilisateur</span>
              <span className="w-24 text-center">Statut</span>
              <span className="w-32 text-center">Rôle</span>
              <span className="w-36 text-center">Pharmacie</span>
              <span className="w-8" />
            </div>
            {users.map((user: UserAdmin) => (
              <div key={user.id} className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto_auto_auto] gap-3 sm:gap-4 px-5 py-3 items-start sm:items-center">
                {/* User info */}
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {initials(user.name, user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{user.name ?? user.email}</p>
                    {user.name && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
                  </div>
                </div>

                {/* Status */}
                <div className="w-24 flex justify-center">
                  <StatusBadge status={user.status} />
                </div>

                {/* Role */}
                <Select
                  value={user.role}
                  onValueChange={(role) => updateRole({ userId: user.id, role: role as UserRole })}
                >
                  <SelectTrigger className="h-7 text-xs w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="owner">Propriétaire</SelectItem>
                    <SelectItem value="employee">Employé</SelectItem>
                  </SelectContent>
                </Select>

                {/* Pharmacy */}
                <Select
                  value={user.pharmacy_id?.toString() ?? "none"}
                  onValueChange={(v) => updatePharmacy({ userId: user.id, pharmacyId: v === "none" ? null : Number(v) })}
                >
                  <SelectTrigger className="h-7 text-xs w-36">
                    <SelectValue placeholder="— Aucune —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Aucune —</SelectItem>
                    {pharmacies.map((p) => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Revoke access — only for active non-admin users */}
                <div className="w-8 flex justify-center">
                  {user.status === "active" && user.role !== eUserRole.ADMIN && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      title="Retirer l'accès"
                      onClick={() => setRevokeTarget(user)}
                    >
                      <ShieldOff className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revoke confirmation */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(v) => { if (!v) setRevokeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Retirer l'accès à "{revokeTarget?.name ?? revokeTarget?.email}" ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Le compte repassera en attente. L'utilisateur ne pourra plus accéder au tableau de bord jusqu'à une nouvelle approbation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={revoking}
              onClick={() => revokeTarget && revoke(revokeTarget.id)}
            >
              {revoking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Retirer l'accès
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
