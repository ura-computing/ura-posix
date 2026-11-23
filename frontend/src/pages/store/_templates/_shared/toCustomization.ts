/** The API's flat customization (`PublicPreviewOut`) → what the models read. Keys missing on an old row: the
 *  model's defaults. `apiBase` makes the logo's address absolute (« https://api…/v1 » + « /store-website/logo/… »).
 *  Used by the preview page and by the downloaded site. */
import type { PublicPreviewOut, StoreTemplate } from "@/types/storeWebsite";

import type { TemplateCustomization } from "./customizationTypes";
import { defaultCustomization } from "./defaultCustomization";

export function toCustomization(
  template: StoreTemplate,
  out: PublicPreviewOut,
  apiBase: string,
): TemplateCustomization {
  const base = defaultCustomization(template);
  return {
    ...base,
    storeName: out.store_name,
    logoUrl: out.logo_url ? `${apiBase}${out.logo_url}` : null,
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
