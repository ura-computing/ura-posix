import { useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  PackagePlus,
  Loader2,
  ChevronDown,
  ChevronUp,
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
import { api } from "@/lib/api";
import type { CatalogRequestOut } from "@/lib/api";
import { CategoryCombobox } from "@/components/category-combobox";
import type { User } from "@/types";
import { eUserRole } from "@/types";

const QUERY_KEY = ["catalog-requests", "owner"] as const;

type FormValues = {
  product: string;
  tva: string;
  pph: string;
  ppv: string;
  category: string;
  zone: string;
  barcode1: string;
  laboratoire: string;
};

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

export default function CatalogRequestsPage() {
  const { data: identity } = useGetIdentity<User>();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);

  const isOwner = identity?.role === eUserRole.OWNER;
  const [categoryValue, setCategoryValue] = useState("");

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: { product: "", tva: "", pph: "", ppv: "", category: "", zone: "", barcode1: "", laboratoire: "" },
  });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.catalogRequests.list(),
    enabled: isOwner,
  });

  const { mutate: submit, isPending: submitting } = useMutation({
    mutationFn: (values: FormValues) =>
      api.catalogRequests.submit({
        product: values.product,
        tva: values.tva || undefined,
        pph: values.pph ? Number(values.pph) : undefined,
        ppv: values.ppv ? Number(values.ppv) : undefined,
        category: values.category || undefined,
        zone: values.zone || undefined,
        barcode1: values.barcode1 || undefined,
        laboratoire: values.laboratoire || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Demande envoyée à l'administrateur");
      reset(); setCategoryValue("");
      setFormOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const onSubmit = handleSubmit((values) => submit(values));

  if (!isOwner) return null;

  return (
    <ListView>
      <Breadcrumb />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Demandes catalogue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Soumettez des demandes d'ajout de médicaments au catalogue.
          </p>
        </div>
        <Button onClick={() => setFormOpen((v) => !v)} className="gap-2 shrink-0" variant={formOpen ? "outline" : "default"}>
          <PackagePlus className="h-4 w-4" />
          Nouvelle demande
        </Button>
      </div>

      {/* Submission form */}
      {formOpen && (
        <div className="border rounded-xl bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <PackagePlus className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Nouveau médicament à ajouter</span>
            </div>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {formOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          <form onSubmit={onSubmit} className="px-5 py-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="cr-product">
                  Nom du produit <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cr-product"
                  placeholder="Doliprane 1000mg"
                  {...register("product", { required: true })}
                  className={cn(errors.product && "border-destructive")}
                />
                {errors.product && <p className="text-xs text-destructive">Champ requis</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cr-pph">PPH (DH HT)</Label>
                <Input id="cr-pph" type="number" step="0.01" placeholder="12.50" {...register("pph")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cr-ppv">PPV (DH TTC)</Label>
                <Input id="cr-ppv" type="number" step="0.01" placeholder="15.00" {...register("ppv")} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cr-tva">TVA</Label>
                <Input id="cr-tva" placeholder="7%" {...register("tva")} />
              </div>
              <div className="space-y-1.5">
                <Label>Catégorie</Label>
                <CategoryCombobox
                  value={categoryValue}
                  onChange={(v) => { setCategoryValue(v); setValue("category", v); }}
                  placeholder="Analgésiques"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cr-zone">Zone</Label>
                <Input id="cr-zone" placeholder="Zone A" {...register("zone")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cr-barcode1">Code-barres</Label>
                <Input id="cr-barcode1" placeholder="3400930011005" {...register("barcode1")} />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="cr-labo">Laboratoire</Label>
                <Input id="cr-labo" placeholder="Sanofi" {...register("laboratoire")} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => { reset(); setFormOpen(false); }}>
                Annuler
              </Button>
              <Button type="submit" disabled={submitting} className="gap-2">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Envoyer la demande
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Requests list */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-semibold">Mes demandes</h2>
          {!isLoading && <Badge variant="secondary">{requests.length}</Badge>}
        </div>

        <div className="border rounded-xl overflow-hidden bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <PackagePlus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Aucune demande</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Cliquez sur "Nouvelle demande" pour soumettre un médicament.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2.5 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <span>Produit</span>
                <span className="w-20 text-right">PPH</span>
                <span className="w-24 text-center">Statut</span>
                <span className="w-28 text-center">Date</span>
              </div>
              {requests.map((req) => (
                <div key={req.id} className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto_auto] gap-2 sm:gap-4 px-5 py-3 items-start sm:items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{req.product}</p>
                    {req.reject_reason && (
                      <p className="text-xs text-destructive mt-0.5 truncate">Motif : {req.reject_reason}</p>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground w-20 text-right">
                    {req.pph != null ? `${req.pph.toFixed(2)} DH` : "—"}
                  </span>
                  <div className="w-24 flex justify-center">
                    <StatusBadge status={req.status} />
                  </div>
                  <span className="text-xs text-muted-foreground w-28 text-center">
                    {req.created_at ? format(new Date(req.created_at), "d MMM yyyy", { locale: fr }) : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ListView>
  );
}
