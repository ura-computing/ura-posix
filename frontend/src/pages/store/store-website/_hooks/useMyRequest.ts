/** useMyRequest — owner's active (non-closed) request.
 *
 *  Backs `/store-website` Tab 1. Returns null when no active request exists
 *  (empty-state UI). Mutations: create + patch (edit while soumise) +
 *  featured-category toggle for Tab 2. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { URLS } from "@/api/urls";
import { QUERIES } from "@/api/queries";

import type {
  CustomizationOut, WebsiteRequestCreate, WebsiteRequestPatch, WebsiteRequestOut,
} from "@/types/storeWebsite";


export function useMyRequest() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QUERIES.storeWebsite.myRequest,
    queryFn:  () => api.get<WebsiteRequestOut | null>(URLS.storeWebsite.myRequest),
  });

  const createMutation = useMutation({
    mutationFn: (body: WebsiteRequestCreate) => api.post<WebsiteRequestOut>(URLS.storeWebsite.requests, body),
    onSuccess:  (fresh: WebsiteRequestOut) => qc.setQueryData(QUERIES.storeWebsite.myRequest, fresh),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: WebsiteRequestPatch }) =>
      api.patch<WebsiteRequestOut>(URLS.storeWebsite.request.one(id), body),
    onSuccess:  (fresh: WebsiteRequestOut) => qc.setQueryData(QUERIES.storeWebsite.myRequest, fresh),
  });

  const featuredMutation = useMutation({
    mutationFn: ({ id, ids }: { id: string; ids: string[] }) =>
      api.patch<CustomizationOut>(URLS.storeWebsite.request.featuredCategories(id), { featured_category_ids: ids }),
    // Featured lives on the customization, not on the request — no cache
    // update needed here; the dev editor's cache is separate.
  });

  return {
    request:   query.data ?? null,
    isLoading: query.isLoading,
    isError:   query.isError,

    createRequest:            (body: WebsiteRequestCreate) => createMutation.mutateAsync(body),
    isCreating:               createMutation.isPending,
    createError:              createMutation.error,

    patchRequest:             (id: string, body: WebsiteRequestPatch) =>
                                patchMutation.mutateAsync({ id, body }),
    isPatching:               patchMutation.isPending,

    patchFeaturedCategories:  (id: string, ids: string[]) =>
                                featuredMutation.mutateAsync({ id, ids }),
    isFeaturedSaving:         featuredMutation.isPending,
  };
}
