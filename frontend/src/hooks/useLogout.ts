import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { logout } from "@/api/auth";
import { ApiErr } from "@/api/client";
import { ROUTES } from "@/types";

export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation<void, ApiErr>({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      navigate(ROUTES.LOGIN);
    },
    onError: (err) => {
      toast.error(err.detail);
    },
  });

  const handleLogout = () => mutation.mutate();

  return {
    handleLogout,
    isPending: mutation.isPending,
  };
}