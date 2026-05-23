import { useAdminSpecialProducts } from "@/hooks/useAdminCatalogRequests";
import { History } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { PageLoader } from "@/components/shared/pageLoader";
import { ListView } from "@/components/shared/listView";
import { Breadcrumb } from "@/components/layout/breadcrumb";

export default function AdminCatalogRequestsPage() {
  const { products, productsLoading } = useAdminSpecialProducts();

  return (
    <ListView>
      <Breadcrumb />

      <div>
        <h1 className="page-title">Produits spéciaux</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Produits exclus des rapports par les pharmacies. Liste consultative — les exclusions
          s'appliquent immédiatement, aucune validation n'est requise.
        </p>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card">
        {productsLoading ? (
          <PageLoader />
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <History className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Aucun produit spécial</p>
              <p className="text-xs text-muted-foreground mt-1">
                Aucune pharmacie n'a encore exclu de produit de ses rapports.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-2.5 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span>Produit</span>
              <span className="w-44">Pharmacie</span>
              <span className="w-28 text-center">Exclu le</span>
            </div>
            {products.map((p) => (
              <div key={`${p.pharmacy_id}:${p.medicament_id}`} className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto] gap-3 sm:gap-4 px-5 py-3.5 items-start sm:items-center">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.product}</p>
                </div>
                <div className="w-44 min-w-0">
                  <p className="text-sm truncate">{p.pharmacy_name ?? "—"}</p>
                </div>
                <span className="text-xs text-muted-foreground w-28 text-center">
                  {p.created_at ? format(new Date(p.created_at), "d MMM yyyy", { locale: fr }) : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </ListView>
  );
}
