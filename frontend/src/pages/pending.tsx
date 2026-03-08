import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetIdentity, useLogout } from "@refinedev/core";
import type { User } from "@/types";

export default function PendingApproval() {
  const { data: identity } = useGetIdentity<User>();
  const { mutate: logout } = useLogout();

  const isEmployee = identity?.role === "employee";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Clock className="h-8 w-8 text-primary" />
          </div>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Compte en attente</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {isEmployee
              ? "Votre demande d'accès a été transmise au propriétaire de la pharmacie. Vous serez notifié dès qu'elle sera approuvée."
              : "Votre demande d'inscription en tant que propriétaire de pharmacie est en cours d'examen par notre équipe. Vous serez contacté sous peu."}
          </p>
        </div>

        {/* Status badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          En attente d'approbation
        </div>

        {/* Logout */}
        <div className="pt-2">
          <Button
            variant="outline"
            onClick={() => logout()}
            className="w-full max-w-xs"
          >
            Se déconnecter
          </Button>
        </div>
      </div>
    </div>
  );
}
