/** Public template preview — `/preview/:template/:page`.
 *
 *  No app chrome, no auth. When the URL carries `?request=<uuid>` we fetch
 *  the safe-subset customization from `GET /v1/store-website/public/preview/{id}`
 *  so the site reflects the developer's current work. Without a request id,
 *  we render the template with its own default palette so the URL is still
 *  useful as a design showcase.
 *
 *  404 (invalid uuid) shows a friendly message. No stack traces leak. */

import { useMemo } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { API } from "@/api/api";

import type { StoreCategory, StoreTemplate } from "@/types/storeWebsite";
import { TEMPLATES } from "@/types/storeWebsite";
import type { PublicPreviewOut } from "@/types/storeWebsite";

/** Owner-defined categories aren't exposed on the public preview API yet
 *  (deferred until the pharmacy-store-categories endpoint ships). Renders
 *  the store with an empty category list — templates degrade gracefully
 *  (Home's "Catégories vitrine" section just hides). */
const NO_CATEGORIES: StoreCategory[] = [];

import { defaultCustomization } from "@/pages/store/dev/_templates/_shared/defaultCustomization";
import {
  STORE_PAGES,
  type StorePage,
  type TemplateCustomization,
} from "@/pages/store/dev/_templates/_shared/customizationTypes";
import { renderTemplate } from "@/pages/store/dev/_templates/registry";

function isTemplate(s: string | undefined): s is StoreTemplate {
  return TEMPLATES.includes(s as StoreTemplate);
}

function isPage(s: string | undefined): s is StorePage {
  return STORE_PAGES.includes(s as StorePage);
}

/** Fold the backend's flat customization payload into the shape templates
 *  actually consume. Section keys not present on the wire (e.g. from an
 *  older DB row) fall back to the template's default visibility. */
function apiToCustomization(template: StoreTemplate, api: PublicPreviewOut): TemplateCustomization {
  const base = defaultCustomization(template);
  return {
    ...base,
    logoUrl: api.logo_url,
    brandColors: {
      primary: api.brand_colors.primary ?? base.brandColors.primary,
      secondary: api.brand_colors.secondary ?? base.brandColors.secondary,
      accent: api.brand_colors.accent ?? base.brandColors.accent,
    },
    fontPairing: (api.font_pairing as TemplateCustomization["fontPairing"]) ?? base.fontPairing,
    featuredCategoryIds: api.featured_category_ids,
    sections: base.sections.map((s) => {
      const override = api.sections[s.key];
      return override ? { ...s, visible: override.visible } : s;
    }),
  };
}

export default function StorePreviewRoute() {
  const { template, page } = useParams<{ template: string; page: string }>();
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get("request");

  // Query runs only when a request id is present. Anonymous preview
  // (no ?request=) skips the fetch and renders defaults.
  const q = useQuery({
    queryKey: API.storeWebsite.preview.key(requestId),
    queryFn: () => api.get<PublicPreviewOut>(API.storeWebsite.preview.url(requestId!)),
    enabled: !!requestId,
    retry: false, // 404 fast-fail — don't hammer for invalid uuids
  });

  const customization = useMemo<TemplateCustomization | null>(() => {
    if (!isTemplate(template)) return null;
    if (!requestId) return defaultCustomization(template);
    if (q.data) return apiToCustomization(template, q.data);
    return null;
  }, [template, requestId, q.data]);

  if (!isTemplate(template)) return <Navigate to="/preview/lumiere/home" replace />;
  if (!isPage(page)) return <Navigate to={`/preview/${template}/home`} replace />;

  if (requestId && q.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Chargement de l'aperçu…
      </div>
    );
  }

  if (requestId && q.isError) {
    return <PreviewNotFound />;
  }

  if (!customization) return null;

  // Pharmacy phone: from the API when we have one, else a Moroccan-format
  // placeholder that still builds a valid WhatsApp deeplink for the demo.
  const pharmacyPhone = q.data?.pharmacy_phone ?? "212600000000";

  return renderTemplate(template, page, {
    page,
    customization,
    editMode: false,
    categories: NO_CATEGORIES,
    pharmacyPhone,
    productId: searchParams.get("product") ?? undefined,
  });
}

function PreviewNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold text-foreground">Aperçu introuvable</h1>
        <p className="text-sm text-muted-foreground">
          Ce lien d'aperçu n'existe pas ou n'est plus disponible. Vérifiez auprès de votre développeur.
        </p>
      </div>
    </div>
  );
}
