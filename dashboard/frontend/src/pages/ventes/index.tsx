import { ShoppingBasket } from "lucide-react";
import { ListView } from "@/components/refine-ui/views/list-view";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const VentesList = () => {
  return (
    <ListView>
      <Breadcrumb />
      <h1 className="page-title">Ventes</h1>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingBasket className="h-4 w-4" />
              Gestion des ventes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              L'historique et la gestion des ventes seront disponibles ici.
            </p>
          </CardContent>
        </Card>
      </div>
    </ListView>
  );
};

export default VentesList;
