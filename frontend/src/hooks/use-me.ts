import { useQuery } from "@tanstack/react-query";
import { me } from "@/api/auth";
import { QUERY_KEYS } from "@/constants";
import { hasSession } from "@/utils/session";

export function useMe() {
  return useQuery({
    queryKey: QUERY_KEYS.me,
    queryFn: me,
    staleTime: 0,
    enabled: hasSession(),
  });
}
