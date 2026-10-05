/** Template customization state — shared by all 5 templates.
 *
 *  Templates render from a `TemplateCustomization` prop. The dev editor
 *  mutates the state via `onCustomizationChange`; the standalone
 *  `/preview/:template/:page` route reads it read-only (`editMode=false`).
 *
 *  Persistence: v1 stores the state in localStorage keyed by request id so
 *  the demo survives reloads. Real backend wiring lands later. */

import type { StoreCategory } from "@/types/storeWebsite";

/** The 5 pages every template must implement. */
export type StorePage = "home" | "catalogue" | "produit" | "contact";

export const STORE_PAGES: StorePage[] = ["home", "catalogue", "produit", "contact"];

export const STORE_PAGE_LABEL: Record<StorePage, string> = {
  home: "Accueil",
  catalogue: "Catalogue",
  produit: "Produit",
  contact: "Contact",
};

/** Home-only editable sections. Keys mirror `EditorSectionKey` in
 *  `@/types/storeWebsite` so the editor's visibility toggles map 1:1.
 *  Order comes from `sections[i].layout.y`. */
export type SectionKey =
  "hero" | "brands" | "catalogue" | "soldes" | "featured_categories" | "testimonials" | "contact" | "footer";

export const SECTION_LABEL: Record<SectionKey, string> = {
  hero: "Hero",
  brands: "Bandeau de marques",
  catalogue: "Catalogue vitrine",
  soldes: "SOLDES en cours",
  featured_categories: "Catégories en vedette",
  testimonials: "Témoignages",
  contact: "Contact + carte",
  footer: "Pied de page",
};

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
  /** Free-form editable copy slots. Templates read their own keys. */
  content: Record<string, string>;
}

export type FontPairing = "classique" | "moderne" | "editorial";

export const FONT_PAIRING_LABEL: Record<FontPairing, string> = {
  classique: "Classique (Cormorant · Spectral)",
  moderne: "Moderne (Plus Jakarta · Fraunces)",
  editorial: "Éditorial (Playfair · Inter)",
};

export interface TemplateCustomization {
  brandColors: {
    primary: string; // main CTA + accents
    secondary: string; // supporting fills
    accent: string; // SOLDE badges, highlights
  };
  fontPairing: FontPairing;
  logoUrl: string | null;
  sections: SectionConfig[];
  featuredCategoryIds: string[];
}

/** Common props every template component receives. Templates read the
 *  customization state; the editor / preview route decides `editMode` and
 *  wires `onCustomizationChange` for round-trip updates.
 *
 *  `page` lets a single template component switch between its 4 pages
 *  (home / catalogue / produit / contact) via internal routing. Owner
 *  categories + phone come from the request context. */
export interface TemplateProps {
  page: StorePage;
  customization: TemplateCustomization;
  editMode: boolean;
  onCustomizationChange?: (next: TemplateCustomization) => void;
  /** Owner-defined categories from the store-website Tab 2 (mocked). */
  categories: StoreCategory[];
  /** Owner's WhatsApp phone (Moroccan format). Every "Commander" CTA
   *  builds a `wa.me/{phone}?text=...` deep link. */
  pharmacyPhone: string;
  /** Optional product id for the produit page (else the first product). */
  productId?: string;
}
