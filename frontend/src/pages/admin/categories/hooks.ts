import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/api/client";
import { URLS } from "@/api/urls";
import { QUERIES } from "@/api/queries";
import { useT } from "@/i18n/I18nProvider";

import type { CategorySuffixIn, CategorySuffixOut } from "@/types";


export function useCategorySuffixes() {
  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: QUERIES.categorySuffixes.list,
    queryFn: () => api.get<CategorySuffixOut[]>(URLS.categorySuffixes.list),
  });
  return {
    suffixes: data ?? [],
    isLoading,
    isError,
    reload: () => void refetch(),
  };
}

export function useCreateCategorySuffix() {
  const qc = useQueryClient();
  const t = useT();
  const {
    mutateAsync,
    isPending,
  } = useMutation({
    mutationFn: (body: CategorySuffixIn) => api.post<CategorySuffixOut>(URLS.categorySuffixes.list, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERIES.categorySuffixes.list });
      toast.success(t("categories.toastCreated"));
    },
  });
  return {
    createSuffix: mutateAsync,
    isCreating: isPending,
  };
}

export function useUpdateCategorySuffix() {
  const qc = useQueryClient();
  const t = useT();
  const {
    mutateAsync,
    isPending,
  } = useMutation({
    mutationFn: ({ id, body }: { id: number; body: CategorySuffixIn }) =>
      api.put<CategorySuffixOut>(URLS.categorySuffixes.one(id), body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERIES.categorySuffixes.list });
      toast.success(t("categories.toastUpdated"));
    },
  });
  return {
    updateSuffix: mutateAsync,
    isUpdating: isPending,
  };
}

export function useDeleteCategorySuffix() {
  const qc = useQueryClient();
  const t = useT();
  const {
    mutateAsync,
    isPending,
  } = useMutation({
    mutationFn: (id: number) => api.delete(URLS.categorySuffixes.one(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERIES.categorySuffixes.list });
      toast.success(t("categories.toastDeleted"));
    },
  });
  return {
    deleteSuffix: mutateAsync,
    isDeleting: isPending,
  };
}
