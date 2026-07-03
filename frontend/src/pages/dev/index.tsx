/** Route container for /requests — developer dashboard.
 *
 *  Reads the full non-closed queue from `GET /v1/store-website/requests`
 *  and splits into 3 queues client-side. KPIs are derived from the same
 *  payload (no separate endpoint). Claim goes through the real backend
 *  and invalidates the list on success. */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { claimRequest, listRequests } from "@/api/storeWebsite";
import { ApiErr } from "@/api/client";
import { useMe } from "@/hooks/useMe";
import type { DevKpis, DevRequest, Urgency, RequestState } from "@/types/storeWebsite";
import type { WebsiteRequestOut } from "@/types/storeWebsiteApi";

import { DevDashboard } from "./_components/DevDashboard";


const QK_REQUESTS = ["store-website", "requests", "list"] as const;


/** Backend row → dashboard's `DevRequest` shape. */
function toDevRequest(api: WebsiteRequestOut): DevRequest {
  return {
    id:           api.id,
    pharmacyName: api.store_name,
    brandColor:   api.brand_palette[0] ?? "#0E9E8C",
    submittedAt:  api.created_at,
    urgency:      api.urgency as Urgency,
    state:        api.state as RequestState,
    claimedBy:    api.claimed_by
      ? { id: String(api.claimed_by.id), name: api.claimed_by.name }
      : null,
    claimedAt:    api.claimed_at,
  };
}


export default function DevDashboardRoute() {
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const { me }   = useMe();

  const q = useQuery({
    queryKey: QK_REQUESTS,
    queryFn:  listRequests,
  });

  const claimMutation = useMutation({
    mutationFn: (id: string) => claimRequest(id),
    onSuccess:  (fresh) => {
      qc.invalidateQueries({ queryKey: QK_REQUESTS });
      toast.success("Demande réclamée — vous pouvez ouvrir l'éditeur.");
      navigate(`/requests/${fresh.id}`);
    },
    onError: (e) => {
      toast.error(e instanceof ApiErr ? e.detail : "Échec de la réclamation.");
    },
  });

  const { pending, mine, others, kpis } = useMemo(() => {
    const rows = (q.data ?? []).map(toDevRequest);
    const myId = me ? String(me.id) : null;
    const p = rows.filter((r) => r.claimedBy === null);
    const m = rows.filter((r) => r.claimedBy?.id === myId);
    const o = rows.filter((r) => r.claimedBy && r.claimedBy.id !== myId);
    const k: DevKpis = {
      pending:          p.length,
      mineActive:       m.length,
      exportsThisMonth: 0,   // export pipeline is deferred — 0 until the backend ships it
    };
    return { pending: p, mine: m, others: o, kpis: k };
  }, [q.data, me]);

  return (
    <DevDashboard
      kpis={kpis}
      pending={pending}
      mine={mine}
      others={others}
      isLoading={q.isLoading}
      onClaim={(id) => claimMutation.mutate(id)}
      onOpen={(id) => navigate(`/requests/${id}`)}
      onOpenEditor={(id) => navigate(`/requests/${id}/editor`)}
    />
  );
}
