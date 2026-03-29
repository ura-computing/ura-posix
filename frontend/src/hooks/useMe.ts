import { useQuery } from "@tanstack/react-query";
import { me as meFn } from "@/api/auth";
import { QUERY_KEYS } from "@/constants";
import { hasSession } from "@/utils/session";

export function useMe() {
  const { data: me, isPending: mePending, error: meError, isLoading: meLoading } = useQuery({
    queryKey: QUERY_KEYS.me,
    queryFn: meFn,
    staleTime: 0,
    enabled: hasSession(),
  });
  return { me, mePending, meError, meLoading };
}
