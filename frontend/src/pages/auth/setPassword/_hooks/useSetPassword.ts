import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { setPassword } from "@/api/auth";
import { ApiErr } from "@/api/client";
import { ROUTES } from "@/types";

export function useSetPassword(token: string) {
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: (input: { password: string }) => setPassword({ token, password: input.password }),
    onSuccess: () => {
      toast.success("Mot de passe enregistré. Vous pouvez vous connecter.");
      navigate(ROUTES.LOGIN, { replace: true });
    },
    onError: (err: ApiErr) => {
      toast.error(err.detail || "Le lien a expiré pendant la saisie. Demandez un nouveau lien.");
    },
  });

  const handleSetPassword = (input: { password: string }) => mutation.mutate(input);

  return {
    handleSetPassword,
    isPending: mutation.isPending,
    isError:   mutation.isError,
    error:     mutation.error,
  };
}