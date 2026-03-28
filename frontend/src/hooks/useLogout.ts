import { useCallback } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { clearSession } from "@/utils/session";

export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutate = useCallback(() => {
    window.postMessage({ type: "APCM_CLEAR_TOKEN" }, window.location.origin);
    clearSession();
    queryClient.clear();
    navigate("/login", { replace: true });
  }, [navigate, queryClient]);

  return { mutate, isPending: false };
}
