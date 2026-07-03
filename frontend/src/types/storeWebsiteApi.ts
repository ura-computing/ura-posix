/** API contract types for `/v1/store-website/*`. Mirrors
 *  `backend/schemas/store_website.py`. Kept separate from the UI types in
 *  `storeWebsite.ts` so the wire shape stays honest — no computed / display
 *  fields creep in. */
import type { RequestState, StoreTemplate, Urgency, FontPairing } from "./storeWebsite";


export interface ClaimedByOut {
  id:   number;
  name: string;
}


/** Base request shape returned by list + create + patch + claim + release +
 *  state endpoints. Excludes the customization (fetched separately by the dev
 *  editor via GET /requests/{id}). */
export interface WebsiteRequestOut {
  id:            string;              // UUID
  pharmacy_id:   number;
  owner_id:      number;
  store_name:    string;
  slogan:        string | null;
  brand_palette: string[];
  phone:         string;
  custom_domain: string | null;
  urgency:       Urgency;
  vision:        string | null;
  state:         RequestState;
  claimed_by:    ClaimedByOut | null;
  claimed_at:    string | null;       // ISO
  created_at:    string;              // ISO
  updated_at:    string;              // ISO
}


export interface CustomizationOut {
  template:              StoreTemplate;
  sections:              Record<string, { visible: boolean }>;
  brand_colors:          Record<string, string>;
  logo_url:              string | null;
  font_pairing:          FontPairing;
  featured_category_ids: string[];
  updated_at:            string;
}


export interface WebsiteRequestWithCustomizationOut extends WebsiteRequestOut {
  customization: CustomizationOut;
}


/** Preview surface — safe subset exposed to the anonymous /preview page.
 *  NO owner personal data (no vision / owner_id / owner_name). */
export interface PublicPreviewOut {
  template:              StoreTemplate;
  sections:              Record<string, { visible: boolean }>;
  brand_colors:          Record<string, string>;
  logo_url:              string | null;
  font_pairing:          FontPairing;
  featured_category_ids: string[];
  store_name:            string;
  pharmacy_phone:        string;
}


// ── Input shapes ────────────────────────────────────────────────────────────

export interface WebsiteRequestCreate {
  store_name:    string;
  slogan?:       string | null;
  brand_palette: string[];   // 2-3 hex
  phone:         string;
  custom_domain?: string | null;
  urgency:       Urgency;
  vision?:       string | null;
}


export type WebsiteRequestPatch = Partial<WebsiteRequestCreate>;


export interface CustomizationPatch {
  template?:              StoreTemplate;
  sections?:              Record<string, { visible: boolean }>;
  brand_colors?:          Record<string, string>;
  logo_url?:              string | null;
  font_pairing?:          FontPairing;
  featured_category_ids?: string[];
}


export interface StateTransition {
  state: RequestState;
}
