import { useQuery } from "@tanstack/react-query";

import { getMe } from "@/api/auth";
import { QUERY_KEYS } from "@/types";
import type { Me, MeResponse } from "@/types";

function toFlat(r: MeResponse): Me {
  return {
    id:          String(r.user.id),
    email:       r.user.email,
    name:        r.user.name ?? r.user.email,
    phone:       r.user.phone ?? undefined,
    role:        r.user.role,
    status:      r.user.status,
    pharmacy:    r.pharmacy ? { name: r.pharmacy.name, code: r.pharmacy.code } : undefined,
    permissions: r.permissions,
  };
}

export function useMe() {
  const query = useQuery<MeResponse, Error, Me>({
    queryKey:  QUERY_KEYS.ME,
    queryFn:   getMe,
    select:    toFlat,
    staleTime: 5 * 60 * 1000,
    retry:     false,
  });

  return {
    me:        query.data ?? null,
    isLoading: query.isLoading,
    isError:   query.isError,
    isSuccess: query.isSuccess,
    error:     query.error,
  };
}