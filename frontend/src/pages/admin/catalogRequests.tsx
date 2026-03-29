import { useState } from "react";
import {
  useAdminCatalogRequestsList,
  useApproveCatalogRequest,
  useRejectCatalogRequest,
} from "@/hooks/useAdminCatalogRequests";
import {
  ClipboardCheck,
  Loader2,
  UserCheck,
  UserX,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/utils/cn";
import { RequestStatusBadge } from "@/components/shared/statusBadge";

import { PageLoader } from "@/components/shared/pageLoader";
import { ListView } from "@/components/refine-ui/views/listView";
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
import type { CatalogRequestOut } from "@/api/admin";

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "pending", label: "En attente" },
  { key: "approved", label: "Approuvés" },
  { key: "rejected", label: "Rejetés" },
];


export default function AdminCatalogRequestsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [rejectTarget, setRejectTarget] = useState<CatalogRequestOut | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { requests, requestsLoading: isLoading } = useAdminCatalogRequestsList(statusFilter);
  const { approve, approving } = useApproveCatalogRequest();
  const { reject, rejecting } = useRejectCatalogRequest();

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <ListView>
      <Breadcrumb />

      <div>
        <h1 className="page-title">Demandes d'exclusion</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Examinez les demandes d'exclusion de produits soumises par les pharmacies.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        {/* Status filter */}
        <div className="flex items-center gap-1 border rounded-xl p-1 bg-muted/30">
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

      </div>

      {/* Requests list */}
      <div className="border rounded-xl overflow-hidden bg-card">
        {isLoading ? (
          <PageLoader />
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <ClipboardCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Aucune demande</p>
              <p className="text-xs text-muted-foreground mt-1">
                {statusFilter === "all"
                  ? "Aucune demande pour l'instant."
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
                  <p className="text-sm font-medium truncate">
                    {req.medicament_name ?? req.product}
                  </p>
                  {req.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5">Note : {req.notes}</p>
                  )}
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
                  <RequestStatusBadge status={req.status} />
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
            <AlertDialogTitle>
              Rejeter "{rejectTarget?.medicament_name ?? rejectTarget?.product}" ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Le produit restera déclaré dans les rapports de cette pharmacie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2 space-y-1.5">
            <Label htmlFor="reject-reason">Motif (optionnel)</Label>
            <Input
              id="reject-reason"
              placeholder="Ex. : ce produit doit rester déclaré"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rejecting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={rejecting}
              onClick={() => rejectTarget && reject({ id: rejectTarget.id, reason: rejectReason }, { onSuccess: () => { setRejectTarget(null); setRejectReason(""); } })}
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
