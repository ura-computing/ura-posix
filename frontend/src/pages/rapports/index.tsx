import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  MOCK_KPIS,
  MOCK_PAYMENT_METHODS,
  formatCurrency,
} from "@/data/mock-dashboard";
import { ShoppingCart, Package, TriangleAlert, TrendingUp, FileText } from "lucide-react";

export default function RapportsPage() {
  const kpis = MOCK_KPIS;
  const paymentMethods = MOCK_PAYMENT_METHODS;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold text-foreground">Aperçu Rapide</h2>
        <p className="text-sm text-muted-foreground mb-4">Résumé de l'activité du jour</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-teal-500 text-white border-0 overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-white/90">Ventes du Jour</p>
                  <p className="text-2xl font-bold mt-1">
                    {formatCurrency(kpis.salesToday.amount).replace(" MAD", "")}
                  </p>
                  <p className="text-sm text-white/80">MAD</p>
                  <p className="text-xs text-white/70 mt-2 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {kpis.salesToday.trend.comparison}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-white/60 shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">produit para</p>
                  <p className="text-2xl font-bold mt-1">{kpis.productPara.value}</p>
                  <p className="text-xs text-teal-600 flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3" />
                    {kpis.productPara.trend.value}% {kpis.productPara.trend.comparison}
                  </p>
                </div>
                <ShoppingCart className="h-8 w-8 text-teal-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Produits pharma</p>
                  <p className="text-2xl font-bold mt-1">{kpis.productPharma.value}</p>
                </div>
                <Package className="h-8 w-8 text-teal-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">pahrama sspec</p>
                  <p className="text-2xl font-bold mt-1">{kpis.pharmaSpec.value}</p>
                  {kpis.pharmaSpec.subtitle && (
                    <p className="text-xs text-muted-foreground mt-1">{kpis.pharmaSpec.subtitle}</p>
                  )}
                </div>
                <TriangleAlert className="h-8 w-8 text-teal-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">Mode de Paiement</h2>
        <Card className="max-w-4xl rounded-xl border border-border">
          <CardContent className="p-6 space-y-5">
            {paymentMethods.map((method) => (
              <div key={method.id} className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: method.color }}
                    >
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    <p className="text-sm font-medium">{method.name}</p>
                  </div>
                  <p className="text-sm font-semibold">{formatCurrency(method.amount)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Progress
                    value={method.percentage}
                    className="flex-1 h-2 bg-muted"
                    style={{ ["--progress-background"]: method.color } as React.CSSProperties}
                  />
                  <span className="text-xs text-muted-foreground w-10 text-right">{method.percentage}%</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
