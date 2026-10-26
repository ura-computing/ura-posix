import { useQuery } from "@tanstack/react-query";

import { api, type ApiErr } from "@/api/client";
import { API } from "@/api/api";
import type { MeResponse } from "@/types";

/** The PharmaGest account of the session open in the browser (same read as the app's `useMe`). */
export function useMe() {
  const { data, isLoading, error } = useQuery<MeResponse, ApiErr>({
    queryKey: API.auth.me.key,
    queryFn: () => api.get<MeResponse>(API.auth.me.url),
    staleTime: 60 * 1000,
    retry: false,
  });

  return {
    me: data ?? null,
    isLoading,
    error,
  };
}
