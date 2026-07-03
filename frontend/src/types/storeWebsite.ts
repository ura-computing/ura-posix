/** "Ma boutique en ligne" — shared domain types (UI layer only).
 *
 *  Mirrors the handoff types at PharmaGest Delivery/code/store-website/types.ts
 *  + dev/types.ts. No data hooks; pages receive these as props (mocked in
 *  src/fixtures/storeWebsite.ts for v1). */

// ── Request lifecycle ───────────────────────────────────────────────────────

/** The 5 states of a website request, in order. */
export type RequestState =
  | "soumise"
  | "prise_en_charge"
  | "en_cours"
  | "livree"
  | "cloturee";

export const REQUEST_STATE_ORDER: RequestState[] = [
  "soumise", "prise_en_charge", "en_cours", "livree", "cloturee",
];

export const REQUEST_STATE_LABEL: Record<RequestState, string> = {
  soumise:         "Soumise",
  prise_en_charge: "Prise en charge",
  en_cours:        "En cours",
  livree:          "Livrée",
  cloturee:        "Clôturée",
};

export type Urgency = "asap" | "ce_mois" | "flexible";

export const URGENCY_LABEL: Record<Urgency, string> = {
  asap:     "ASAP",
  ce_mois:  "Ce mois",
  flexible: "Flexible",
};

// ── Templates ───────────────────────────────────────────────────────────────

export type StoreTemplate = "classique" | "moderne" | "lumiere" | "apotheose" | "elegance";

export const TEMPLATE_LABEL: Record<StoreTemplate, string> = {
  classique: "Classique",
  moderne:   "Moderne",
  lumiere:   "Lumière",
  apotheose: "Apothéose",
  elegance:  "Élégance",
};

export const TEMPLATES: StoreTemplate[] = [
  "lumiere", "classique", "moderne", "apotheose", "elegance",
];

// ── Owner request ───────────────────────────────────────────────────────────

export interface BrandColors {
  palette: string[];      // 2-3 hex strings
}

export interface RequestTimelineStep {
  state:     RequestState;
  reachedAt: string | null;
}

export interface WebsiteRequest {
  id:            string;
  storeName:     string;
  slogan:        string;
  logoUrl:       string | null;
  brand:         BrandColors;
  phone:         string;                  // Moroccan phone, dev calls this
  customDomain:  string | null;
  urgency:       Urgency;
  vision:        string;
  template:      StoreTemplate | null;
  state:         RequestState;
  timeline:      RequestTimelineStep[];
  developerName: string | null;           // hidden until claimed
  createdAt:     string;
  deliverable:   { sizeBytes: number; downloadUrl: string } | null;
}

export interface PastRequest {
  id:         string;
  storeName:  string;
  brandColor: string;
  logoUrl:    string | null;
  template:   StoreTemplate;
  createdAt:  string;
}

// ── Categories (shared owner ↔ dev) ────────────────────────────────────────

export interface StoreCategory {
  id:                 string;
  name:               string;
  description:        string | null;
  icon:               string;             // one of the 12 fixed icon keys
  color:              string;             // one of the 8 fixed brand-safe colors
  productCount:       number;
  updatedByDeveloper: boolean;            // true for 7 days after dev edited
  isDefault?:         boolean;            // the non-deletable "Autres" bucket
}

export const MAX_STORE_CATEGORIES   = 12;
export const STORE_CATEGORY_WARN_AT = 10;

/** Fixed palette: 8 brand-safe colors. */
export const STORE_CATEGORY_COLORS = [
  "#34CBB7", "#0E9E8C", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#3B82F6", "#10B981",
] as const;
export type StoreCategoryColor = (typeof STORE_CATEGORY_COLORS)[number];

/** Fixed palette: 12 pharmacy icon keys. UI maps these to actual lucide
 *  components in `pages/store-website/_components/categoryIcons.tsx`. */
export const STORE_CATEGORY_ICONS = [
  "bebe", "bienetre", "vitamines", "soins", "hygiene", "beaute",
  "solaire", "bucco", "materiel", "bio", "maman", "sport",
] as const;
export type StoreCategoryIcon = (typeof STORE_CATEGORY_ICONS)[number];

// ── Products (visibility + SOLDE) ──────────────────────────────────────────

export interface VisibleProduct {
  id:               string;
  name:             string;
  sobrusCategory:   string;
  storeCategoryId:  string | null;        // null → "Autres"
  stock:            number;
  ppv:              number;               // MAD
  solde:            number | null;        // sale price in MAD when active
  visible:          boolean;
}

export type SoldeLockReason = "editable" | "locked_dev" | "live";

export function soldeLockFor(state: RequestState | null): SoldeLockReason {
  if (state === null || state === "soumise") return "editable";
  if (state === "prise_en_charge" || state === "en_cours") return "locked_dev";
  return "live";   // livree | cloturee
}

export type StockBucket = "en_stock" | "limite" | "rupture";

export function stockBucket(stock: number): StockBucket {
  if (stock <= 0) return "rupture";
  if (stock <= 5) return "limite";
  return "en_stock";
}

export const STOCK_BUCKET_LABEL: Record<StockBucket, string> = {
  en_stock: "En stock",
  limite:   "Stock limité",
  rupture:  "Rupture",
};

// ── Developer side ─────────────────────────────────────────────────────────

export interface DevRequest {
  id:           string;
  pharmacyName: string;
  brandColor:   string;
  submittedAt:  string;
  urgency:      Urgency;
  state:        RequestState;
  claimedBy:    { id: string; name: string } | null;
  claimedAt:    string | null;
}

export interface DevKpis {
  pending:          number;
  mineActive:       number;
  exportsThisMonth: number;
}

export interface RequestBrief {
  id:           string;
  pharmacyName: string;
  ownerName:    string;
  ownerPhone:   string;
  storeName:    string;
  slogan:       string;
  logoUrl:      string | null;
  brandPalette: string[];
  customDomain: string | null;
  urgency:      Urgency;
  vision:       string;
  state:        RequestState;
  claimedByMe:  boolean;
  categories:   { id: string; name: string; productCount: number }[];
  soldes:       { id: string; name: string; ppv: number; solde: number }[];
}

// ── Editor sections ────────────────────────────────────────────────────────

export type EditorSectionKey =
  | "hero"
  | "brands"
  | "catalogue"
  | "soldes"
  | "featured_categories"
  | "testimonials"
  | "contact"
  | "footer";

export const EDITOR_SECTION_LABEL: Record<EditorSectionKey, string> = {
  hero:                 "Hero",
  brands:               "Bandeau de marques",
  catalogue:            "Catalogue",
  soldes:               "SOLDES",
  featured_categories:  "Catégories en vedette",
  testimonials:         "Témoignages",
  contact:              "Contact",
  footer:               "Pied de page",
};

export interface EditorSection {
  key:     EditorSectionKey;
  visible: boolean;
}

export type DeviceMode = "desktop" | "tablet" | "mobile";

export const FONT_PAIRINGS = [
  { id: "classique", label: "Classique", sample: "Cormorant · Spectral" },
  { id: "moderne",   label: "Moderne",   sample: "Space Grotesk · Inter" },
  { id: "editorial", label: "Éditorial", sample: "Playfair · Inter" },
] as const;
export type FontPairing = (typeof FONT_PAIRINGS)[number]["id"];

// ── Exports + developers admin ─────────────────────────────────────────────

export interface ExportRow {
  id:           string;
  pharmacyName: string;
  brandColor:   string;
  template:     StoreTemplate;
  exportedAt:   string;
  sizeBytes:    number;
  downloadUrl:  string;
}

export type DeveloperStatus = "actif" | "en_attente" | "desactive";

export const DEVELOPER_STATUS_LABEL: Record<DeveloperStatus, string> = {
  actif:      "Actif",
  en_attente: "En attente",
  desactive:  "Désactivé",
};

export interface DeveloperAccount {
  id:             string;
  name:           string;
  email:          string;
  status:         DeveloperStatus;
  activeRequests: number;
  lastActiveAt:   string | null;
}
