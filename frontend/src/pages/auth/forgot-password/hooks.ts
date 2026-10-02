import { useMutation } from "@tanstack/react-query";

import { api } from "@/api/client";
import { URLS } from "@/api/urls";
import type { ForgotPasswordRequest } from "@/types";

export function useForgotPassword() {
  const mutation = useMutation({
    mutationFn: (input: ForgotPasswordRequest) => api.post<{ detail: string }>(URLS.auth.forgotPassword, input),
    // Backend always returns 200 regardless of whether the email exists (no leak),
    // so isSuccess is enough to switch to the confirmation screen — no toast needed.
    // Errors: global toast (main.tsx).
  });

  const handleForgot = (input: ForgotPasswordRequest) => mutation.mutate(input);

  return {
    handleForgot,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError:   mutation.isError,
    error:     mutation.error,
  };
}