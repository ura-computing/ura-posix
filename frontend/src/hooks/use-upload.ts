import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QUERY_KEYS } from "@/constants";

type DocType = "achat" | "vente";

export function useUploadCsv() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ type, file }: { type: DocType; file: File }) => api.uploads[type](file),
    onSuccess: (_data, { type }) => {
      queryClient.invalidateQueries({ queryKey: type === "achat" ? QUERY_KEYS.achat : QUERY_KEYS.ventes });
    },
  });
}
