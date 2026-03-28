import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { login, register } from "@/api/auth";
import { storeSession } from "@/utils/session";
import { QUERY_KEYS } from "@/constants";
import type { LoginPayload, RegisterPayload } from "@/types";

export function useLoginMutation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: (data) => {
      storeSession(data.access_token);
      window.postMessage({ type: "APCM_AUTH_TOKEN", token: data.access_token }, window.location.origin);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.me });
      navigate("/");
    },
    onError: (err: Error) => {
      toast.error(err.message, { richColors: true });
    },
  });
}

export function useRegisterMutation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RegisterPayload) => register(payload),
    onSuccess: (data) => {
      storeSession(data.access_token);
      window.postMessage({ type: "APCM_AUTH_TOKEN", token: data.access_token }, window.location.origin);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.me });
      navigate("/");
    },
    onError: (err: Error) => {
      toast.error(err.message, { richColors: true });
    },
  });
}
