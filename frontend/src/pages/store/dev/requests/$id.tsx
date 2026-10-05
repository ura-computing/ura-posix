/** Route container for /requests/:id (developer request detail).
 *
 *  Fetches the full request (brief + customization) via
 *  `GET /v1/store-website/requests/{id}` and wires claim / release /
 *  state-transition actions to real backend endpoints. */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@/api/client";
import { useT } from "@/i18n/I18nProvider";
import { API } from "@/api/api";
import { useMe } from "@/hooks/useMe";

import type { RequestBrief, RequestState, Urgency } from "@/types/storeWebsite";
import type { WebsiteRequestOut, WebsiteRequestWithCustomizationOut } from "@/types/storeWebsite";

import { RequestDetailPage } from "../_components/RequestDetailPage";

function toBrief(api: WebsiteRequestWithCustomizationOut, meId: string | null): RequestBrief {
  return {
    id: api.id,
    pharmacyName: api.store_name,
    ownerName: "Propriétaire", // owner_name isn't in the safe list — dev calls the phone anyway
    ownerPhone: api.phone,
    storeName: api.store_name,
    slogan: api.slogan ?? "",
    logoUrl: api.customization.logo_url,
    brandPalette: api.brand_palette,
    customDomain: api.custom_domain,
    urgency: api.urgency as Urgency,
    vision: api.vision ?? "",
    state: api.state as RequestState,
    claimedByMe: api.claimed_by ? String(api.claimed_by.id) === meId : false,
    categories: [], // categories now live on the owner-managed featured list; fetched separately
    soldes: [], // owner Tab 3 products not wired to backend yet
  };
}

export default function DevRequestDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { me } = useMe();
  const t = useT();

  const q = useQuery({
    queryKey: API.storeWebsite.request.key(id ?? "noop"),
    queryFn: () => api.get<WebsiteRequestWithCustomizationOut>(API.storeWebsite.request.url(id!)),
    enabled: !!id,
    retry: false,
  });

  const brief = useMemo(() => (q.data ? toBrief(q.data, me ? String(me.id) : null) : null), [q.data, me]);

  const claimM = useMutation({
    mutationFn: () => api.post<WebsiteRequestOut>(API.storeWebsite.claim.url(id!)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: API.storeWebsite.request.key(id!) });
      toast.success(t("store.claimed"));
    },
  });
  const releaseM = useMutation({
    mutationFn: () => api.post<WebsiteRequestOut>(API.storeWebsite.release.url(id!)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: API.storeWebsite.request.key(id!) });
      toast.success(t("store.released"));
    },
  });
  const stateM = useMutation({
    mutationFn: (state: RequestState) => api.patch<WebsiteRequestOut>(API.storeWebsite.state.url(id!), { state }),
    onSuccess: (fresh) => {
      qc.invalidateQueries({ queryKey: API.storeWebsite.request.key(id!) });
      toast.success(t("store.stateUpdated", { state: fresh.state }));
    },
  });

  if (q.isLoading) {
    return <div className="flex flex-col gap-6 p-2 text-sm text-muted-foreground">Chargement…</div>;
  }

  if (!brief) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col gap-3 p-7 text-center">
        <h2 className="text-lg font-semibold">Demande introuvable</h2>
        <p className="text-sm text-muted-foreground">Retournez au tableau des demandes.</p>
      </div>
    );
  }

  return (
    <RequestDetailPage
      brief={brief}
      onClaim={() => claimM.mutate()}
      onRelease={() => releaseM.mutate()}
      onMarkInProgress={() => stateM.mutate("en_cours")}
      onMarkDelivered={() => stateM.mutate("livree")}
      onClose={() => stateM.mutate("cloturee")}
      onOpenEditor={(rid) => navigate(`/requests/${rid}/editor`)}
    />
  );
}
