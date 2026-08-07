import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { login, type LoginInput } from "@/api/auth";
import { ApiErr } from "@/api/client";
import { QUERY_KEYS, ROUTES, type MeResponse } from "@/types";

export function useLogin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation<MeResponse, ApiErr, LoginInput>({
    mutationFn: login,
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.ME, data);
      navigate(ROUTES.HOME);
    },
    onError: (err) => {
      toast.error(err.detail);
    },
  });

  const handleLogin = (input: LoginInput) => mutation.mutate(input);

  return {
    handleLogin,
    isPending: mutation.isPending,
    isError:   mutation.isError,
    isSuccess: mutation.isSuccess,
    error:     mutation.error,
  };
}