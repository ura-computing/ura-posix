import { TriangleAlert } from "lucide-react";
import { ListView } from "@/components/refine-ui/views/list-view";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const StockList = () => {
  return (
    <ListView>
      <Breadcrumb />
      <h1 className="page-title">Alertes Stock</h1>

      <div className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center pointer-events-none select-none">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
              <TriangleAlert className="h-8 w-8 text-amber-500" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold text-foreground">Alertes de stock</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                Les alertes de stock minimum et maximum seront affichées ici une fois la fonctionnalité disponible.
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">
              Bientôt disponible
            </Badge>
          </CardContent>
        </Card>
      </div>
    </ListView>
  );
};

export default StockList;
