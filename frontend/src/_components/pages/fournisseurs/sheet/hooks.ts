/** One supplier (/admin/fournisseurs/:id, /support/fournisseurs/:id): its sheet, « Modifier » a block, « Archiver ». */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { API, refresh } from "@/api/api";
import { api, ApiErr } from "@/api/client";
import { useT } from "@/i18n/I18nProvider";
import type { Condition, ConditionInput, SupplierEdit, SupplierSheet } from "@/types/suppliers";

export function useSupplierSheet(id: number) {
  const t = useT();
  const qc = useQueryClient();
  const valid = Number.isInteger(id) && id > 0;
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: API.admin.supplier.key(id),
    queryFn: () => api.get<SupplierSheet>(API.admin.supplier.url(id)),
    enabled: valid,
  });
  const { mutateAsync, isPending: isSaving } = useMutation({
    mutationFn: (body: SupplierEdit) => api.patch<SupplierSheet>(API.admin.editSupplier.url(id), body),
    onSuccess: () => {
      toast.success(t("suppliers.saved"));
      void refresh(qc, API.admin.editSupplier);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return {
    supplier: data ?? null,
    isLoading: valid && isLoading,
    isError,
    notFound: !valid || (error instanceof ApiErr && error.status === 404),
    reload: () => void refetch(),
    saveSupplier: (body: SupplierEdit) => mutateAsync(body).then(() => undefined),
    isSaving,
  };
}

/** The supplier's conditions: list, add / change (same form), delete. */
export function useConditions(supplierId: number) {
  const t = useT();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: API.admin.conditions.key(supplierId),
    queryFn: () => api.get<Condition[]>(API.admin.conditions.url(supplierId)),
  });
  const done = () => {
    toast.success(t("suppliers.saved"));
    void refresh(qc, API.admin.addCondition);
  };
  const { mutateAsync: save, isPending: isSavingCondition } = useMutation({
    mutationFn: ({ id, body }: { id: number | null; body: ConditionInput }) =>
      id
        ? api.put<Condition>(API.admin.editCondition.url(id), body)
        : api.post<Condition>(API.admin.addCondition.url(supplierId), body),
    onSuccess: done,
    onError: (e: Error) => toast.error(e.message),
  });
  const { mutateAsync: remove } = useMutation({
    mutationFn: (id: number) => api.delete(API.admin.deleteCondition.url(id)),
    onSuccess: done,
    onError: (e: Error) => toast.error(e.message),
  });
  return {
    conditions: data ?? [],
    isLoadingConditions: isLoading,
    saveCondition: (id: number | null, body: ConditionInput) => save({ id, body }).then(() => undefined),
    isSavingCondition,
    deleteCondition: (id: number) => remove(id).then(() => undefined),
  };
}
