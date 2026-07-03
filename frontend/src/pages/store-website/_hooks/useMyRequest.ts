/** useMyRequest — owner's active (non-closed) request.
 *
 *  Backs `/store-website` Tab 1. Returns null when no active request exists
 *  (empty-state UI). Mutations: create + patch (edit while soumise) +
 *  featured-category toggle for Tab 2. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createRequest, getMyRequest, patchRequest as apiPatchRequest,
  patchFeaturedCategories as apiPatchFeatured,
} from "@/api/storeWebsite";
import type {
  WebsiteRequestCreate, WebsiteRequestPatch, WebsiteRequestOut,
} from "@/types/storeWebsiteApi";


const QK_MY_REQUEST = ["store-website", "my-request"] as const;


export function useMyRequest() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QK_MY_REQUEST,
    queryFn:  getMyRequest,
  });

  const createMutation = useMutation({
    mutationFn: (body: WebsiteRequestCreate) => createRequest(body),
    onSuccess:  (fresh: WebsiteRequestOut) => qc.setQueryData(QK_MY_REQUEST, fresh),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: WebsiteRequestPatch }) => apiPatchRequest(id, body),
    onSuccess:  (fresh: WebsiteRequestOut) => qc.setQueryData(QK_MY_REQUEST, fresh),
  });

  const featuredMutation = useMutation({
    mutationFn: ({ id, ids }: { id: string; ids: string[] }) => apiPatchFeatured(id, ids),
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
