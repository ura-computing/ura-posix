/** « Boutiques en ligne » (Support): every open request, split in 3 lists, and « Prendre en charge ». */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/api/client";
import { API, refresh } from "@/api/api";
import { useMe } from "@/hooks/useMe";
import { useT } from "@/i18n/I18nProvider";
import type { WebsiteRequestOut } from "@/types/storeWebsite";

/** `toDo`: nobody took it · `mine`: taken by me · `others`: taken by another Support person. */
export function useStoreRequests() {
  const { me } = useMe();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.storeWebsite.requests.key,
    queryFn: () => api.get<WebsiteRequestOut[]>(API.storeWebsite.requests.url),
  });
  const rows = data ?? [];
  const isMine = (r: WebsiteRequestOut) => String(r.claimed_by?.id) === me?.id;
  return {
    toDo: rows.filter((r) => !r.claimed_by),
    mine: rows.filter((r) => r.claimed_by && isMine(r)),
    others: rows.filter((r) => r.claimed_by && !isMine(r)),
    isLoading,
    isError,
    reload: () => void refetch(),
  };
}

/** « Prendre en charge »: the request becomes mine (queue + its page refresh). */
export function useClaimRequest() {
  const qc = useQueryClient();
  const t = useT();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: (id: string) => api.post<WebsiteRequestOut>(API.storeWebsite.claim.url(id)),
    onSuccess: () => {
      toast.success(t("store.claimed"));
      void refresh(qc, API.storeWebsite.claim);
    },
  });
  return {
    claimRequest: mutateAsync,
    isClaiming: isPending,
  };
}
