import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QUERY_KEYS } from "@/constants";

export function useMe() {
  return useQuery({
    queryKey: QUERY_KEYS.me,
    queryFn: api.auth.me,
    staleTime: 0,
  });
}
