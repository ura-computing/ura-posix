import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiErr } from "@/api/client";
import { updateProfile } from "@/api/users";
import { QUERY_KEYS } from "@/types";
import type { UpdateProfileRequest } from "@/types";

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: UpdateProfileRequest) => updateProfile(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ME });
      toast.success("Profil mis à jour.");
    },
    onError: (err: ApiErr) => {
      toast.error(err.detail || "La mise à jour a échoué. Réessayez.");
    },
  });

  const handleUpdate = (input: UpdateProfileRequest) => mutation.mutate(input);

  return {
    handleUpdate,
    isPending: mutation.isPending,
    isError:   mutation.isError,
    error:     mutation.error,
  };
}