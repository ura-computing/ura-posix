import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  Loader2,
  UserCheck,
  UserX,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

import { ListView } from "@/components/refine-ui/views/list-view";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { CatalogRequestOut } from "@/lib/api";

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const QUERY_KEY = ["admin", "catalog-requests"] as const;

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "pending", label: "En attente" },
  { key: "approved", label: "Approuvés" },
  { key: "rejected", label: "Rejetés" },
];

function StatusBadge({ status }: { status: CatalogRequestOut["status"] }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
        <Clock className="h-3 w-3" />
        En attente
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        Approuvé
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
      <XCircle className="h-3 w-3" />
      Refusé
    </span>
  );
}

export default function AdminCatalogRequestsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [rejectTarget, setRejectTarget] = useState<CatalogRequestOut | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: [...QUERY_KEY, statusFilter],
    queryFn: () => api.admin.listCatalogRequests(statusFilter === "all" ? undefined : statusFilter),
  });

  const { mutate: approve, isPending: approving } = useMutation({
    mutationFn: (id: number) => api.admin.approveCatalogRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Médicament ajouté au catalogue");
    },
    onError: (err) => toast.error(err.message),
  });

  const { mutate: reject, isPending: rejecting } = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      api.admin.rejectCatalogRequest(id, reason || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Demande rejetée");
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: (err) => toast.error(err.message),
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <ListView>
      <Breadcrumb />

      <div>
        <h1 className="page-title">Demandes catalogue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Examinez les demandes d'ajout de médicaments soumises par les pharmacies.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border rounded-xl p-1 bg-muted/30 w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-lg font-medium transition-colors",
              statusFilter === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.key === "pending" && pendingCount > 0 && statusFilter !== "pending" && (
              <Badge variant="secondary" className="ml-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-xs px-1.5 py-0">
                {pendingCount}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Requests list */}
      <div className="border rounded-xl overflow-hidden bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <ClipboardCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Aucune demande</p>
              <p className="text-xs text-muted-foreground mt-1">
                {statusFilter === "all"
                  ? "Aucune demande de catalogue pour l'instant."
                  : `Aucune demande avec le statut "${STATUS_TABS.find(t => t.key === statusFilter)?.label}".`}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-2.5 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span>Produit</span>
              <span className="w-36">Pharmacie / Demandeur</span>
              <span className="w-24 text-center">Statut</span>
              <span className="w-28 text-center">Date</span>
              <span className="w-36 text-center">Actions</span>
            </div>
            {requests.map((req) => (
              <div key={req.id} className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto_auto_auto] gap-3 sm:gap-4 px-5 py-3.5 items-start sm:items-center">
                {/* Product info */}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{req.product}</p>
                  <div className="flex flex-wrap gap-2 mt-0.5">
                    {req.pph != null && <span className="text-xs text-muted-foreground">PPH: {req.pph.toFixed(2)} DH</span>}
                    {req.ppv != null && <span className="text-xs text-muted-foreground">PPV: {req.ppv.toFixed(2)} DH</span>}
                    {req.category && <span className="text-xs text-muted-foreground">{req.category}</span>}
                    {req.laboratoire && <span className="text-xs text-muted-foreground">{req.laboratoire}</span>}
                  </div>
                  {req.reject_reason && (
                    <p className="text-xs text-destructive mt-0.5">Motif : {req.reject_reason}</p>
                  )}
                </div>

                {/* Pharmacy / requester */}
                <div className="w-36 min-w-0">
                  <p className="text-sm truncate">{req.pharmacy_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{req.requester_name ?? req.requester_email ?? "—"}</p>
                </div>

                {/* Status */}
                <div className="w-24 flex justify-center">
                  <StatusBadge status={req.status} />
                </div>

                {/* Date */}
                <span className="text-xs text-muted-foreground w-28 text-center">
                  {req.created_at ? format(new Date(req.created_at), "d MMM yyyy", { locale: fr }) : "—"}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-2 w-36 justify-center">
                  {req.status === "pending" ? (
                    <>
                      <Button
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        disabled={approving}
                        onClick={() => approve(req.id)}
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        Approuver
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => { setRejectTarget(req); setRejectReason(""); }}
                      >
                        <UserX className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {req.reviewed_at ? format(new Date(req.reviewed_at), "d MMM", { locale: fr }) : "—"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject dialog */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(v) => { if (!v) setRejectTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeter "{rejectTarget?.product}" ?</AlertDialogTitle>
            <AlertDialogDescription>
              Ce médicament ne sera pas ajouté au catalogue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2 space-y-1.5">
            <Label htmlFor="reject-reason">Motif (optionnel)</Label>
            <Input
              id="reject-reason"
              placeholder="Ex. : produit déjà existant sous un autre nom"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rejecting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={rejecting}
              onClick={() => rejectTarget && reject({ id: rejectTarget.id, reason: rejectReason })}
            >
              {rejecting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Rejeter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ListView>
  );
}
