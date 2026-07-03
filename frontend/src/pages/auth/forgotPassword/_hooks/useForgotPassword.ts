import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { forgotPassword } from "@/api/auth";
import { ApiErr } from "@/api/client";
import type { ForgotPasswordRequest } from "@/types";

export function useForgotPassword() {
  const mutation = useMutation({
    mutationFn: (input: ForgotPasswordRequest) => forgotPassword(input),
    // Backend always returns 200 regardless of whether the email exists (no leak),
    // so isSuccess is enough to switch to the confirmation screen — no toast needed.
    onError: (err: ApiErr) => {
      toast.error(err.detail || "Une erreur est survenue. Réessayez plus tard.");
    },
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