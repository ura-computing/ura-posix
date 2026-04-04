import { useState, useMemo } from "react";
import { CreditCard, Banknote, Receipt, ArrowRightLeft, Loader2, Plus } from "lucide-react";

import { ListView } from "@/components/shared/listView";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
import { cn } from "@/utils/cn";
import { fmt } from "@/utils/format";
import { eCategoryType } from "@/types";
import { usePayments, useSavePayment } from "@/hooks/useAccounting";
import { usePharmacyStats } from "@/hooks/usePharmacyRapports";

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

  const { payments, isLoading: paymentsLoading } = usePayments();
  const { savePayment, saving } = useSavePayment();
  const { stats, statsLoading } = usePharmacyStats(dateFrom, dateTo, eCategoryType.ALL);

  const kpis = stats?.kpis;
  const tva = stats?.tva;
  const marge = stats?.marge;

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

      {/* Bilan financier */}
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-base">Bilan financier</CardTitle>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Chiffre d'affaires</p>
                <p className="text-2xl font-bold">{fmt(kpis?.ventes_total ?? null)} MAD</p>
                <p className="text-[10px] text-muted-foreground/60 font-mono">PPV × qté vendue</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total achats</p>
                <p className="text-2xl font-bold">{fmt(kpis?.achats_total ?? null)} MAD</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Résultat brut</p>
                <p className={cn("text-2xl font-bold", (kpis?.ventes_total ?? 0) - (kpis?.achats_total ?? 0) >= 0 ? "text-green-600" : "text-red-600")}>
                  {fmt((kpis?.ventes_total ?? 0) - (kpis?.achats_total ?? 0))} MAD
                </p>
                <p className="text-[10px] text-muted-foreground/60 font-mono">CA − Achats</p>
              </div>
            </div>
          )}

          {!statsLoading && tva && (
            <>
              <Separator className="my-4" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">TVA encaissée</p>
                  <p className="text-lg font-semibold">{fmt(tva.tva_encaissee)} MAD</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">TVA payée</p>
                  <p className="text-lg font-semibold">{fmt(tva.tva_payee)} MAD</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">TVA à déclarer</p>
                  <p className="text-lg font-semibold">{fmt(tva.tva_a_declarer)} MAD</p>
                  <p className="text-[10px] text-muted-foreground/60 font-mono">estimation</p>
                </div>
              </div>
            </>
          )}

          {!statsLoading && marge && (
            <>
              <Separator className="my-4" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Marge %</p>
                  <p className="text-lg font-semibold">{marge.marge_pct?.toFixed(1)}%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Marge brute</p>
                  <p className="text-lg font-semibold">{fmt(marge.marge_brute_dh)} MAD</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Marge nette</p>
                  <p className="text-lg font-semibold">{fmt(marge.marge_nette_dh)} MAD</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
