/** « Ma boutique en ligne »: request steps, models, editor labels, and the API shapes of `/v1/store-website/*`. */

// ── Request lifecycle ───────────────────────────────────────────────────────

/** The 5 states of a website request, in order. */
export type RequestState = "soumise" | "prise_en_charge" | "en_cours" | "livree" | "cloturee";

export const REQUEST_STATE_ORDER: RequestState[] = ["soumise", "prise_en_charge", "en_cours", "livree", "cloturee"];

/** i18n keys: `t(REQUEST_STATE_LABEL[state])`. */
export const REQUEST_STATE_LABEL: Record<RequestState, string> = {
  soumise: "store.stateSoumise",
  prise_en_charge: "store.statePriseEnCharge",
  en_cours: "store.stateEnCours",
  livree: "store.stateLivree",
  cloturee: "store.stateCloturee",
};

export type Urgency = "asap" | "ce_mois" | "flexible";

/** i18n keys: `t(URGENCY_LABEL[urgency])`. */
export const URGENCY_LABEL: Record<Urgency, string> = {
  asap: "store.urgencyAsap",
  ce_mois: "store.urgencyCeMois",
  flexible: "store.urgencyFlexible",
};

// ── Templates ───────────────────────────────────────────────────────────────

export type StoreTemplate = "classique" | "moderne" | "lumiere" | "apotheose" | "elegance";

export const TEMPLATE_LABEL: Record<StoreTemplate, string> = {
  classique: "Classique",
  moderne: "Moderne",
  lumiere: "Lumière",
  apotheose: "Apothéose",
  elegance: "Élégance",
};

export const TEMPLATES: StoreTemplate[] = ["lumiere", "classique", "moderne", "apotheose", "elegance"];

// ── Editor sections ────────────────────────────────────────────────────────

export type EditorSectionKey =
  "hero" | "brands" | "catalogue" | "soldes" | "packs" | "featured_categories" | "contact" | "footer";

/** i18n keys, in the order of the store's home page. */
export const EDITOR_SECTION_LABEL: Record<EditorSectionKey, string> = {
  hero: "store.sectionHero",
  brands: "store.sectionBrands",
  catalogue: "store.sectionCatalogue",
  soldes: "store.sectionSoldes",
  packs: "store.sectionPacks",
  featured_categories: "store.sectionFeatured",
  contact: "store.sectionContact",
  footer: "store.sectionFooter",
};

/** `label`: i18n key; `sample`: the two fonts (names, not translated). */
export const FONT_PAIRINGS = [
  { id: "classique", label: "store.fontClassique", sample: "Cormorant · Spectral" },
  { id: "moderne", label: "store.fontModerne", sample: "Space Grotesk · Inter" },
  { id: "editorial", label: "store.fontEditorial", sample: "Playfair · Inter" },
] as const;
export type FontPairing = (typeof FONT_PAIRINGS)[number]["id"];

// ── API contract for `/v1/store-website/*` (mirrors backend/app/store_website/schemas.py) ──
// Wire shapes only — no computed / display fields.

export interface ClaimedByOut {
  id: number;
  name: string;
}

/** Base request shape returned by list + create + patch + claim + release +
 *  state endpoints. Excludes the customization (fetched separately by the dev
 *  editor via GET /requests/{id}). */
export interface WebsiteRequestOut {
  id: string; // UUID
  pharmacy_id: number;
  pharmacy_name: string;
  pharmacy_code: string | null;
  owner_id: number;
  owner_name: string;
  /** The store's logo: `apiUrl(logo_url)`. */
  logo_url: string | null;
  /** The model Support picked. */
  template: StoreTemplate;
  store_name: string;
  slogan: string | null;
  brand_palette: string[];
  phone: string;
  custom_domain: string | null;
  urgency: Urgency;
  vision: string | null;
  state: RequestState;
  claimed_by: ClaimedByOut | null;
  claimed_at: string | null; // ISO
  created_at: string; // ISO
  updated_at: string; // ISO
}

export interface CustomizationOut {
  template: StoreTemplate;
  sections: Record<string, { visible: boolean }>;
  brand_colors: Record<string, string>;
  logo_url: string | null;
  font_pairing: FontPairing;
  featured_category_ids: string[];
  updated_at: string;
}

export interface WebsiteRequestWithCustomizationOut extends WebsiteRequestOut {
  customization: CustomizationOut;
}

/** Preview surface — safe subset exposed to the anonymous /preview page.
 *  NO owner personal data (no vision / owner_id / owner_name). */
export interface PublicPreviewOut {
  template: StoreTemplate;
  sections: Record<string, { visible: boolean }>;
  brand_colors: Record<string, string>;
  logo_url: string | null;
  font_pairing: FontPairing;
  featured_category_ids: string[];
  store_name: string;
  pharmacy_phone: string;
}

// ── Input shapes ────────────────────────────────────────────────────────────

export interface WebsiteRequestCreate {
  store_name: string;
  slogan?: string | null;
  brand_palette: string[]; // 2-3 hex
  phone: string;
  custom_domain?: string | null;
  urgency: Urgency;
  vision?: string | null;
}

export type WebsiteRequestPatch = Partial<WebsiteRequestCreate>;

export interface CustomizationPatch {
  template?: StoreTemplate;
  sections?: Record<string, { visible: boolean }>;
  brand_colors?: Record<string, string>;
  logo_url?: string | null;
  font_pairing?: FontPairing;
  featured_category_ids?: string[];
}

export interface StateTransition {
  state: RequestState;
}

// ── The store's data: ONLY the request's pharmacy (backend `store_website/catalog_queries.py`) ──

/** One product of the pharmacy's shelf, as a customer may see it. */
export interface StoreProduct {
  id: number;
  name: string;
  laboratoire: string | null;
  /** « Soins visage », « Parapharmacie » (never Sobrus' margin). */
  category: string | null;
  ppv: number | null;
  /** The owner's promo (MAD): shown instead of the PPV, the PPV struck out. */
  promo_price: number | null;
  in_stock: boolean;
  photo: string | null;
}

/** « Pack bébé » — 199 MAD instead of `ppv_total` (its products at their PPV). */
export interface StorePack {
  id: number;
  name: string;
  price: number;
  hidden: boolean;
  ppv_total: number | null;
  items: { product: StoreProduct; quantity: number }[];
}

export interface StoreSummary {
  pharmacy_name: string;
  city: string | null;
  address: string | null;
  /** Most products first. */
  categories: { name: string; count: number }[];
  /** Laboratoires with the most products. */
  brands: string[];
  /** In stock, with a photo first. */
  featured: StoreProduct[];
  /** The owner's promo prices. */
  promos: StoreProduct[];
  /** The owner's packs (not hidden). */
  packs: StorePack[];
}

// ── The owner's store settings (any time, the site live too) ──

export interface OwnerProduct extends StoreProduct {
  hidden: boolean;
}

export type OwnerProductsView = "all" | "shown" | "hidden" | "promo";

export interface OwnerProductsPage {
  items: OwnerProduct[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
  counts: { all: number; hidden: number; promo: number };
}

export interface CategoryChoice {
  name: string;
  count: number;
  shown: boolean;
}

export interface PackIn {
  name: string;
  price: number;
  hidden: boolean;
  items: { product_id: number; quantity: number }[];
}

export interface StoreProductsPage {
  items: StoreProduct[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
}

export interface StoreProductDetail extends StoreProduct {
  description: string | null;
  related: StoreProduct[];
}
