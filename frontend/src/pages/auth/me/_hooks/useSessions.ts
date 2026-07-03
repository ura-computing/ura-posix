import { useQuery } from "@tanstack/react-query";

import { listSessions } from "@/api/sessions";
import { QUERY_KEYS } from "@/types";

export function useSessions(userId: string) {
  const query = useQuery({
    queryKey: QUERY_KEYS.SESSIONS(userId),
    queryFn:  listSessions,
    staleTime: 30_000,
  });

  return {
    sessions:  query.data ?? [],
    isLoading: query.isLoading,
    isError:   query.isError,
    error:     query.error,
  };
}