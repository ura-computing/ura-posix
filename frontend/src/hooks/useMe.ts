import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { API } from "@/api/api";

import type { Me, MeResponse } from "@/types";

function toFlat(r: MeResponse): Me {
  return {
    id: String(r.user.id),
    email: r.user.email,
    name: r.user.name ?? r.user.email,
    phone: r.user.phone ?? undefined,
    role: r.user.role,
    status: r.user.status,
    pharmacy: r.pharmacy ? { id: r.pharmacy.id, name: r.pharmacy.name, code: r.pharmacy.code } : undefined,
    permissions: r.permissions,
  };
}

export function useMe() {
  const { data, isLoading, isSuccess, isError, error } = useQuery<MeResponse, Error, Me>({
    queryKey: API.auth.me.key,
    queryFn: () => api.get<MeResponse>(API.auth.me.url),
    select: toFlat,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return {
    me: data ?? null,
    isLoading,
    isError,
    isSuccess,
    error,
  };
}
