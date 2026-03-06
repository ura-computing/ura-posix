import { TriangleAlert } from "lucide-react";
import { ListView } from "@/components/refine-ui/views/list-view";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const StockList = () => {
  return (
    <ListView>
      <Breadcrumb />
      <h1 className="page-title">Alertes Stock</h1>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TriangleAlert className="h-4 w-4" />
              Alertes de stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Les alertes de stock minimum et maximum seront affichées ici.
            </p>
          </CardContent>
        </Card>
      </div>
    </ListView>
  );
};

export default StockList;
