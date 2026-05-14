import { useEffect, useState } from "react";
import {
  Trash2,
  AlertTriangle,
  Loader2,
  CalendarDays,
  Tag,
  UserRound,
  Sparkles,
} from "lucide-react";

import { ListView } from "@/components/shared/listView";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DateRangePicker } from "@/components/ui/dateRangePicker";
import { cn } from "@/utils/cn";
import { toast } from "sonner";

import * as transactionsApi from "@/api/transactions";
import { useClearAchats, useClearVentes, useImports, useDeleteImport } from "@/hooks/useClearData";
import { CategoryMultiSelect } from "@/components/categoryMultiSelect";
import { useMe } from "@/hooks/useMe";
import { useUpdateMe } from "@/hooks/useUpdateMe";
import { useOwnerSpecialProductsStats } from "@/hooks/useOwnerStats";
import { useProfileForm } from "@/schemas/profile";
import type { ProfileFormValues } from "@/schemas/profile";
import { eUserRole } from "@/types";

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

  const { clearAchats, clearAchatsPending, resetAchats } = useClearAchats();

  const { clearVentes, clearVentesPending, resetVentes } = useClearVentes();

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
    const clearFn = target === "achats" ? clearAchats : clearVentes;
    clearFn(filters, {
      onSuccess: (data: { deleted: number }) => {
        onDeleted(data.deleted);
        onClose();
      },
    });
  };

  const isFiltered = selectedCats.length > 0 || !!dateFrom || !!dateTo;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !isPending) onClose();
      }}
    >
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
              Filtrez la suppression ou laissez vide pour tout supprimer. Cette
              action est{" "}
              <span className="font-medium text-foreground">irréversible</span>.
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
            <DateRangePicker
              from={dateFrom}
              to={dateTo}
              onFromChange={setDateFrom}
              onToChange={setDateTo}
              aria-invalid={!!(dateFrom || dateTo)}
            />
          </div>

          {/* Scope summary */}
          <div
            className={cn(
              "flex items-start gap-2.5 rounded-lg border p-3.5",
              isFiltered
                ? "border-amber-400/40 bg-amber-50/80 dark:bg-amber-500/10"
                : "border-destructive/30 bg-destructive/5",
            )}
          >
            <AlertTriangle
              className={cn(
                "h-4 w-4 shrink-0 mt-0.5",
                isFiltered ? "text-amber-500" : "text-destructive",
              )}
            />
            <p
              className={cn(
                "text-sm leading-snug",
                isFiltered
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-destructive",
              )}
            >
              {isFiltered ? (
                <>
                  Suppression filtrée :{" "}
                  {selectedCats.length > 0 && (
                    <strong>
                      {selectedCats.length} catégorie
                      {selectedCats.length > 1 ? "s" : ""}
                    </strong>
                  )}
                  {selectedCats.length > 0 && (dateFrom || dateTo) && (
                    <span> · </span>
                  )}
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
                  <strong>Toutes</strong> les données de {target} seront
                  supprimées définitivement.
                </>
              )}
            </p>
          </div>
        </div>

        {/* ── Footer ── */}
        <DialogFooter className="px-6 pb-6 gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isPending}
            className="flex-1 sm:flex-none"
          >
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

function formatImportDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// One block per import type — driven by this config so the three sections
// share rendering logic without duplication.
const IMPORT_SECTIONS = [
  {
    type: "achat" as const,
    label: "Achats",
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  {
    type: "vente" as const,
    label: "Ventes",
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  {
    type: "stock" as const,
    label: "Stock",
    badgeClass: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  },
];

// ── Profile section ──────────────────────────────────────────────────────────

function ProfileSection() {
  const { me: user } = useMe();
  const { updateMe, updateMePending } = useUpdateMe();
  const form = useProfileForm();

  const isAdmin = user?.role === eUserRole.ADMIN;
  const isEmployee = user?.role === eUserRole.EMPLOYEE;

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name ?? "",
        phone: user.phone ?? "",
        email: user.email ?? "",
        pharmacy_name: user.pharmacy_name ?? "",
        pharmacy_address: user.pharmacy_address ?? "",
      });
    }
  }, [user, form]);

  const onSubmit = (values: ProfileFormValues) => {
    updateMe(values, {
      onSuccess: () => toast.success("Profil mis à jour"),
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRound className="h-4 w-4" />
          Mon profil
        </CardTitle>
        <CardDescription>
          {isAdmin
            ? "Mettez à jour vos coordonnées"
            : isEmployee
            ? "Mettez à jour vos coordonnées"
            : "Mettez à jour vos coordonnées et les informations de votre pharmacie"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom complet</FormLabel>
                  <FormControl><Input placeholder="Dr. Jean Dupont" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl><Input placeholder="+212 6 00 00 00 00" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input placeholder="email@exemple.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {!isAdmin && (
              <>
                <Separator />
                <p className="text-sm font-medium">Pharmacie</p>
                {isEmployee ? (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Pharmacie associée</p>
                    <p className="text-sm font-medium">{user?.pharmacy_name ?? "—"}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="pharmacy_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom de la pharmacie</FormLabel>
                          <FormControl><Input placeholder="Pharmacie Centrale" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="pharmacy_address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Adresse</FormLabel>
                          <FormControl><Input placeholder="12 rue Mohammed V, Casablanca" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={updateMePending} className="min-w-32 gap-2">
                {updateMePending && <Loader2 className="h-4 w-4 animate-spin" />}
                {updateMePending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// ── Special products card ───────────────────────────────────────────────────

function SpecialProductsCard() {
  const { data, isLoading } = useOwnerSpecialProductsStats(true);
  const pct = data?.percentage ?? 0;
  const pctLabel = pct.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  const total = data?.total_products ?? 0;
  const special = data?.special_count ?? 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4" />
          Produits spéciaux
        </CardTitle>
        <CardDescription>
          Part de vos produits exclus des rapports.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div>
            <p className="text-3xl font-semibold tabular-nums">{pctLabel} %</p>
            <p className="text-[10px] opacity-50 font-mono mt-1">
              (spéciaux ÷ produits utilisés) × 100
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {special} spécia{special === 1 ? "l" : "ux"} sur {total} produit{total === 1 ? "" : "s"} utilisé{total === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const ParametresList = () => {
  const { me: currentUser } = useMe();
  const isAdmin = currentUser?.role === eUserRole.ADMIN;
  const [dialogTarget, setDialogTarget] = useState<ClearTarget | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [achatCategories, setAchatCategories] = useState<string[]>([]);
  const [venteCategories, setVenteCategories] = useState<string[]>([]);

  const { imports, isLoading: importsLoading } = useImports();
  const { deleteImport, deleting } = useDeleteImport();

  useEffect(() => {
    if (isAdmin) return;
    transactionsApi
      .achatCategories()
      .then(setAchatCategories)
      .catch(() => {});
    transactionsApi
      .venteCategories()
      .then(setVenteCategories)
      .catch(() => {});
  }, [isAdmin]);

  return (
    <ListView>
      <Breadcrumb />
      <h1 className="page-title">Paramètres</h1>

      <div className="grid gap-4">
        <ProfileSection />

        {!isAdmin && currentUser?.role === eUserRole.OWNER && <SpecialProductsCard />}

        {!isAdmin && <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Zone de danger
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="text-sm font-medium mb-1">Historique des imports</p>
              <p className="text-xs text-muted-foreground">
                Supprimez un import spécifique pour annuler toutes les données importées par ce fichier.
              </p>
            </div>

            {importsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-6">
                {IMPORT_SECTIONS.map(({ type, label, badgeClass }) => {
                  const rows = imports.filter((b) => b.file_type === type);
                  return (
                    <div key={type}>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className={cn("text-xs shrink-0", badgeClass)}>
                          {label}
                        </Badge>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {rows.length} import{rows.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {rows.length === 0 ? (
                        <div className="flex items-center gap-2 py-3 px-4 text-xs text-muted-foreground border-2 border-dashed rounded-lg">
                          <CalendarDays className="h-3.5 w-3.5 opacity-60" />
                          Aucun import {label.toLowerCase()}.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {rows.map((batch) => (
                            <div key={batch.id} className="rounded-lg border p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs text-muted-foreground mb-1">
                                    {formatImportDate(batch.imported_at)}
                                  </p>
                                  {batch.filename && (
                                    <p className="text-sm font-medium truncate" title={batch.filename}>
                                      {batch.filename.replace(/\.csv$/i, "")}
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {batch.rows_inserted} ligne{batch.rows_inserted !== 1 ? "s" : ""} importée{batch.rows_inserted !== 1 ? "s" : ""}
                                    {batch.rows_skipped > 0 && ` · ${batch.rows_skipped} doublon${batch.rows_skipped !== 1 ? "s" : ""} ignoré${batch.rows_skipped !== 1 ? "s" : ""}`}
                                  </p>
                                </div>
                                {deleteConfirm === batch.id ? (
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="h-7 text-xs"
                                      disabled={deleting}
                                      onClick={() => {
                                        deleteImport(batch.id, { onSuccess: () => setDeleteConfirm(null) });
                                      }}
                                    >
                                      {deleting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                      Confirmer
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs"
                                      onClick={() => setDeleteConfirm(null)}
                                    >
                                      Annuler
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="cursor-pointer text-destructive border-destructive/40 hover:bg-destructive/10 shrink-0 h-7 text-xs"
                                    onClick={() => setDeleteConfirm(batch.id)}
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Supprimer
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <Separator />

            <div>
              <p className="text-sm font-medium mb-1">Suppression avancée</p>
              <p className="text-xs text-muted-foreground mb-3">
                Supprimez des données par date et catégorie (pour les imports antérieurs au suivi par lot).
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { target: "achats" as ClearTarget, label: "Supprimer des achats" },
                    { target: "ventes" as ClearTarget, label: "Supprimer des ventes" },
                  ] as const
                ).map(({ target, label }) => (
                  <Button
                    key={target}
                    size="sm"
                    variant="outline"
                    className="cursor-pointer text-destructive border-destructive/40 hover:bg-destructive/10 text-xs"
                    onClick={() => setDialogTarget(target)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>}
      </div>

      {!isAdmin && dialogTarget && (
        <DeleteDialog
          target={dialogTarget}
          open={!!dialogTarget}
          allCategories={
            dialogTarget === "achats" ? achatCategories : venteCategories
          }
          onClose={() => setDialogTarget(null)}
          onDeleted={() => setDialogTarget(null)}
        />
      )}
    </ListView>
  );
};

export default ParametresList;
