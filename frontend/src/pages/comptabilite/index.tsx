import { useState, useMemo } from "react";
import { ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { CreditCard, Banknote, Receipt, ArrowRightLeft, Loader2, Plus } from "lucide-react";

import { ListView } from "@/components/shared/listView";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/DataTable/dataTable";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/cn";
import { fmt } from "@/utils/format";
import { eCategoryType } from "@/types";
import { usePayments, useSavePayment } from "@/hooks/useAccounting";
import { usePharmacyStats } from "@/hooks/usePharmacyRapports";
import { useVentesList } from "@/hooks/useVentesList";

const METHODS = [
  { key: "tpe", label: "TPE", icon: CreditCard, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800" },
  { key: "especes", label: "Espèces", icon: Banknote, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-800" },
  { key: "cheques", label: "Chèques", icon: Receipt, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800" },
  { key: "virement", label: "Virement et autres", icon: ArrowRightLeft, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800" },
] as const;

function getCurrentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ComptabilitePage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMonth, setEditMonth] = useState(getCurrentMonth());
  const [editMethod, setEditMethod] = useState("tpe");
  const [editPharma, setEditPharma] = useState("");
  const [editPara, setEditPara] = useState("");
  const [editCount, setEditCount] = useState("");

  const [ventePage, setVentePage] = useState(1);
  const [venteLimit, setVenteLimit] = useState(20);

  const { payments, isLoading: paymentsLoading } = usePayments();
  const { savePayment, saving } = useSavePayment();
  const { stats: statsMixte, statsLoading: loadingMixte } = usePharmacyStats(dateFrom, dateTo, eCategoryType.ALL);
  const { stats: statsPharma, statsLoading: loadingPharma } = usePharmacyStats(dateFrom, dateTo, eCategoryType.PHARMACIE);
  const { stats: statsPara, statsLoading: loadingPara } = usePharmacyStats(dateFrom, dateTo, eCategoryType.PARAPHARMACIE);

  const { ventesRows, ventesPagination, ventesPageCount, ventesLoading } = useVentesList({
    page: ventePage, limit: venteLimit,
    dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
  });

  const bilanRows = [
    {
      label: "Mixte",
      stats: statsMixte,
      loading: loadingMixte,
      accent: "border-l-primary",
      badge: "bg-primary/10 text-primary",
    },
    {
      label: "Pharmacie",
      stats: statsPharma,
      loading: loadingPharma,
      accent: "border-l-green-500",
      badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    },
    {
      label: "Parapharmacie",
      stats: statsPara,
      loading: loadingPara,
      accent: "border-l-purple-500",
      badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    },
  ] as const;

  const paymentsByMethod = useMemo(() => {
    const map: Record<string, { pharmacie: number; parapharmacie: number; count: number }> = {};
    for (const p of payments) {
      map[p.method] = {
        pharmacie: p.pharmacie_amount,
        parapharmacie: p.parapharmacie_amount,
        count: p.count,
      };
    }
    return map;
  }, [payments]);

  type VenteRow = Record<string, unknown>;
  const venteColumns = useMemo<ColumnDef<VenteRow>[]>(() => [
    { id: "date", accessorKey: "date", size: 110, header: () => <p className="column-title">Date</p>, cell: ({ getValue }) => <span className="text-sm tabular-nums">{(getValue<string>() ?? "—")}</span> },
    { id: "transaction_ref", accessorKey: "transaction_ref", size: 130, header: () => <p className="column-title">N° Transaction</p>, cell: ({ getValue }) => getValue<string>() ? <Badge variant="outline" className="font-mono text-xs">{getValue<string>()}</Badge> : <span className="text-muted-foreground">—</span> },
    { id: "transaction_ref_final", size: 150, header: () => <p className="column-title">N° Transaction Final</p>, cell: ({ row }) => { const r = row.original; return r.transaction_ref_final ? <Badge variant="outline" className="font-mono text-xs">{String(r.transaction_ref_final)}</Badge> : <span className="text-muted-foreground">—</span>; } },
    { id: "client", accessorKey: "client", size: 150, header: () => <p className="column-title">Client</p>, cell: ({ getValue }) => { const v = getValue<string>(); return v ? <span className="text-sm">{v}</span> : <span className="text-muted-foreground text-xs italic">Anonyme</span>; } },
    { id: "product", accessorKey: "product", size: 260, header: () => <p className="column-title">Produit</p>, cell: ({ row }) => <div className="flex flex-col min-w-0"><span className="truncate text-sm font-medium">{String(row.original.product ?? "—")}</span>{row.original.pid ? <span className="text-xs text-muted-foreground font-mono">PID {String(row.original.pid)}</span> : null}</div> },
    { id: "category", accessorKey: "category", size: 170, header: () => <p className="column-title">Catégorie</p>, cell: ({ getValue }) => { const c = getValue<string>(); return c ? <Badge variant="secondary" className="text-xs max-w-[150px] truncate">{c.replace(/\s*\([\d.]+%\)/, "").trim()}</Badge> : <span className="text-muted-foreground">—</span>; } },
    { id: "type", size: 110, header: () => <p className="column-title">Type</p>, cell: ({ row }) => { const cat = (String(row.original.category ?? "")).toLowerCase(); const isPh = cat.includes("edicament") || cat.includes("édicament") || cat.includes("oméopath") || cat.includes("omeopath"); if (!row.original.category) return <span className="text-muted-foreground">—</span>; return <Badge variant="outline" className={isPh ? "text-blue-700 border-blue-300 bg-blue-50 text-xs" : "text-purple-700 border-purple-300 bg-purple-50 text-xs"}>{isPh ? "Pharmacie" : "Parapharmacie"}</Badge>; } },
    { id: "tva", accessorKey: "tva", size: 80, header: () => <p className="column-title">TVA</p>, cell: ({ getValue }) => { const v = getValue<string | null>(); return v ? <Badge variant="outline" className="text-xs font-mono">{v}</Badge> : <span className="text-muted-foreground">—</span>; } },
  ], []);

  const venteTable = useReactTable({
    data: ventesRows as VenteRow[],
    columns: venteColumns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: ventesPageCount,
  });

  const openEdit = (method: string) => {
    const existing = paymentsByMethod[method];
    setEditMethod(method);
    setEditPharma(existing ? String(existing.pharmacie) : "");
    setEditPara(existing ? String(existing.parapharmacie) : "");
    setEditCount(existing ? String(existing.count) : "");
    setDialogOpen(true);
  };

  const handleSave = () => {
    savePayment(
      {
        month: editMonth,
        method: editMethod,
        pharmacie_amount: parseFloat(editPharma) || 0,
        parapharmacie_amount: parseFloat(editPara) || 0,
        count: parseInt(editCount) || 0,
      },
      { onSuccess: () => setDialogOpen(false) },
    );
  };

  return (
    <ListView>
      <Breadcrumb />
      <h1 className="page-title">Comptabilité</h1>
      <p className="text-sm text-muted-foreground -mt-2">
        Saisissez vos encaissements par mode de paiement et consultez votre bilan.
      </p>

      {/* Date range filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Du</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-40 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Au</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-40 text-sm" />
        </div>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" className="h-9 text-muted-foreground mt-5" onClick={() => { setDateFrom(""); setDateTo(""); }}>
            Réinitialiser
          </Button>
        )}
      </div>

      {/* Payment method cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {METHODS.map(({ key, label, icon: Icon, color, bg, border }) => {
          const data = paymentsByMethod[key];
          const total = data ? data.pharmacie + data.parapharmacie : 0;
          return (
            <Card
              key={key}
              className={cn("border cursor-pointer hover:shadow-md transition-shadow", border, bg)}
              onClick={() => openEdit(key)}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <Icon className={cn("h-5 w-5", color)} />
                  {!data && <Plus className="h-4 w-4 text-muted-foreground" />}
                </div>
                <p className="text-sm font-semibold">{label}</p>
                {paymentsLoading ? (
                  <Skeleton className="h-6 w-24 mt-1" />
                ) : data ? (
                  <>
                    <p className="text-xl font-bold mt-1">{fmt(total)} MAD</p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                      <span>Pharma: {fmt(data.pharmacie)}</span>
                      <span>Para: {fmt(data.parapharmacie)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{data.count} transaction{data.count !== 1 ? "s" : ""}</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">Cliquez pour saisir</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Ventes transaction table */}
      <DataTable
        table={venteTable}
        isLoading={ventesLoading}
        pagination={{
          currentPage: ventePage,
          setCurrentPage: setVentePage,
          pageCount: ventesPageCount,
          pageSize: venteLimit,
          setPageSize: (s: number) => { setVenteLimit(s); setVentePage(1); },
          total: ventesPagination?.total,
        }}
        emptyState={<p className="text-sm text-muted-foreground text-center py-8">Aucune transaction de vente.</p>}
      />

      {/* Bilan financier — 3 cards per row (Mixte / Pharmacie / Parapharmacie) */}
      {bilanRows.map((row) => {
        const kpis = row.stats?.kpis;
        const tva = row.stats?.tva;
        const marge = row.stats?.marge;
        const bilan = (kpis?.ventes_total ?? 0) - (kpis?.achats_total ?? 0);

        if (row.loading) return <Skeleton key={row.label} className="h-40 w-full rounded-xl" />;

        return (
          <div key={row.label}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{row.label}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Left: CA + Marge */}
              <Card className="border border-border">
                <CardContent className="p-4 space-y-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Chiffre d'affaires</p>
                    <p className="text-lg font-bold tabular-nums">{fmt(kpis?.ventes_total ?? 0)} MAD</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Marge X</p>
                    <p className="text-sm font-semibold tabular-nums">{marge?.marge_pct != null ? `${marge.marge_pct.toFixed(1)} %` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Marge brute en MAD</p>
                    <p className="text-sm font-semibold tabular-nums">{fmt(marge?.marge_brute_dh ?? 0)} MAD</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">TVA encaissée</p>
                    <p className="text-sm font-semibold tabular-nums">{fmt(tva?.tva_encaissee ?? 0)} MAD</p>
                  </div>
                </CardContent>
              </Card>

              {/* Middle: Achats (blue/purple bg) */}
              <Card className={cn("border", row.label === "Pharmacie" ? "bg-blue-100 border-blue-300 dark:bg-blue-950/40 dark:border-blue-800" : row.label === "Parapharmacie" ? "bg-purple-100 border-purple-300 dark:bg-purple-950/40 dark:border-purple-800" : "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800")}>
                <CardContent className="p-4 space-y-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Achats</p>
                    <p className="text-lg font-bold tabular-nums">{fmt(kpis?.achats_total ?? 0)} MAD</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Opérations</p>
                    <p className="text-sm font-semibold tabular-nums">{kpis?.achats_count ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">TVA payée</p>
                    <p className="text-sm font-semibold tabular-nums">{fmt(tva?.tva_payee ?? 0)} MAD</p>
                  </div>
                </CardContent>
              </Card>

              {/* Right: Bilan (green bg) */}
              <Card className="border bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800">
                <CardContent className="p-4 space-y-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Bilan</p>
                    <p className="text-lg font-bold tabular-nums">CA - Achats = {fmt(bilan)} MAD</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">TVA à déclarer (estimation)</p>
                    <p className="text-sm font-semibold tabular-nums">{fmt(tva?.tva_a_declarer ?? 0)} MAD</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase">Solde TVA année {new Date().getFullYear()}</p>
                    <p className="text-sm font-semibold tabular-nums">{fmt(tva?.tva_a_declarer ?? 0)} MAD</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );
      })}

      {/* Payment edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {METHODS.find((m) => m.key === editMethod)?.label ?? "Paiement"} — {editMonth}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Mois</Label>
              <Input type="month" value={editMonth} onChange={(e) => setEditMonth(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label>Mode de paiement</Label>
              <Select value={editMethod} onValueChange={setEditMethod}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Pharmacie (MAD)</Label>
                <Input type="number" value={editPharma} onChange={(e) => setEditPharma(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Parapharmacie (MAD)</Label>
                <Input type="number" value={editPara} onChange={(e) => setEditPara(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Nombre de transactions</Label>
              <Input type="number" value={editCount} onChange={(e) => setEditCount(e.target.value)} placeholder="0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ListView>
  );
}
