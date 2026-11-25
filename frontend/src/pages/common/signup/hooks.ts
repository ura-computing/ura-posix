import { useMutation } from "@tanstack/react-query";

import { api } from "@/api/client";
import { API } from "@/api/api";
import type { SignupIn } from "@/types/auth";

/** « Créer un compte ». The backend gives the same answer whatever was typed (it never says
 *  whether an email or a pharmacy code exists), so success = the confirmation screen.
 *  Errors: global toast (main.tsx). */
export function useSignup() {
  const { mutate, isPending, isSuccess } = useMutation({
    mutationFn: (input: SignupIn) => api.post<{ detail: string }>(API.auth.signup.url, input),
  });

  return {
    signup: (input: SignupIn) => mutate(input),
    isSending: isPending,
    isSent: isSuccess,
  };
}
