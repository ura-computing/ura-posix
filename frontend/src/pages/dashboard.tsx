import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MOCK_KPIS,
  MOCK_INVOICE_ROWS,
  formatCurrency,
} from "@/data/mock-dashboard";
import { Clock, LogOut, Pencil, ShoppingCart, Package, TriangleAlert, TrendingUp, UploadCloud, XCircle } from "lucide-react";
import { Link } from "react-router";
import { useGetIdentity, useLogout } from "@refinedev/core";
import type { User } from "@/types";

function PendingNotice({ role, status }: { role: "owner" | "employee"; status: "pending" | "rejected" }) {
  const { mutate: logout, isPending: isLoggingOut } = useLogout();

  const isRejected = status === "rejected";

  return (
    <div className={`flex items-start justify-between gap-4 rounded-xl border px-5 py-4 ${
      isRejected
        ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
        : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
    }`}>
      <div className="flex items-start gap-3">
        {isRejected
          ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          : <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        }
        <div>
          <p className={`text-sm font-semibold ${isRejected ? "text-red-800 dark:text-red-300" : "text-amber-800 dark:text-amber-300"}`}>
            {isRejected ? "Compte refusé" : "Compte en attente d'approbation"}
          </p>
          <p className={`mt-0.5 text-sm ${isRejected ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
            {isRejected
              ? (role === "employee"
                  ? "Votre demande a été refusée. Contactez le propriétaire de votre pharmacie pour plus d'informations."
                  : "Votre demande a été refusée. Contactez l'administrateur pour plus d'informations.")
              : (role === "employee"
                  ? "Contactez le propriétaire de votre pharmacie pour valider votre compte."
                  : "Contactez l'administrateur pour valider votre compte.")
            }
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => logout()}
        disabled={isLoggingOut}
        className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
          isRejected
            ? "text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900"
            : "text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900"
        }`}
      >
        <LogOut className="h-3.5 w-3.5" />
        {isLoggingOut ? "..." : "Se déconnecter"}
      </button>
    </div>
  );
}

const Dashboard = () => {
  const { data: identity } = useGetIdentity<User>();
  const isPending = identity?.status !== "active";
  const kpis = MOCK_KPIS;
  const rows = MOCK_INVOICE_ROWS;

  return (
    <div className="space-y-6">
      {isPending && identity && identity.role !== "admin" && (
        <PendingNotice role={identity.role as "owner" | "employee"} status={identity.status as "pending" | "rejected"} />
      )}
      <section>
        <h2 className="text-lg font-semibold text-foreground">Aperçu Rapide</h2>
        <p className="text-sm text-muted-foreground mb-4">Résumé de l'activité du jour</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-teal-500 text-white border-0 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-medium text-white/85">Ventes du Jour</p>
                  <p className="text-3xl font-bold mt-1 leading-tight">
                    {formatCurrency(kpis.salesToday.amount).replace(" MAD", "")}
                  </p>
                  <p className="text-[11px] text-white/75">MAD</p>
                  <p className="text-[11px] text-white/70 mt-2 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {kpis.salesToday.trend.comparison}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-white/60 shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">produit para</p>
                  <p className="text-3xl font-bold mt-1 leading-tight">{kpis.productPara.value}</p>
                  <p className="text-[11px] text-teal-600 flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3" />
                    {kpis.productPara.trend.value}% {kpis.productPara.trend.comparison}
                  </p>
                </div>
                <ShoppingCart className="h-8 w-8 text-teal-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">Produits pharma</p>
                  <p className="text-3xl font-bold mt-1 leading-tight">{kpis.productPharma.value}</p>
                </div>
                <Package className="h-8 w-8 text-teal-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">pahrama sspec</p>
                  <p className="text-3xl font-bold mt-1 leading-tight">{kpis.pharmaSpec.value}</p>
                  {kpis.pharmaSpec.subtitle && (
                    <p className="text-[11px] text-muted-foreground mt-1">{kpis.pharmaSpec.subtitle}</p>
                  )}
                </div>
                <TriangleAlert className="h-8 w-8 text-teal-500" />
              </div>
            </CardContent>
          </Card>
        </div>
        <Link
          to="/dashboard/upload-file"
          className="group mt-5 flex items-center gap-4 rounded-2xl border-2 border-dashed border-[#14b8a6]/40 bg-[#14b8a6]/5 px-6 py-5 transition-all hover:border-[#14b8a6] hover:bg-[#14b8a6]/10"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#14b8a6]/15 group-hover:bg-[#14b8a6]/25 transition-colors">
            <UploadCloud className="h-6 w-6 text-[#14b8a6]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Importer un fichier Sobrus</p>
            <p className="text-xs text-muted-foreground mt-0.5">Achats (bons de livraison) ou Ventes — format CSV</p>
          </div>
          <div className="ml-auto shrink-0 text-[#14b8a6] opacity-60 group-hover:opacity-100 transition-opacity">
            →
          </div>
        </Link>
      </section>

      <section>
        <Card className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-12">
                  <Checkbox aria-label="Tout sélectionner" />
                </TableHead>
                <TableHead>Avatar & Text</TableHead>
                <TableHead>facture number</TableHead>
                <TableHead className="w-24">Tag</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Checkbox aria-label={`Sélectionner ${row.invoiceNumber}`} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className={`text-xs text-white ${row.avatarColor}`}>{row.username.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{row.username}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.invoiceNumber}</TableCell>
                  <TableCell>
                    {row.status === "new" && (
                      <Badge className="bg-violet-100 text-violet-600 hover:bg-violet-100 border-0">New tag</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                      aria-label="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
};

export default Dashboard;
