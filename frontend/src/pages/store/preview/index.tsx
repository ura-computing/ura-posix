/** /preview/:template/:page?request=… — a pharmacy's online store as customers will see it (no app chrome, no login).
 *  The store editor shows it in a frame; Support opens it in a tab. The URL holds the store's own filters:
 *  `&category=Soins visage&search=creme&page=2`, `&product=123`. Unknown request → « Aperçu introuvable ». */
import { Navigate, useParams, useSearchParams } from "react-router-dom";

import { SkeletonCard } from "@/_components/molecules/Skeletons";
import { useT } from "@/i18n/I18nProvider";
import { TEMPLATES, type StoreTemplate } from "@/types/storeWebsite";

import { STORE_PAGES, type StoreHref, type StorePage } from "../_templates/_shared/customizationTypes";
import { renderTemplate } from "../_templates/registry";
import { usePreviewStore } from "./hooks";

const isTemplate = (s: string | undefined): s is StoreTemplate => TEMPLATES.includes(s as StoreTemplate);
const isPage = (s: string | undefined): s is StorePage => STORE_PAGES.includes(s as StorePage);

export default function StorePreviewPage() {
  const { template, page } = useParams<{ template: string; page: string }>();
  const [params] = useSearchParams();
  const requestId = params.get("request");
  const validTemplate = isTemplate(template) ? template : "lumiere";
  const validPage = isPage(page) ? page : "home";
  const { customization, pharmacyPhone, store, isLoading, notFound } = usePreviewStore({
    template: validTemplate,
    page: validPage,
    requestId,
    category: params.get("category"),
    search: params.get("search") ?? "",
    pageNumber: Number(params.get("page")) || 1,
    productId: Number(params.get("product")) || null,
  });

  if (!isTemplate(template) || !isPage(page)) {
    return <Navigate to={`/preview/${validTemplate}/home${requestId ? `?request=${requestId}` : ""}`} replace />;
  }
  if (notFound) return <PreviewNotFound />;
  if (isLoading || !customization) {
    return (
      <div className="flex min-h-screen flex-col gap-4 bg-background p-6">
        <SkeletonCard lines={2} className="h-24" />
        <SkeletonCard lines={6} className="flex-1" />
      </div>
    );
  }

  /** Same store, another page; the request id stays; empty params are dropped. */
  const href: StoreHref = (to, extra = {}) => {
    const q = new URLSearchParams();
    if (requestId) q.set("request", requestId);
    for (const [k, v] of Object.entries(extra)) if (v != null && v !== "") q.set(k, String(v));
    const query = q.toString();
    return `/preview/${template}/${to}${query ? `?${query}` : ""}`;
  };

  return renderTemplate(template, page, { page, customization, store, href, pharmacyPhone });
}

function PreviewNotFound() {
  const t = useT();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold text-foreground">{t("store.previewNotFound")}</h1>
        <p className="text-sm text-muted-foreground">{t("store.previewNotFoundHint")}</p>
      </div>
    </div>
  );
}
