import { useQuery } from "@tanstack/react-query";

import { validateToken } from "@/api/auth";
import { QUERY_KEYS } from "@/types";

export function useValidateToken(token: string) {
  const query = useQuery({
    queryKey: QUERY_KEYS.VALIDATE_TOKEN(token),
    queryFn:  () => validateToken(token),
    enabled:  token.length > 0,
    retry:    false,
    // Matches backend RESET_TOKEN_EXPIRY_MIN. A user who opens the link, walks
    // away for >60 min, then refocuses the tab triggers a refetch which will
    // 400 the now-expired token and render the "expired link" state instead of
    // a stale-valid form.
    staleTime: 60 * 60 * 1000,
  });

  return {
    isValidating: token.length > 0 && query.isLoading,
    isValid:      query.isSuccess,
    isSetup:      query.data?.is_setup  ?? false,
    fullName:     query.data?.full_name ?? "",
  };
}