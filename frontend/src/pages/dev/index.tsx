/** Route container for /requests — developer dashboard.
 *
 *  Reads the 3 queues + KPIs from `@/fixtures/storeWebsite`. Claim / open /
 *  open-editor handlers are wired to react-router navigation. */
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import {
  MOCK_DEV_KPIS, MOCK_DEV_REQUESTS, MOCK_ME_DEVELOPER,
} from "@/fixtures/storeWebsite";

import { DevDashboard } from "./_components/DevDashboard";


export default function DevDashboardRoute() {
  const navigate = useNavigate();

  const pending = MOCK_DEV_REQUESTS.filter((r) => r.claimedBy === null);
  const mine    = MOCK_DEV_REQUESTS.filter((r) => r.claimedBy?.id === MOCK_ME_DEVELOPER.id);
  const others  = MOCK_DEV_REQUESTS.filter(
    (r) => r.claimedBy && r.claimedBy.id !== MOCK_ME_DEVELOPER.id,
  );

  return (
    <DevDashboard
      kpis={MOCK_DEV_KPIS}
      pending={pending}
      mine={mine}
      others={others}
      onClaim={(id) => {
        toast.success("Demande réclamée — vous pouvez ouvrir l'éditeur.");
        navigate(`/requests/${id}`);
      }}
      onOpen={(id) => navigate(`/requests/${id}`)}
      onOpenEditor={(id) => navigate(`/requests/${id}/editor`)}
    />
  );
}
