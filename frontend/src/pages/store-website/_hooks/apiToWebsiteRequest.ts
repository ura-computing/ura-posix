/** Small mapper: backend `WebsiteRequestOut` → UI `WebsiteRequest`.
 *
 *  Kept as a pure function so both the container + tests can share it.
 *  The two shapes exist because the UI shape carries display-time computed
 *  fields (timeline, developerName) that the wire shape doesn't need. */
import {
  REQUEST_STATE_ORDER,
  type RequestState, type WebsiteRequest,
} from "@/types/storeWebsite";
import type { WebsiteRequestOut } from "@/types/storeWebsiteApi";


export function apiToWebsiteRequest(api: WebsiteRequestOut): WebsiteRequest {
  return {
    id:            api.id,
    storeName:     api.store_name,
    slogan:        api.slogan ?? "",
    logoUrl:       null,
    brand:         { palette: api.brand_palette },
    phone:         api.phone,
    customDomain:  api.custom_domain,
    urgency:       api.urgency,
    vision:        api.vision ?? "",
    template:      null,
    state:         api.state,
    timeline:      buildTimeline(api),
    developerName: api.claimed_by?.name ?? null,
    createdAt:     api.created_at,
    deliverable:   null,   // dev handles deployment off-platform per user-locked decision
  };
}


/** Reconstruct a per-state timeline from the wire fields we have. Any state
 *  at or before the current one is "reached"; later ones are open. Dates
 *  come from `created_at` for the initial step and `claimed_at` for the
 *  claim step; downstream transitions don't carry their own timestamps
 *  on the request (yet) so they fall back to `updated_at`. */
function buildTimeline(api: WebsiteRequestOut) {
  const currentIdx = REQUEST_STATE_ORDER.indexOf(api.state as RequestState);
  return REQUEST_STATE_ORDER.map((state, i) => {
    if (i > currentIdx) return { state, reachedAt: null };
    if (state === "soumise")         return { state, reachedAt: api.created_at };
    if (state === "prise_en_charge") return { state, reachedAt: api.claimed_at };
    return { state, reachedAt: api.updated_at };
  });
}
