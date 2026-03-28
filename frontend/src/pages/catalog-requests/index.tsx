import { useState, useCallback, useRef } from "react";
import { useGetIdentity } from "@refinedev/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PackageX,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  FileX,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { CatalogRequestOut } from "@/lib/api";
import type { User } from "@/types";
import { eUserRole } from "@/types";

const REQUESTS_KEY = ["catalog-requests", "owner"] as const;
const PRODUCTS_KEY = ["my-products"] as const;

function StatusBadge({ status }: { status: CatalogRequestOut["status"] }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        <Clock className="h-3 w-3" />
        En attente
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Approuvé
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
      <XCircle className="h-3 w-3" />
      Refusé
    </span>
  );
}

export default function CatalogRequestsPage() {
  const { data: identity } = useGetIdentity<User>();
  const queryClient = useQueryClient();

  const isOwner = identity?.role === eUserRole.OWNER;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedIds(new Set());
    setNotes("");
    setSearchQuery("");
    setDebouncedSearch("");
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  const toggleProduct = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Existing non-declare requests
  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: REQUESTS_KEY,
    queryFn: () => api.catalogRequests.list(),
    enabled: isOwner,
    select: (data) => data.filter((r) => r.request_type === "non_declare"),
  });

  // Pharmacy products search
  const hasSearch = debouncedSearch.trim().length > 0;
  const { data: products = [], isFetching: productsLoading } = useQuery({
    queryKey: [...PRODUCTS_KEY, debouncedSearch],
    queryFn: () => api.catalogRequests.myProducts(debouncedSearch),
    enabled: dialogOpen && hasSearch,
    // Hide already-excluded products; keep declared ones (pending or selectable)
    select: (data) => data.filter((p) => p.declared),
  });

  const { mutate: submitRequests, isPending: submitting } = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      await Promise.all(
        ids.map((id) =>
          api.catalogRequests.submitNonDeclare({
            medicament_id: id,
            notes: notes.trim() || undefined,
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REQUESTS_KEY });
      const count = selectedIds.size;
      toast.success(
        count === 1
          ? "Demande envoyée à l'administrateur"
          : `${count} demandes envoyées à l'administrateur`
      );
      resetDialog();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!isOwner) return null;

  // Product IDs that already have a pending request
  const pendingMedIds = new Set(
    requests
      .filter((r) => r.status === "pending" && r.medicament_id)
      .map((r) => r.medicament_id!)
  );

  return (
    <ListView>
      <Breadcrumb />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Produits non déclarés</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Demandez à l'administrateur d'exclure un produit de vos rapports.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 shrink-0">
          <PackageX className="h-4 w-4" />
          Nouvelle demande
        </Button>
      </div>

      {/* Requests list */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-semibold">Mes demandes</h2>
          {!requestsLoading && <Badge variant="secondary">{requests.length}</Badge>}
        </div>

        <div className="border rounded-xl overflow-hidden bg-card">
          {requestsLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <FileX className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Aucune demande</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Cliquez sur "Nouvelle demande" pour exclure un produit de vos rapports.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2.5 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <span>Produit</span>
                <span className="w-24 text-center">Statut</span>
                <span className="w-28 text-center">Date</span>
                <span className="w-36 text-right">Traité le</span>
              </div>
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto_auto] gap-2 sm:gap-4 px-5 py-3 items-start sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {req.medicament_name ?? req.product}
                    </p>
                    {req.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        Note : {req.notes}
                      </p>
                    )}
                    {req.reject_reason && (
                      <p className="text-xs text-destructive mt-0.5 truncate">
                        Motif de refus : {req.reject_reason}
                      </p>
                    )}
                  </div>
                  <div className="w-24 flex justify-center">
                    <StatusBadge status={req.status} />
                  </div>
                  <span className="text-xs text-muted-foreground w-28 text-center">
                    {req.created_at
                      ? format(new Date(req.created_at), "d MMM yyyy", { locale: fr })
                      : "—"}
                  </span>
                  <span className="text-xs text-muted-foreground w-36 text-right">
                    {req.reviewed_at
                      ? format(new Date(req.reviewed_at), "d MMM yyyy", { locale: fr })
                      : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Product search dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) resetDialog(); }}>
        <DialogContent className="max-w-[50vw] p-0 gap-0 flex flex-col max-h-[90vh] overflow-hidden">
          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle>Demander l'exclusion de produits</DialogTitle>
            <DialogDescription>
              Sélectionnez un ou plusieurs produits à exclure de vos rapports.
            </DialogDescription>
          </DialogHeader>

          {/* Body */}
          <div className="flex-1 min-h-0 flex flex-col gap-4 px-6 py-4 overflow-hidden">
            {/* Search */}
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un produit..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                autoFocus
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>

            {/* Product list */}
            <div className="flex-1 min-h-0 border rounded-lg overflow-y-auto">
              {!hasSearch ? (
                <div className="py-10 text-center">
                  <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Tapez pour rechercher un produit</p>
                </div>
              ) : productsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : products.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Aucun produit pour &ldquo;{debouncedSearch}&rdquo;
                </div>
              ) : (
                <div className="divide-y">
                  {products.map((p) => {
                    const isPending = pendingMedIds.has(p.medicament_id);
                    const isSelected = selectedIds.has(p.medicament_id);
                    const cleanCategory = p.category?.replace(/\s*\(\d+\.?\d*%\)/, "").trim();
                    return (
                      <button
                        key={p.medicament_id}
                        type="button"
                        disabled={isPending}
                        onClick={() => !isPending && toggleProduct(p.medicament_id)}
                        className={cn(
                          "w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors",
                          isSelected
                            ? "bg-primary/10"
                            : "hover:bg-muted/50",
                          isPending && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {/* Checkbox */}
                        <div className={cn(
                          "h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors",
                          isSelected
                            ? "bg-primary border-primary"
                            : "border-input bg-background"
                        )}>
                          {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className={cn("text-sm font-medium truncate", isSelected && "text-primary")}>
                            {p.product}
                          </p>
                          {cleanCategory && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{cleanCategory}</p>
                          )}
                        </div>

                        {isPending && (
                          <span className="shrink-0 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                            En attente
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Notes — visible when at least one product is selected */}
            {selectedIds.size > 0 && (
              <div className="shrink-0 space-y-1.5">
                <Label htmlFor="nd-notes" className="text-xs">
                  Note pour l&apos;administrateur{" "}
                  <span className="text-muted-foreground font-normal">(optionnelle)</span>
                </Label>
                <Textarea
                  id="nd-notes"
                  placeholder="Ex. : ces produits ne sont pas vendus dans notre pharmacie..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button variant="outline" onClick={resetDialog}>
              Annuler
            </Button>
            <Button
              disabled={selectedIds.size === 0 || submitting}
              onClick={() => submitRequests()}
              className="gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {selectedIds.size > 1
                ? `Envoyer ${selectedIds.size} demandes`
                : "Envoyer la demande"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ListView>
  );
}
