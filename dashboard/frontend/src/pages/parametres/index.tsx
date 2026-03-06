import { Settings } from "lucide-react";
import { ListView } from "@/components/refine-ui/views/list-view";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ParametresList = () => {
  return (
    <ListView>
      <Breadcrumb />
      <h1 className="page-title">Paramètres</h1>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4" />
              Configuration de la pharmacie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Les paramètres de la pharmacie seront disponibles ici.
            </p>
          </CardContent>
        </Card>
      </div>
    </ListView>
  );
};

export default ParametresList;
