import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { ListView } from "@/components/refine-ui/views/list-view";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
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
import type { MedicamentOut } from "@/lib/api";

const QUERY_KEY = ["admin", "catalog"] as const;

// ── Medicament form dialog ────────────────────────────────────────────────────

type MedicamentFormProps = {
  open: boolean;
  onClose: () => void;
  medicament?: MedicamentOut | null;
};

type FormState = {
  pid: string;
  product: string;
  tva: string;
  pph: string;
  ppv: string;
  category: string;
  zone: string;
  barcode1: string;
  barcode2: string;
  laboratoire: string;
};

function emptyForm(m?: MedicamentOut | null): FormState {
  return {
    pid: m?.pid ?? "",
    product: m?.product ?? "",
    tva: m?.tva ?? "",
    pph: m?.pph != null ? String(m.pph) : "",
    ppv: m?.ppv != null ? String(m.ppv) : "",
    category: m?.category ?? "",
    zone: m?.zone ?? "",
    barcode1: m?.barcode1 ?? "",
    barcode2: m?.barcode2 ?? "",
    laboratoire: m?.laboratoire ?? "",
  };
}

function MedicamentFormDialog({ open, onClose, medicament }: MedicamentFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!medicament;
  const [form, setForm] = useState<FormState>(() => emptyForm(medicament));

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const body = {
        pid: form.pid,
        product: form.product,
        tva: form.tva || null,
        pph: form.pph ? Number(form.pph) : null,
        ppv: form.ppv ? Number(form.ppv) : null,
        category: form.category || null,
        zone: form.zone || null,
        barcode1: form.barcode1 || null,
        barcode2: form.barcode2 || null,
        laboratoire: form.laboratoire || null,
      };
      return isEdit
        ? api.admin.updateMedicament(medicament!.id, body)
        : api.admin.createMedicament(body as Omit<MedicamentOut, "id">);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(isEdit ? "Médicament mis à jour" : "Médicament ajouté");
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product.trim()) return;
    mutate();
  };

  // Reset form when dialog re-opens with a different medicament
  const handleOpenChange = (v: boolean) => {
    if (v) setForm(emptyForm(medicament));
    if (!v && !isPending) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-4 px-6 pt-6 pb-5 border-b bg-primary/[0.03]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
            <BookOpen className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="space-y-1 pt-0.5">
            <p className="text-base font-semibold leading-none">
              {isEdit ? "Modifier le médicament" : "Nouveau médicament"}
            </p>
            <p className="text-sm text-muted-foreground">
              {isEdit ? "Mettez à jour les informations." : "Ajoutez un médicament au catalogue partagé."}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="m-pid">Code produit (PID)</Label>
                <Input id="m-pid" value={form.pid} onChange={set("pid")} placeholder="P00001" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-labo">Laboratoire</Label>
                <Input id="m-labo" value={form.laboratoire} onChange={set("laboratoire")} placeholder="Sanofi" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="m-product">
                Nom du produit <span className="text-destructive">*</span>
              </Label>
              <Input id="m-product" value={form.product} onChange={set("product")} placeholder="Doliprane 1000mg" required />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="m-pph">PPH (DH HT)</Label>
                <Input id="m-pph" type="number" step="0.01" value={form.pph} onChange={set("pph")} placeholder="12.50" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-ppv">PPV (DH TTC)</Label>
                <Input id="m-ppv" type="number" step="0.01" value={form.ppv} onChange={set("ppv")} placeholder="15.00" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-tva">TVA</Label>
                <Input id="m-tva" value={form.tva} onChange={set("tva")} placeholder="7%" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="m-category">Catégorie</Label>
                <Input id="m-category" value={form.category} onChange={set("category")} placeholder="Analgésiques" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-zone">Zone</Label>
                <Input id="m-zone" value={form.zone} onChange={set("zone")} placeholder="Zone A" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-barcode1">Code-barres 1</Label>
                <Input id="m-barcode1" value={form.barcode1} onChange={set("barcode1")} placeholder="3400930011005" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-barcode2">Code-barres 2</Label>
                <Input id="m-barcode2" value={form.barcode2} onChange={set("barcode2")} placeholder="Optionnel" />
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 pb-6 gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending || !form.product.trim()} className="gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminCatalogPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MedicamentOut | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MedicamentOut | null>(null);

  const { data: medicaments = [], isLoading } = useQuery({
    queryKey: [...QUERY_KEY, search],
    queryFn: () => api.admin.listCatalog(search || undefined),
  });

  const { mutate: deleteMed, isPending: deleting } = useMutation({
    mutationFn: (id: number) => api.admin.deleteMedicament(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Médicament supprimé");
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const openCreate = () => { setEditTarget(null); setFormOpen(true); };
  const openEdit = (m: MedicamentOut) => { setEditTarget(m); setFormOpen(true); };

  return (
    <ListView>
      <Breadcrumb />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Catalogue médicaments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez le catalogue partagé des médicaments.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un médicament…"
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : medicaments.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {search ? "Aucun résultat" : "Catalogue vide"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {search ? `Aucun médicament trouvé pour "${search}".` : "Ajoutez le premier médicament."}
              </p>
            </div>
            {!search && (
              <Button onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Ajouter un médicament
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y">
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-5 py-2.5 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span>Produit</span>
              <span className="w-20 text-right">PPH</span>
              <span className="w-20 text-right">PPV</span>
              <span className="w-16 text-center">TVA</span>
              <span className="w-28 truncate">Catégorie</span>
              <span className="w-16 text-center">Actions</span>
            </div>
            {medicaments.map((m) => (
              <div key={m.id} className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto_auto_auto_auto] gap-2 sm:gap-4 px-5 py-3 items-start sm:items-center">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.product}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {m.pid && <Badge variant="outline" className="text-xs px-1.5 py-0 font-mono">{m.pid}</Badge>}
                    {m.laboratoire && <span className="text-xs text-muted-foreground">{m.laboratoire}</span>}
                  </div>
                </div>
                <span className="text-sm text-muted-foreground w-20 text-right">
                  {m.pph != null ? `${m.pph.toFixed(2)} DH` : "—"}
                </span>
                <span className="text-sm text-muted-foreground w-20 text-right">
                  {m.ppv != null ? `${m.ppv.toFixed(2)} DH` : "—"}
                </span>
                <span className="text-sm text-muted-foreground w-16 text-center">
                  {m.tva ?? "—"}
                </span>
                <span className="text-xs text-muted-foreground w-28 truncate">
                  {m.category ?? "—"}
                </span>
                <div className="flex items-center gap-1 w-16 justify-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => openEdit(m)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(m)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form dialog */}
      <MedicamentFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        medicament={editTarget}
      />

      {/* Delete dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer "{deleteTarget?.product}" ?</AlertDialogTitle>
            <AlertDialogDescription>
              Ce médicament sera retiré du catalogue partagé. Les données historiques d'achats et ventes ne seront pas affectées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={() => deleteTarget && deleteMed(deleteTarget.id)}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ListView>
  );
}
