/** What every store model (Lumière, Classique, …) receives: the editor's customization + the pharmacy's own data.
 *
 *  The preview page (`/preview/:template/:page?request=…`, shown in the editor's frame) loads both and renders
 *  `TEMPLATE_REGISTRY[template].pages[page](props)`. A downloaded store will load the same data with its token. */

import type { StoreProductDetail, StoreProductsPage, StoreSummary } from "@/types/storeWebsite";

/** The 4 pages every model implements. */
export type StorePage = "home" | "catalogue" | "produit" | "contact";

export const STORE_PAGES: StorePage[] = ["home", "catalogue", "produit", "contact"];

/** Home-page sections, in the order of `layout.y`. Keys = the editor's switches (`EditorSectionKey`). */
export type SectionKey =
  "hero" | "brands" | "catalogue" | "soldes" | "packs" | "featured_categories" | "contact" | "footer";

/** react-grid-layout item shape (subset — we only ship the fields we edit). */
export interface SectionLayout {
  i: string; // section key
  x: number; // column (0-11)
  y: number; // row
  w: number; // width in cols (1-12, usually 12 for template sections)
  h: number; // height in row-units (~30-100px each)
  static?: boolean; // Hero is pinned at the top so it never gets shuffled below
}

export interface SectionConfig {
  key: SectionKey;
  visible: boolean;
  layout: SectionLayout;
  /** The section's texts (title, sub, cta…). */
  content: Record<string, string>;
}

export type FontPairing = "classique" | "moderne" | "editorial";

export interface TemplateCustomization {
  /** The pharmacy's store name (« Pharmacie Demo Shop »), in the header and the footer. */
  storeName: string;
  brandColors: {
    primary: string; // main buttons + accents
    secondary: string; // supporting fills
    accent: string; // highlights
  };
  fontPairing: FontPairing;
  logoUrl: string | null;
  sections: SectionConfig[];
  featuredCategoryIds: string[];
}

/** The pharmacy's data for the page shown (null = not loaded / no request: the model shows its empty states). */
export interface StoreData {
  summary: StoreSummary | null;
  /** The catalogue page. */
  products: StoreProductsPage | null;
  /** The product page. */
  product: StoreProductDetail | null;
  /** The catalogue's filters, as in the URL. */
  category: string | null;
  search: string;
}

/** A link to another page of the same store: `href("catalogue", { category: "Soins visage" })`. */
export type StoreHref = (page: StorePage, params?: Record<string, string | number | null | undefined>) => string;

export interface TemplateProps {
  page: StorePage;
  customization: TemplateCustomization;
  store: StoreData;
  href: StoreHref;
  /** The pharmacy's phone: « Commander » opens WhatsApp on it, « Appeler » calls it. */
  pharmacyPhone: string;
}
