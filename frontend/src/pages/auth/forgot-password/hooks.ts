import { useMutation } from "@tanstack/react-query";

import { api } from "@/api/client";
import { API } from "@/api/api";
import type { ForgotPasswordRequest } from "@/types";

export function useForgotPassword() {
  const { mutate, isPending, isSuccess, isError, error } = useMutation({
    mutationFn: (input: ForgotPasswordRequest) => api.post<{ detail: string }>(API.auth.forgotPassword.url, input),
    // Backend always returns 200 regardless of whether the email exists (no leak),
    // so isSuccess is enough to switch to the confirmation screen — no toast needed.
    // Errors: global toast (main.tsx).
  });

  const handleForgot = (input: ForgotPasswordRequest) => mutate(input);

  return {
    handleForgot,
    isPending,
    isSuccess,
    isError,
    error,
  };
}
