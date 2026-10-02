import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useT } from "@/i18n/I18nProvider";

import { ApiErr, api } from "@/api/client";
import { URLS } from "@/api/urls";
import { QUERIES } from "@/api/queries";
import { ROUTES, type ValidateTokenResponse } from "@/types";

export function useSetPassword(token: string) {
  const t = useT();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: (input: { password: string }) => api.post<void>(URLS.auth.setPassword, { token, password: input.password }),
    onSuccess: () => {
      toast.success(t("toast.pwdSaved"));
      navigate(ROUTES.LOGIN, { replace: true });
    },
    onError: (err: ApiErr) => {
      toast.error(err.detail || t("toast.linkExpired"));
    },
  });

  const handleSetPassword = (input: { password: string }) => mutation.mutate(input);

  return {
    handleSetPassword,
    isPending: mutation.isPending,
    isError:   mutation.isError,
    error:     mutation.error,
  };
}

export function useValidateToken(token: string) {
  const query = useQuery({
    queryKey: QUERIES.auth.validateToken(token),
    queryFn:  () => api.get<ValidateTokenResponse>(URLS.auth.validateToken, { params: { token } }),
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
