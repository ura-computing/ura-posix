import { useState } from "react";
import { Settings, Trash2, AlertTriangle } from "lucide-react";
import { ListView } from "@/components/refine-ui/views/list-view";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useClearAchats, useClearVentes } from "@/hooks/use-clear-data";

type ClearTarget = "achats" | "ventes" | null;

const ParametresList = () => {
  const [confirming, setConfirming] = useState<ClearTarget>(null);

  const clearAchats = useClearAchats();
  const clearVentes = useClearVentes();

  const handleClear = (target: "achats" | "ventes") => {
    const mutation = target === "achats" ? clearAchats : clearVentes;
    mutation.mutate(undefined, { onSettled: () => setConfirming(null) });
  };

  const isLoading = clearAchats.isPending || clearVentes.isPending;
  const lastResult = clearAchats.isSuccess
    ? { target: "achats" as ClearTarget, deleted: clearAchats.data.deleted }
    : clearVentes.isSuccess
    ? { target: "ventes" as ClearTarget, deleted: clearVentes.data.deleted }
    : clearAchats.isError
    ? { target: "achats" as ClearTarget, deleted: -1 }
    : clearVentes.isError
    ? { target: "ventes" as ClearTarget, deleted: -1 }
    : null;

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

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Zone de danger
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ces actions sont irréversibles. Toutes les données supprimées ne peuvent pas être récupérées.
            </p>

            {/* Clear Achats */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">Supprimer tous les achats</p>
                <p className="text-xs text-muted-foreground">Efface toutes les lignes d'achat de la base de données.</p>
              </div>
              {confirming === "achats" ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isLoading}
                    onClick={() => handleClear("achats")}
                  >
                    {clearAchats.isPending ? "Suppression..." : "Confirmer"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirming(null)}>
                    Annuler
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                  onClick={() => { clearAchats.reset(); clearVentes.reset(); setConfirming("achats"); }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Supprimer
                </Button>
              )}
            </div>

            {/* Clear Ventes */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">Supprimer toutes les ventes</p>
                <p className="text-xs text-muted-foreground">Efface toutes les lignes de vente de la base de données.</p>
              </div>
              {confirming === "ventes" ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isLoading}
                    onClick={() => handleClear("ventes")}
                  >
                    {clearVentes.isPending ? "Suppression..." : "Confirmer"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirming(null)}>
                    Annuler
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                  onClick={() => { clearAchats.reset(); clearVentes.reset(); setConfirming("ventes"); }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Supprimer
                </Button>
              )}
            </div>

            {lastResult && (
              <p className={`text-sm mt-2 ${lastResult.deleted >= 0 ? "text-teal-600" : "text-destructive"}`}>
                {lastResult.deleted >= 0
                  ? `${lastResult.deleted} enregistrement(s) supprimé(s) de ${lastResult.target}.`
                  : `Erreur lors de la suppression des ${lastResult.target}.`}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </ListView>
  );
};

export default ParametresList;
