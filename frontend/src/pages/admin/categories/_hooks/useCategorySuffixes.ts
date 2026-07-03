import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiErr } from "@/api/client";
import {
  createCategorySuffix,
  deleteCategorySuffix,
  listCategorySuffixes,
  updateCategorySuffix,
} from "@/api/categorySuffixes";
import { QUERY_KEYS } from "@/types";
import type { CategorySuffixIn } from "@/types";


export function useCategorySuffixes() {
  return useQuery({
    queryKey: QUERY_KEYS.CATEGORY_SUFFIXES,
    queryFn:  listCategorySuffixes,
  });
}

export function useCreateCategorySuffix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CategorySuffixIn) => createCategorySuffix(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORY_SUFFIXES });
      toast.success("Mapping créé");
    },
    onError: (err: ApiErr) => toast.error(err.detail || "Création impossible."),
  });
}

export function useUpdateCategorySuffix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: CategorySuffixIn }) => updateCategorySuffix(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORY_SUFFIXES });
      toast.success("Mapping mis à jour");
    },
    onError: (err: ApiErr) => toast.error(err.detail || "Mise à jour impossible."),
  });
}

export function useDeleteCategorySuffix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteCategorySuffix(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORY_SUFFIXES });
      toast.success("Mapping supprimé");
    },
    onError: (err: ApiErr) => toast.error(err.detail || "Suppression impossible."),
  });
}
