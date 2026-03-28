import { useRef, useMemo, useState, useEffect } from "react";
import { ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/hooks/use-me";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";

import { ListView } from "@/components/refine-ui/views/list-view";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { DataTable } from "@/components/refine-ui/data-table/data-table";
import { TableToolbar } from "@/components/table-toolbar";
import { ColumnVisibilityToggle } from "@/components/column-visibility-toggle";
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
import * as adminApi from "@/api/admin";
import type { MedicamentOut, CategorySuffixOut } from "@/api/admin";
import { CategoryCombobox } from "@/components/category-combobox";
import { SuffixBadge, SUFFIX_COLORS, SWATCH_BG } from "@/components/suffix-badge";
import { fmt } from "@/utils/format";
import { downloadCSV } from "@/utils/table";
import { eUserRole } from "@/types";

const SUFFIX_QUERY_KEY = ["admin", "category-suffixes"] as const;

const CATALOG_COL_LABELS: Record<string, string> = {
  product: "Produit",
  category: "Catégorie",
  tva: "TVA",
  pph: "PPH",
  ppv: "PPV",
  barcode1: "Code-barres",
};

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
  product_type: string;
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
    product_type: m?.product_type ?? "",
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
        product_type: (form.product_type || null) as "pharmacie" | "parapharmacie" | null,
      };
      return isEdit
        ? adminApi.updateMedicament(medicament!.id, body)
        : adminApi.createMedicament(body as Omit<MedicamentOut, "id">);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "catalog"] });
      toast.success(isEdit ? "Médicament mis à jour" : "Médicament ajouté");
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.product.trim()) return;
    mutate();
  };

  useEffect(() => {
    if (open) setForm(emptyForm(medicament));
  }, [open, medicament]);

  const handleOpenChange = (v: boolean) => {
    if (!v && !isPending) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
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
                <Label>Catégorie</Label>
                <CategoryCombobox
                  value={form.category}
                  onChange={(v) => setForm((f) => ({ ...f, category: v }))}
                  placeholder="Analgésiques"
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type produit</Label>
                <select
                  value={form.product_type}
                  onChange={(e) => setForm((f) => ({ ...f, product_type: e.target.value }))}
                  disabled={isPending}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Auto-détection</option>
                  <option value="pharmacie">Pharmacie</option>
                  <option value="parapharmacie">Parapharmacie</option>
                </select>
                <p className="text-[11px] text-muted-foreground">Remplace la détection par catégorie</p>
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

// ── Category Suffixes Section ─────────────────────────────────────────────────

function CategorySuffixesSection() {
  const qc = useQueryClient();

  const { data: rows = [], isLoading: loadingSuffixes } = useQuery({
    queryKey: SUFFIX_QUERY_KEY,
    queryFn: adminApi.listCategorySuffixes,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategorySuffixOut | null>(null);
  const [form, setForm] = useState<{ category: string; suffix: string; color: string | null }>({ category: "", suffix: "", color: null });

  const openCreate = () => { setEditing(null); setForm({ category: "", suffix: "", color: null }); setDialogOpen(true); };
  const openEdit = (row: CategorySuffixOut) => { setEditing(row); setForm({ category: row.category, suffix: row.suffix, color: row.color ?? null }); setDialogOpen(true); };

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? adminApi.updateCategorySuffix(editing.id, form)
        : adminApi.createCategorySuffix(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: SUFFIX_QUERY_KEY }); setDialogOpen(false); toast.success(editing ? "Mapping mis à jour" : "Mapping créé"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [deleteTarget, setDeleteTarget] = useState<CategorySuffixOut | null>(null);
  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deleteCategorySuffix(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: SUFFIX_QUERY_KEY }); toast.success("Mapping supprimé"); setDeleteTarget(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Suffixes de catégories</h2>
          <p className="text-sm text-muted-foreground">
            Suffixe ajouté au N° Transaction Final selon la catégorie (ex: Médicament → -1).
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card">
        {loadingSuffixes ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucun mapping configuré</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Catégorie (normalisée)</th>
                <th className="px-5 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide w-40">Suffixe</th>
                <th className="px-5 py-2.5 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-5 py-3 font-medium">{row.category}</td>
                  <td className="px-5 py-3">
                    <SuffixBadge suffix={row.suffix} color={row.color ?? null} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEdit(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(row)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <div className="px-6 pt-6 pb-2">
            <p className="text-base font-semibold">{editing ? "Modifier le mapping" : "Nouveau mapping"}</p>
          </div>
          <div className="px-6 pb-2 space-y-4">
            <div className="space-y-1.5">
              <Label>Catégorie (nom normalisé, sans %)</Label>
              <Input placeholder="ex: Médicament" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Suffixe</Label>
              <Input placeholder="ex: -1" value={form.suffix} onChange={(e) => setForm((f) => ({ ...f, suffix: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Couleur du badge</Label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: null }))}
                  className={`h-7 w-7 rounded-full border-2 bg-muted transition-all ${form.color === null ? "border-foreground scale-110" : "border-transparent"}`}
                  title="Aucune couleur"
                />
                {SUFFIX_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${SWATCH_BG[c]} ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                    title={c}
                  />
                ))}
                {form.color !== null && (
                  <span className="ml-1">
                    <SuffixBadge suffix={form.suffix || "-1"} color={form.color} />
                  </span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6 gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button disabled={!form.category || !form.suffix || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce mapping ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le suffixe pour <strong>{deleteTarget?.category}</strong> sera supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const CATALOG_QUERY_KEY = ["admin", "catalog"] as const;

export default function AdminCatalogPage() {
  const { data: user } = useMe();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MedicamentOut | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MedicamentOut | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await adminApi.exportCatalog(searchQuery || undefined);
      const rows = res.data ?? [];
      downloadCSV(
        rows as unknown as Record<string, unknown>[],
        (r) => [
          String(r.pid ?? ""),
          String(r.product ?? ""),
          String(r.category ?? ""),
          String(r.tva ?? ""),
          fmt(r.pph as number | null),
          fmt(r.ppv as number | null),
          String(r.barcode1 ?? ""),
          String(r.laboratoire ?? ""),
          String(r.zone ?? ""),
        ],
        ["PID", "Produit", "Catégorie", "TVA", "PPH", "PPV", "Code-barres", "Laboratoire", "Zone"],
        `catalogue_${new Date().toISOString().slice(0, 10)}.csv`,
      );
    } finally {
      setExporting(false);
    }
  }

  const { data: queryResult, isLoading } = useQuery({
    queryKey: [...CATALOG_QUERY_KEY, page, limit, searchQuery],
    queryFn: () => adminApi.listCatalog(searchQuery || undefined, page, limit),
  });

  const rows = queryResult?.data ?? [];
  const paginationMeta = queryResult?.pagination;
  const pageCount = paginationMeta ? Math.ceil(paginationMeta.total / limit) : 1;

  useEffect(() => {
    if (user && user.role !== eUserRole.ADMIN) navigate("/", { replace: true });
  }, [user, navigate]);

  if (user && user.role !== eUserRole.ADMIN) return null;

  const columns = useMemo<ColumnDef<MedicamentOut>[]>(
    () => [
      {
        id: "product",
        accessorKey: "product",
        size: 360,
        header: () => <p className="column-title">Produit</p>,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex flex-col min-w-0">
            <span className="truncate text-sm font-medium">{row.original.product}</span>
            <div className="flex items-center gap-2 mt-0.5">
              {row.original.pid && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 font-mono">{row.original.pid}</Badge>
              )}
              {row.original.laboratoire && (
                <span className="text-xs text-muted-foreground">{row.original.laboratoire}</span>
              )}
            </div>
          </div>
        ),
      },
      {
        id: "category",
        accessorKey: "category",
        size: 200,
        header: () => <p className="column-title">Catégorie</p>,
        cell: ({ getValue }) => {
          const v = getValue<string | null>();
          if (!v) return <span className="text-muted-foreground">—</span>;
          return <Badge variant="secondary" className="text-xs max-w-[140px] truncate">{v}</Badge>;
        },
      },
      {
        id: "product_type",
        size: 120,
        header: () => <p className="column-title">Type</p>,
        cell: ({ row }) => {
          const pt = row.original.product_type;
          const cat = (row.original.category ?? "").toLowerCase();
          const resolved = pt || (cat.includes("edicament") || cat.includes("oméopath") || cat.includes("omeopath") ? "pharmacie" : "parapharmacie");
          return (
            <Badge variant="outline" className={resolved === "pharmacie"
              ? "text-blue-700 border-blue-300 bg-blue-50 text-xs"
              : "text-purple-700 border-purple-300 bg-purple-50 text-xs"}>
              {pt ? resolved.charAt(0).toUpperCase() + resolved.slice(1) : `${resolved.charAt(0).toUpperCase() + resolved.slice(1)} *`}
            </Badge>
          );
        },
      },
      {
        id: "tva",
        accessorKey: "tva",
        size: 80,
        header: () => <p className="column-title">TVA</p>,
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground">{getValue<string | null>() ?? "—"}</span>
        ),
      },
      {
        id: "pph",
        accessorKey: "pph",
        size: 100,
        header: () => <p className="column-title">PPH</p>,
        cell: ({ getValue }) => (
          <span className="tabular-nums text-sm">{fmt(getValue<number | null>())}</span>
        ),
      },
      {
        id: "ppv",
        accessorKey: "ppv",
        size: 100,
        header: () => <p className="column-title">PPV</p>,
        cell: ({ getValue }) => (
          <span className="tabular-nums text-sm">{fmt(getValue<number | null>())}</span>
        ),
      },
      {
        id: "barcode1",
        accessorKey: "barcode1",
        size: 150,
        header: () => <p className="column-title">Code-barres</p>,
        cell: ({ getValue }) => {
          const v = getValue<string | null>();
          return v
            ? <span className="font-mono text-xs text-muted-foreground">{v}</span>
            : <span className="text-muted-foreground">—</span>;
        },
      },
      {
        id: "actions",
        size: 80,
        enableHiding: false,
        header: () => null,
        cell: ({ row }) => (
          <div className="flex items-center gap-1 justify-end">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => { setEditTarget(row.original); setFormOpen(true); }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => setDeleteTarget(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const tableInstance = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
  });

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setPage(1);
  };

  const { mutate: importCatalog, isPending: importing } = useMutation({
    mutationFn: (file: File) => adminApi.importCatalog(file),
    onSuccess: (data: { imported: number }) => {
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
      toast.success(`Catalogue importé — ${data.imported} médicaments`);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err) => {
      toast.error(err.message);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
  });

  const { mutate: deleteMed, isPending: deleting } = useMutation({
    mutationFn: (id: number) => adminApi.deleteMedicament(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
      toast.success("Médicament supprimé");
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <ListView>
      <Breadcrumb />
      <h1 className="page-title">Catalogue médicaments</h1>
      <p className="text-sm text-muted-foreground -mt-2">Gérez le catalogue partagé des médicaments.</p>

      {/* Category suffixes — at top */}
      <CategorySuffixesSection />

      <div className="border-t pt-2" />

      {/* Toolbar */}
      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Rechercher un médicament…"
        allCategories={[]}
        selectedCats={[]}
        onCatsChange={() => {}}
        onExport={handleExport}
        exporting={exporting}
        rightAddon={
          <div className="flex items-center gap-2">
            <ColumnVisibilityToggle
              table={tableInstance}
              storageKey="admin-catalog-cols"
              columnLabels={CATALOG_COL_LABELS}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsm"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importCatalog(f); }}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 shrink-0"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span className="hidden sm:inline">Importer CSV</span>
            </Button>
            <Button
              size="sm"
              className="h-9 gap-2 shrink-0"
              onClick={() => { setEditTarget(null); setFormOpen(true); }}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Ajouter</span>
            </Button>
          </div>
        }
      />

      <DataTable
        table={tableInstance}
        isLoading={isLoading}
        pagination={{
          currentPage: page,
          setCurrentPage: setPage,
          pageCount,
          pageSize: limit,
          setPageSize: setLimit,
          total: paginationMeta?.total,
        }}
      />

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
