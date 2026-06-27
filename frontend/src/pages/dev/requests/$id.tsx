/** Route container for /requests/:id (developer request detail). */
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { getMockBrief } from "@/fixtures/storeWebsite";

import { RequestDetailPage } from "../_components/RequestDetailPage";


export default function DevRequestDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const brief = id ? getMockBrief(id) : null;

  if (!brief) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-3 p-7 text-center">
        <h2 className="text-lg font-semibold">Demande introuvable</h2>
        <p className="text-sm text-muted-foreground">Retournez au tableau des demandes.</p>
      </div>
    );
  }

  const stub = (label: string) => () => toast.info(`${label} simulé — backend à venir`);

  return (
    <RequestDetailPage
      brief={brief}
      onClaim={stub("Réclamation")}
      onRelease={stub("Libération")}
      onMarkInProgress={stub("Passage en cours")}
      onMarkDelivered={stub("Marquage livrée")}
      onClose={stub("Clôture")}
      onOpenEditor={(rid) => navigate(`/requests/${rid}/editor`)}
    />
  );
}
