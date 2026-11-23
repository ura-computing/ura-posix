/** The preview's data: the editor's customization + ONLY the request's pharmacy's data for the page shown
 *  (home: the summary; « Nos produits »: one page of products; a product: its detail). No `?request=`: the model
 *  alone, with its defaults and empty states (a showcase of the design). */
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api, apiUrl } from "@/api/client";
import { API } from "@/api/api";
import type {
  PublicPreviewOut,
  StoreProductDetail,
  StoreProductsPage,
  StoreSummary,
  StoreTemplate,
} from "@/types/storeWebsite";

import type { StorePage, TemplateCustomization } from "../_templates/_shared/customizationTypes";
import { defaultCustomization } from "../_templates/_shared/defaultCustomization";

/** The API's flat customization → what the models read (keys missing on an old row: the model's defaults). */
function toCustomization(template: StoreTemplate, out: PublicPreviewOut): TemplateCustomization {
  const base = defaultCustomization(template);
  return {
    ...base,
    storeName: out.store_name,
    logoUrl: out.logo_url ? apiUrl(out.logo_url) : null,
    brandColors: {
      primary: out.brand_colors.primary ?? base.brandColors.primary,
      secondary: out.brand_colors.secondary ?? base.brandColors.secondary,
      accent: out.brand_colors.accent ?? base.brandColors.accent,
    },
    fontPairing: (out.font_pairing as TemplateCustomization["fontPairing"]) ?? base.fontPairing,
    featuredCategoryIds: out.featured_category_ids,
    sections: base.sections.map((s) => {
      const override = out.sections[s.key];
      return override ? { ...s, visible: override.visible } : s;
    }),
  };
}

export function usePreviewStore({
  template,
  page,
  requestId,
  category,
  search,
  pageNumber,
  productId,
}: {
  template: StoreTemplate;
  page: StorePage;
  requestId: string | null;
  category: string | null;
  search: string;
  pageNumber: number;
  productId: number | null;
}) {
  const id = requestId ?? "";
  const preview = useQuery({
    queryKey: API.storeWebsite.preview.key(requestId),
    queryFn: () => api.get<PublicPreviewOut>(API.storeWebsite.preview.url(id)),
    enabled: !!requestId,
    retry: false, // unknown id: the « not found » page at once
  });
  const summary = useQuery({
    queryKey: API.storeWebsite.publicSummary.key(id),
    queryFn: () => api.get<StoreSummary>(API.storeWebsite.publicSummary.url(id)),
    enabled: !!requestId,
    retry: false,
  });
  const products = useQuery({
    queryKey: API.storeWebsite.publicProducts.key(id, category, search, pageNumber),
    queryFn: () =>
      api.get<StoreProductsPage>(API.storeWebsite.publicProducts.url(id), {
        params: { category, search, page: pageNumber },
      }),
    enabled: !!requestId && page === "catalogue",
    placeholderData: keepPreviousData,
    retry: false,
  });
  const product = useQuery({
    queryKey: API.storeWebsite.publicProduct.key(id, productId ?? 0),
    queryFn: () => api.get<StoreProductDetail>(API.storeWebsite.publicProduct.url(id, productId ?? 0)),
    enabled: !!requestId && page === "produit" && productId != null,
    retry: false,
  });

  return {
    customization: requestId
      ? preview.data
        ? toCustomization(template, preview.data)
        : null
      : defaultCustomization(template),
    pharmacyPhone: preview.data?.pharmacy_phone ?? "",
    store: {
      summary: summary.data ?? null,
      products: products.data ?? null,
      product: product.data ?? null,
      category,
      search,
    },
    isLoading: !!requestId && (preview.isLoading || summary.isLoading),
    notFound: !!requestId && preview.isError,
  };
}
