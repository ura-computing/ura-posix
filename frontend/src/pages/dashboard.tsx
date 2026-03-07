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
import {  Pencil, ShoppingCart, Package, TriangleAlert, TrendingUp, UploadCloud } from "lucide-react";
import { Link } from "react-router";

const Dashboard = () => {
  const kpis = MOCK_KPIS;
  const rows = MOCK_INVOICE_ROWS;

  return (
    <div className="space-y-6">
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
