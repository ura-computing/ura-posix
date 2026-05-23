import { useState, useCallback, useRef } from "react";
import { useMe } from "@/hooks/useMe";
import {
  useOwnerSpecialProducts,
  useMyProducts,
  useSubmitNonDeclareRequests,
  useSubmitAnnulation,
} from "@/hooks/useCatalogRequests";
import {
  PackageX,
  Loader2,
  CheckCircle2,
  Search,
  FileX,
  Undo2,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/utils/cn";

import { PageLoader } from "@/components/shared/pageLoader";
import { ListView } from "@/components/shared/listView";
import { Breadcrumb } from "@/components/layout/breadcrumb";
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
import { eUserRole } from "@/types";

export default function CatalogRequestsPage() {
  const { me: identity } = useMe();

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

  const toggleAllVisible = useCallback((visibleIds: number[]) => {
    setSelectedIds((prev) => {
      const allSelected = visibleIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  // Products this pharmacy currently excludes from its reports
  const { products: exclusions, productsLoading: exclusionsLoading } = useOwnerSpecialProducts(isOwner);

  // Pharmacy products search
  const hasSearch = debouncedSearch.trim().length > 0;
  const { products, productsLoading } = useMyProducts(debouncedSearch, dialogOpen);

  const { submitRequests, submitting } = useSubmitNonDeclareRequests(selectedIds, resetDialog);
  const { submitAnnulation, submittingAnnulation } = useSubmitAnnulation();

  if (!isOwner) return null;

  return (
    <ListView>
      <Breadcrumb />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Produits spéciaux</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Excluez un produit de vos rapports en un clic — aucune validation administrateur requise.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 shrink-0">
          <PackageX className="h-4 w-4" />
          Exclure des produits
        </Button>
      </div>

      {/* Excluded products list */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-semibold">Produits exclus</h2>
          {!exclusionsLoading && <Badge variant="secondary">{exclusions.length}</Badge>}
        </div>

        <div className="border rounded-xl overflow-hidden bg-card">
          {exclusionsLoading ? (
            <PageLoader />
          ) : exclusions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <FileX className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Aucun produit exclu</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Cliquez sur « Exclure des produits » pour retirer un produit de vos rapports.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              <div className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-2.5 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <span>Produit</span>
                <span className="w-28 text-center">Exclu le</span>
                <span className="w-28 text-center">Action</span>
              </div>
              {exclusions.map((p) => (
                <div
                  key={p.medicament_id}
                  className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto] gap-2 sm:gap-4 px-5 py-3 items-start sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.product}</p>
                  </div>
                  <span className="text-xs text-muted-foreground w-28 text-center">
                    {p.created_at
                      ? format(new Date(p.created_at), "d MMM yyyy", { locale: fr })
                      : "—"}
                  </span>
                  <div className="w-28 flex justify-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1.5 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                      disabled={submittingAnnulation}
                      onClick={() => submitAnnulation({ medicament_id: p.medicament_id })}
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      Réintégrer
                    </Button>
                  </div>
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
            <DialogTitle>Exclure des produits</DialogTitle>
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
                placeholder="Rechercher par produit, fournisseur ou code-barres…"
                className="pl-9"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                autoFocus
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>

            {/* Header bar with select-all toggle (shown once results are listed) */}
            {hasSearch && !productsLoading && products.length > 0 && (() => {
              const selectableIds = products.map((p) => p.medicament_id);
              const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
              const someSelected = selectableIds.some((id) => selectedIds.has(id));
              return (
                <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    {products.length} résultat{products.length > 1 ? "s" : ""}
                    {someSelected && ` · ${selectableIds.filter((id) => selectedIds.has(id)).length} sélectionné${selectableIds.filter((id) => selectedIds.has(id)).length > 1 ? "s" : ""}`}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={selectableIds.length === 0}
                    onClick={() => toggleAllVisible(selectableIds)}
                  >
                    {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
                  </Button>
                </div>
              );
            })()}

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
                    const isSelected = selectedIds.has(p.medicament_id);
                    const cleanCategory = p.category?.replace(/\s*\(\d+\.?\d*%\)/, "").trim();
                    return (
                      <button
                        key={p.medicament_id}
                        type="button"
                        onClick={() => toggleProduct(p.medicament_id)}
                        className={cn(
                          "w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors",
                          isSelected
                            ? "bg-primary/10"
                            : "hover:bg-muted/50"
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
                  Note interne{" "}
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
              onClick={() => submitRequests(notes)}
              className="gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {selectedIds.size > 1
                ? `Exclure ${selectedIds.size} produits`
                : "Exclure le produit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ListView>
  );
}
