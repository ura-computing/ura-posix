import { Package } from "lucide-react";
import { ListView } from "@/components/refine-ui/views/list-view";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";

const StockList = () => {
  return (
    <ListView>
      <Breadcrumb />
      <h1 className="page-title">Stock</h1>

      <div className="flex flex-1 items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-6 text-center max-w-sm pointer-events-none select-none">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-teal-500/10 border-2 border-teal-500/20">
            <Package className="h-12 w-12 text-teal-500" />
          </div>
          <div className="space-y-2">
            <span className="inline-flex items-center rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-950 dark:border-teal-800 dark:text-teal-300">
              Bientôt disponible
            </span>
            <h2 className="text-2xl font-bold text-foreground mt-2">Gestion des stocks</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Les alertes de stock minimum et maximum, ainsi que le suivi des niveaux d'inventaire, seront disponibles dans une prochaine version.
            </p>
          </div>
        </div>
      </div>
    </ListView>
  );
};

export default StockList;
