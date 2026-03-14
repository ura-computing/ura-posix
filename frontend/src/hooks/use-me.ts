import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QUERY_KEYS, TOKEN_KEY } from "@/constants";

export function useMe() {
  return useQuery({
    queryKey: QUERY_KEYS.me,
    queryFn: api.auth.me,
    staleTime: 0,
    enabled: !!sessionStorage.getItem(TOKEN_KEY),
  });
}
