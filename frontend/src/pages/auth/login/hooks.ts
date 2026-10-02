import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { ApiErr, api } from "@/api/client";
import { URLS } from "@/api/urls";
import { QUERY_KEYS, ROUTES, type LoginRequest, type MeResponse } from "@/types";

export function useLogin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation<MeResponse, ApiErr, LoginRequest>({
    mutationFn: (input) => api.post<MeResponse>(URLS.auth.login, input),
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.ME, data);
      navigate(ROUTES.HOME);
    },
    onError: (err) => {
      toast.error(err.detail);
    },
  });

  const handleLogin = (input: LoginRequest) => mutation.mutate(input);

  return {
    handleLogin,
    isPending: mutation.isPending,
    isError:   mutation.isError,
    isSuccess: mutation.isSuccess,
    error:     mutation.error,
  };
}