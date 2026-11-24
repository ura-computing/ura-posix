/** One online-store request (Support): read it, take it, give it back, move it to the next step. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/api/client";
import { API, refresh } from "@/api/api";
import { useMe } from "@/hooks/useMe";
import { useT } from "@/i18n/I18nProvider";
import {
  REQUEST_STATE_LABEL,
  type RequestState,
  type WebsiteRequestOut,
  type WebsiteRequestPatch,
  type WebsiteRequestWithCustomizationOut,
} from "@/types/storeWebsite";

/** The request + its customization. `isMine`: I took it (only I can edit it / move it forward). */
export function useStoreRequest(id: string) {
  const { me } = useMe();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.storeWebsite.request.key(id),
    queryFn: () => api.get<WebsiteRequestWithCustomizationOut>(API.storeWebsite.request.url(id)),
    retry: false,
  });
  return {
    request: data,
    isMine: !!data?.claimed_by && String(data.claimed_by.id) === me?.id,
    isLoading,
    isError,
    reload: () => void refetch(),
  };
}

export function useRequestActions(id: string) {
  const qc = useQueryClient();
  const t = useT();
  const claim = useMutation({
    mutationFn: () => api.post<WebsiteRequestOut>(API.storeWebsite.claim.url(id)),
    onSuccess: () => {
      toast.success(t("store.claimed"));
      void refresh(qc, API.storeWebsite.claim);
    },
  });
  const release = useMutation({
    mutationFn: () => api.post<WebsiteRequestOut>(API.storeWebsite.release.url(id)),
    onSuccess: () => {
      toast.success(t("store.released"));
      void refresh(qc, API.storeWebsite.release);
    },
  });
  const moveTo = useMutation({
    mutationFn: (state: RequestState) => api.patch<WebsiteRequestOut>(API.storeWebsite.state.url(id), { state }),
    onSuccess: (fresh) => {
      toast.success(t("store.stateUpdated", { state: t(REQUEST_STATE_LABEL[fresh.state]) }));
      void refresh(qc, API.storeWebsite.state);
    },
  });
  return {
    claimRequest: claim.mutateAsync,
    releaseRequest: release.mutateAsync,
    moveRequestTo: moveTo.mutateAsync,
    isBusy: claim.isPending || release.isPending || moveTo.isPending,
  };
}

/** Support corrects what the owner sent (name, slogan, WhatsApp, domain): any step. */
export function useEditBrief(id: string) {
  const qc = useQueryClient();
  const t = useT();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: (body: WebsiteRequestPatch) => api.patch<WebsiteRequestOut>(API.storeWebsite.brief.url(id), body),
    onSuccess: () => {
      toast.success(t("myStore.saved"));
      void refresh(qc, API.storeWebsite.brief);
    },
  });
  return {
    editBrief: mutateAsync,
    isEditingBrief: isPending,
  };
}
