/** The downloaded store site's whole app (shipped as-is in the ZIP, type-checked here with the app). It reads, live,
 *  from PharmaGest with the site's key (`.env`): the customization, then the data of the page shown. One HTML page;
 *  the page and its filters are in the address: `?page=catalogue&category=Soins visage&search=creme&p=2`,
 *  `?page=produit&product=123`. Any static host works (no server code). */
import { useEffect, useState } from "react";

import type { PublicPreviewOut, StoreProductDetail, StoreProductsPage, StoreSummary } from "@/types/storeWebsite";

import {
  STORE_PAGES,
  type StoreData,
  type StoreHref,
  type StorePage,
} from "@/storefront/templates/_shared/customizationTypes";
import { toCustomization } from "@/storefront/templates/_shared/toCustomization";
import { renderTemplate } from "@/storefront/templates/registry";

const API = `${import.meta.env.VITE_PHARMAGEST_API_URL ?? ""}/v1`;
const KEY = import.meta.env.VITE_PHARMAGEST_STORE_KEY ?? "";

async function get<T>(path: string, params: Record<string, string | number | null> = {}): Promise<T> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== "") q.set(k, String(v));
  const res = await fetch(`${API}/store-public${path}${q.size ? `?${q}` : ""}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<T>;
}

/** The address's page + filters. */
function readUrl() {
  const q = new URLSearchParams(window.location.search);
  const page = q.get("page");
  return {
    page: (STORE_PAGES.includes(page as StorePage) ? page : "home") as StorePage,
    category: q.get("category"),
    search: q.get("search") ?? "",
    pageNumber: Number(q.get("p")) || 1,
    productId: Number(q.get("product")) || null,
  };
}

const href: StoreHref = (page, params = {}) => {
  const q = new URLSearchParams();
  if (page !== "home") q.set("page", page);
  for (const [k, v] of Object.entries(params)) if (v != null && v !== "") q.set(k === "page" ? "p" : k, String(v));
  return `${window.location.pathname}${q.size ? `?${q}` : ""}`;
};

type State =
  { status: "loading" } | { status: "error" } | { status: "ready"; preview: PublicPreviewOut; store: StoreData };

export function StoreApp() {
  const [url] = useState(readUrl);
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const { page, category, search, pageNumber, productId } = url;
    Promise.all([
      get<PublicPreviewOut>("/customization"),
      get<StoreSummary>("/summary"),
      page === "catalogue"
        ? get<StoreProductsPage>("/products", { category, search, page: pageNumber })
        : Promise.resolve(null),
      page === "produit" && productId
        ? get<StoreProductDetail>(`/products/${productId}`).catch(() => null)
        : Promise.resolve(null),
    ])
      .then(([preview, summary, products, product]) => {
        document.title = preview.store_name;
        setState({ status: "ready", preview, store: { summary, products, product, category, search } });
      })
      .catch(() => setState({ status: "error" }));
  }, [url]);

  if (state.status === "loading") return <div className="min-h-screen bg-white" aria-busy />;
  if (state.status === "error") {
    return (
      <div className="grid min-h-screen place-items-center p-8 text-center text-slate-600">
        Le site est momentanément indisponible. Réessayez dans quelques minutes.
      </div>
    );
  }
  const { preview, store } = state;
  const customization = toCustomization(preview.template, preview, API);
  return renderTemplate(preview.template, url.page, {
    page: url.page,
    customization,
    store,
    href,
    pharmacyPhone: preview.pharmacy_phone,
  });
}
