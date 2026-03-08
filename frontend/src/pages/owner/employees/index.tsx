import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  UserCheck,
  UserX,
  Loader2,
  UserMinus,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { ListView } from "@/components/refine-ui/views/list-view";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { api } from "@/lib/api";
import type { UserAdmin } from "@/types";

function initials(name?: string, email?: string) {
  if (name) return name.slice(0, 2).toUpperCase();
  return (email ?? "?").slice(0, 2).toUpperCase();
}

const QUERY_KEY = ["owner", "employees"] as const;

export default function OwnerEmployeesPage() {
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<UserAdmin | null>(null);
  const [removeTarget, setRemoveTarget] = useState<UserAdmin | null>(null);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: api.owner.listEmployees,
  });

  const pending = employees.filter((e) => e.status === "pending");
  const active = employees.filter((e) => e.status === "active");

  const { mutate: approve, isPending: approving } = useMutation({
    mutationFn: (id: number) => api.owner.approveEmployee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Employé approuvé");
    },
    onError: (err) => toast.error(err.message),
  });

  const { mutate: reject, isPending: rejecting } = useMutation({
    mutationFn: (id: number) => api.owner.rejectEmployee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Demande refusée");
      setRejectTarget(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const { mutate: remove, isPending: removing } = useMutation({
    mutationFn: (id: number) => api.owner.removeEmployee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Employé retiré");
      setRemoveTarget(null);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <ListView>
      <Breadcrumb />

      <div>
        <h1 className="page-title">Mes employés</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gérez les demandes d'accès et les membres actifs de votre pharmacie.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
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
                          {emp.image_url && <AvatarImage src={emp.image_url} />}
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
                  <div className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-2.5 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <span>Employé</span>
                    <span className="w-28 text-center">Membre depuis</span>
                    <span className="w-24 text-center">Actions</span>
                  </div>
                  {active.map((emp) => (
                    <div key={emp.id} className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto] gap-3 sm:gap-4 px-5 py-3 items-start sm:items-center">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-8 w-8 shrink-0">
                          {emp.image_url && <AvatarImage src={emp.image_url} />}
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

                      <div className="flex items-center justify-center w-24">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setRemoveTarget(emp)}
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                          Retirer
                        </Button>
                      </div>
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
              onClick={() => rejectTarget && reject(rejectTarget.id)}
            >
              {rejecting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Refuser
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove dialog */}
      <AlertDialog open={!!removeTarget} onOpenChange={(v) => { if (!v) setRemoveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer "{removeTarget?.name ?? removeTarget?.email}" ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cet employé perdra l'accès à votre pharmacie. Vous pouvez le réinviter ultérieurement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removing}
              onClick={() => removeTarget && remove(removeTarget.id)}
            >
              {removing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ListView>
  );
}
