import { useCallback } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { login, signup, forgotPassword, resetPassword } from "@/api/auth";
import { storeSession, clearSession } from "@/utils/session";
import { QUERY_KEYS } from "@/constants";
import type { LoginPayload, SignupPayload } from "@/types";

export function useAuthenticate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { mutate: loginSubmit, isPending: loginPending } = useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: (data) => {
      storeSession(data.access_token);
      window.postMessage({ type: "APCM_AUTH_TOKEN", token: data.access_token }, window.location.origin);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.me });
      navigate("/");
    },
    onError: (err: Error) => toast.error(err.message, { richColors: true }),
  });

  const { mutate: signupSubmit, isPending: signupPending } = useMutation({
    mutationFn: (payload: SignupPayload) => signup(payload),
    onSuccess: (data) => {
      storeSession(data.access_token);
      window.postMessage({ type: "APCM_AUTH_TOKEN", token: data.access_token }, window.location.origin);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.me });
      navigate("/");
    },
    onError: (err: Error) => toast.error(err.message, { richColors: true }),
  });

  const { mutate: forgotSubmit, isPending: forgotPending } = useMutation({
    mutationFn: (email: string) => forgotPassword(email),
    onError: (err: Error) => toast.error(err.message, { richColors: true }),
  });

  const {
    mutate: resetSubmit,
    isPending: resetPending,
    isError: resetIsError,
    error: resetError,
  } = useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
      resetPassword(token, newPassword),
    onError: (err: Error) => toast.error(err.message, { richColors: true }),
  });

  const logout = useCallback(() => {
    window.postMessage({ type: "APCM_CLEAR_TOKEN" }, window.location.origin);
    clearSession();
    queryClient.clear();
    navigate("/login", { replace: true });
  }, [navigate, queryClient]);

  return {
    login: { submit: loginSubmit, loginPending },
    signup: { submit: signupSubmit, signupPending },
    forgotPassword: { submit: forgotSubmit, forgotPending },
    resetPassword: { submit: resetSubmit, resetPending, resetIsError, resetError },
    logout,
  };
}
