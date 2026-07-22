import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useT } from "@/i18n/I18nProvider";

import { setPassword } from "@/api/auth";
import { ApiErr } from "@/api/client";
import { ROUTES } from "@/types";

export function useSetPassword(token: string) {
  const t = useT();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: (input: { password: string }) => setPassword({ token, password: input.password }),
    onSuccess: () => {
      toast.success(t("toast.pwdSaved"));
      navigate(ROUTES.LOGIN, { replace: true });
    },
    onError: (err: ApiErr) => {
      toast.error(err.detail || t("toast.linkExpired"));
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