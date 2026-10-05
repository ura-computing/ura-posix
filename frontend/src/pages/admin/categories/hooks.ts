import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/api/client";
import { API, refresh } from "@/api/api";
import { useT } from "@/i18n/I18nProvider";

import type { CategorySuffixIn, CategorySuffixOut } from "@/types";

export function useCategorySuffixes() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.categorySuffixes.list.key,
    queryFn: () => api.get<CategorySuffixOut[]>(API.categorySuffixes.list.url),
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
  const { mutateAsync, isPending } = useMutation({
    mutationFn: (body: CategorySuffixIn) => api.post<CategorySuffixOut>(API.categorySuffixes.create.url, body),
    onSuccess: () => {
      void refresh(qc, API.categorySuffixes.create);
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
  const { mutateAsync, isPending } = useMutation({
    mutationFn: ({ id, body }: { id: number; body: CategorySuffixIn }) =>
      api.put<CategorySuffixOut>(API.categorySuffixes.update.url(id), body),
    onSuccess: () => {
      void refresh(qc, API.categorySuffixes.update);
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
  const { mutateAsync, isPending } = useMutation({
    mutationFn: (id: number) => api.delete(API.categorySuffixes.remove.url(id)),
    onSuccess: () => {
      void refresh(qc, API.categorySuffixes.remove);
      toast.success(t("categories.toastDeleted"));
    },
  });
  return {
    deleteSuffix: mutateAsync,
    isDeleting: isPending,
  };
}
