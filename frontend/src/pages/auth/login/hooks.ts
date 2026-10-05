import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { ApiErr, api } from "@/api/client";
import { API } from "@/api/api";
import { ROUTES, type LoginRequest, type MeResponse } from "@/types";

export function useLogin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, isSuccess, error } = useMutation<MeResponse, ApiErr, LoginRequest>({
    mutationFn: (input) => api.post<MeResponse>(API.auth.login.url, input),
    onSuccess: (data) => {
      queryClient.setQueryData(API.auth.me.key, data);
      navigate(ROUTES.HOME);
    },
    onError: (err) => {
      toast.error(err.detail);
    },
  });

  const handleLogin = (input: LoginRequest) => mutate(input);

  return {
    handleLogin,
    isPending,
    isError,
    isSuccess,
    error,
  };
}
