/** « Ma boutique en ligne » (owner): the request (send it, then its logo; edit while « Envoyée »), and the store's
 *  settings, changed at any time: products shown / promo, categories, packs. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/api/client";
import { API, refresh } from "@/api/api";
import { useT } from "@/i18n/I18nProvider";
import type {
  CategoryChoice,
  CustomizationOut,
  OwnerProductsPage,
  OwnerProductsView,
  PackIn,
  StorePack,
  WebsiteRequestCreate,
  WebsiteRequestOut,
} from "@/types/storeWebsite";

export function useMyStore() {
  const qc = useQueryClient();
  const t = useT();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.storeWebsite.myRequest.key,
    queryFn: () => api.get<WebsiteRequestOut | null>(API.storeWebsite.myRequest.url),
  });

  const { mutateAsync: sendLogo } = useMutation({
    mutationFn: (file: File) => api.upload<CustomizationOut>(API.storeWebsite.myLogo.url, file),
  });
  /** The request, then its logo (a new one only); one toast at the end. */
  const { mutateAsync: submit, isPending: isSending } = useMutation({
    mutationFn: async ({ body, logo, id }: { body: WebsiteRequestCreate; logo: File | null; id?: string }) => {
      if (id) await api.patch<WebsiteRequestOut>(API.storeWebsite.update.url(id), body);
      else await api.post<WebsiteRequestOut>(API.storeWebsite.create.url, body);
      if (logo) await sendLogo(logo);
    },
    onSuccess: (_r, { id }) => toast.success(t(id ? "myStore.saved" : "myStore.sent")),
    // Even when the logo failed after the request: the page shows the request (the logo can be sent again).
    onSettled: () => void refresh(qc, API.storeWebsite.create),
  });

  const { mutateAsync: deleteStore } = useMutation({
    mutationFn: () => api.delete(API.storeWebsite.deleteMyStore.url),
    onSuccess: () => {
      toast.success(t("myStore.deleted"));
      void refresh(qc, API.storeWebsite.deleteMyStore);
    },
  });

  return {
    request: data ?? null,
    deleteStore,
    isLoading,
    isError,
    reload: () => void refetch(),
    submitRequest: submit,
    isSending,
  };
}

/** « Produits »: one page of the shelf with each product's setting; show / hide it, set / remove its promo. */
export function useMyProducts({
  view,
  search,
  page,
  limit,
}: {
  view: OwnerProductsView;
  search: string;
  page: number;
  limit: number;
}) {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.storeWebsite.myProducts.key(view, null, search, page),
    queryFn: () =>
      api.get<OwnerProductsPage>(API.storeWebsite.myProducts.url, { params: { view, search, page, limit } }),
    placeholderData: keepPreviousData,
  });
  const { mutateAsync: setProduct } = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: { hidden?: boolean; promo_price?: number | null } }) =>
      api.patch(API.storeWebsite.setProduct.url(id), patch),
    onSuccess: () => void refresh(qc, API.storeWebsite.setProduct),
  });
  return {
    products: data?.items ?? [],
    total: data?.pagination.total ?? 0,
    counts: data?.counts ?? { all: 0, hidden: 0, promo: 0 },
    isLoading,
    isError,
    reload: () => void refetch(),
    setProduct,
  };
}

/** « Catégories »: every category of the shelf, shown or not; `setShown(null)` = all. */
export function useMyCategories() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: API.storeWebsite.myCategories.key,
    queryFn: () => api.get<CategoryChoice[]>(API.storeWebsite.myCategories.url),
  });
  const { mutate: setShown } = useMutation({
    mutationFn: (shown: string[] | null) => api.put<CategoryChoice[]>(API.storeWebsite.setCategories.url, { shown }),
    onSuccess: (fresh) => qc.setQueryData(API.storeWebsite.myCategories.key, fresh),
  });
  return {
    categories: data ?? [],
    isLoading,
    setShown,
  };
}

/** « Packs »: the owner's packs; create, change, delete. */
export function useMyPacks() {
  const qc = useQueryClient();
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: API.storeWebsite.myPacks.key,
    queryFn: () => api.get<StorePack[]>(API.storeWebsite.myPacks.url),
  });
  const store = (fresh: StorePack[]) => qc.setQueryData(API.storeWebsite.myPacks.key, fresh);
  const { mutateAsync: savePack, isPending: isSavingPack } = useMutation({
    mutationFn: ({ id, body }: { id?: number; body: PackIn }) =>
      id
        ? api.put<StorePack[]>(API.storeWebsite.updatePack.url(id), body)
        : api.post<StorePack[]>(API.storeWebsite.createPack.url, body),
    onSuccess: (fresh) => {
      store(fresh);
      toast.success(t("myStore.packSaved"));
    },
  });
  const { mutateAsync: removePack } = useMutation({
    mutationFn: (id: number) => api.delete(API.storeWebsite.removePack.url(id)),
    onSuccess: () => void refresh(qc, API.storeWebsite.removePack),
  });
  return {
    packs: data ?? [],
    isLoading,
    savePack,
    isSavingPack,
    removePack,
  };
}
