import { useEffect, useState } from "react";
import { Settings, Trash2, AlertTriangle, Loader2, CalendarDays, Tag } from "lucide-react";

import { ListView } from "@/components/refine-ui/views/list-view";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useClearAchats, useClearVentes } from "@/hooks/use-clear-data";
import { CategoryMultiSelect } from "@/components/category-multi-select";

type ClearTarget = "achats" | "ventes";

// ── Delete dialog ─────────────────────────────────────────────────────────────

function DeleteDialog({
  target,
  open,
  onClose,
  onDeleted,
  allCategories,
}: {
  target: ClearTarget;
  open: boolean;
  onClose: () => void;
  onDeleted: (count: number) => void;
  allCategories: string[];
}) {
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const {
    mutate: clearAchats,
    isPending: clearAchatsPending,
    reset: resetAchats,
  } = useClearAchats();

  const {
    mutate: clearVentes,
    isPending: clearVentesPending,
    reset: resetVentes,
  } = useClearVentes();

  const isPending = clearAchatsPending || clearVentesPending;

  useEffect(() => {
    if (!open) return;
    setSelectedCats([]);
    setDateFrom("");
    setDateTo("");
    resetAchats();
    resetVentes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target]);

  const handleConfirm = () => {
    const filters = {
      categories: selectedCats.length > 0 ? selectedCats : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    };
    const mutate = target === "achats" ? clearAchats : clearVentes;
    mutate(filters, {
      onSuccess: (data) => {
        onDeleted(data.deleted);
        onClose();
      },
    });
  };

  const isFiltered = selectedCats.length > 0 || !!dateFrom || !!dateTo;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !isPending) onClose(); }}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">

        {/* ── Header band ── */}
        <div className="flex items-start gap-4 px-6 pt-6 pb-5 border-b bg-destructive/[0.04]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 border border-destructive/20">
            <Trash2 className="h-4.5 w-4.5 text-destructive" />
          </div>
          <div className="space-y-1 pt-0.5">
            <p className="text-base font-semibold leading-none text-destructive capitalize">
              Supprimer des {target}
            </p>
            <p className="text-sm text-muted-foreground">
              Filtrez la suppression ou laissez vide pour tout supprimer.{" "}
              Cette action est <span className="font-medium text-foreground">irréversible</span>.
            </p>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 space-y-5">

          {/* Category filter */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">Par catégorie</span>
            </div>
            <CategoryMultiSelect
              allCategories={allCategories}
              selected={selectedCats}
              onChange={setSelectedCats}
              variant="destructive"
              inline
              className="w-full"
            />
          </div>

          <Separator />

          {/* Date filter */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">Par période</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Du</label>
                <Input
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={cn(
                    "h-9 text-sm",
                    dateFrom && "border-destructive/50 text-destructive focus-visible:ring-destructive/30"
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Au</label>
                <Input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={cn(
                    "h-9 text-sm",
                    dateTo && "border-destructive/50 text-destructive focus-visible:ring-destructive/30"
                  )}
                />
              </div>
            </div>
          </div>

          {/* Scope summary */}
          <div
            className={cn(
              "flex items-start gap-2.5 rounded-lg border p-3.5",
              isFiltered
                ? "border-amber-400/40 bg-amber-50/80 dark:bg-amber-500/10"
                : "border-destructive/30 bg-destructive/5"
            )}
          >
            <AlertTriangle
              className={cn(
                "h-4 w-4 shrink-0 mt-0.5",
                isFiltered ? "text-amber-500" : "text-destructive"
              )}
            />
            <p className={cn(
              "text-sm leading-snug",
              isFiltered ? "text-amber-700 dark:text-amber-400" : "text-destructive"
            )}>
              {isFiltered ? (
                <>
                  Suppression filtrée :{" "}
                  {selectedCats.length > 0 && (
                    <strong>{selectedCats.length} catégorie{selectedCats.length > 1 ? "s" : ""}</strong>
                  )}
                  {selectedCats.length > 0 && (dateFrom || dateTo) && <span> · </span>}
                  {(dateFrom || dateTo) && (
                    <strong>
                      {dateFrom && dateTo
                        ? `${dateFrom} → ${dateTo}`
                        : dateFrom
                        ? `à partir du ${dateFrom}`
                        : `jusqu'au ${dateTo}`}
                    </strong>
                  )}
                </>
              ) : (
                <>
                  <strong>Toutes</strong> les données de {target} seront supprimées définitivement.
                </>
              )}
            </p>
          </div>
        </div>

        {/* ── Footer ── */}
        <DialogFooter className="px-6 pb-6 gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending} className="flex-1 sm:flex-none">
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
            className="flex-1 sm:flex-none gap-2"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending ? "Suppression..." : "Confirmer la suppression"}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const ParametresList = () => {
  const [dialogTarget, setDialogTarget] = useState<ClearTarget | null>(null);
  const [lastResult, setLastResult] = useState<{ target: ClearTarget; deleted: number } | null>(null);
  const [achatCategories, setAchatCategories] = useState<string[]>([]);
  const [venteCategories, setVenteCategories] = useState<string[]>([]);

  useEffect(() => {
    api.tables.achatCategories().then(setAchatCategories).catch(() => {});
    api.tables.venteCategories().then(setVenteCategories).catch(() => {});
  }, []);

  return (
    <ListView>
      <Breadcrumb />
      <h1 className="page-title">Paramètres</h1>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4" />
              Configuration de la pharmacie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Les paramètres de la pharmacie seront disponibles ici.
            </p>
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Zone de danger
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ces actions sont irréversibles. Les données supprimées ne peuvent pas être récupérées.
            </p>

            {(
              [
                {
                  target: "achats" as ClearTarget,
                  label: "Supprimer des achats",
                  desc: "Supprimez tout ou une sélection de bons de livraison.",
                },
                {
                  target: "ventes" as ClearTarget,
                  label: "Supprimer des ventes",
                  desc: "Supprimez tout ou une sélection de transactions de vente.",
                },
              ] as const
            ).map(({ target, label, desc }) => (
              <div key={target} className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer text-destructive border-destructive/40 hover:bg-destructive/10 shrink-0 ml-4"
                  onClick={() => { setLastResult(null); setDialogTarget(target); }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Supprimer
                </Button>
              </div>
            ))}

            {lastResult && (
              <div className="flex items-center gap-2">
                <p className="text-sm text-teal-600 dark:text-teal-400">
                  {lastResult.deleted} enregistrement(s) supprimé(s) des {lastResult.target}.
                </p>
                <Badge variant="secondary" className="text-xs">{lastResult.target}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {dialogTarget && (
        <DeleteDialog
          target={dialogTarget}
          open={!!dialogTarget}
          allCategories={dialogTarget === "achats" ? achatCategories : venteCategories}
          onClose={() => setDialogTarget(null)}
          onDeleted={(count) => setLastResult({ target: dialogTarget, deleted: count })}
        />
      )}
    </ListView>
  );
};

export default ParametresList;
