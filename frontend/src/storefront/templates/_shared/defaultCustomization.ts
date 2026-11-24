import type { StoreTemplate } from "@/types/storeWebsite";

import type { SectionConfig, TemplateCustomization } from "./customizationTypes";

const HERO_COPY = {
  title: "Votre pharmacie, près de chez vous",
  subtitle: "Découvrez nos produits et demandez-les sur WhatsApp : nous vous répondons vite.",
  cta: "Voir nos produits",
};

/** Home-page section defaults. Order = display order (y ascending).
 *  Each section spans the full width (w:12); heights are approximate. */
export const DEFAULT_SECTIONS: SectionConfig[] = [
  {
    key: "hero",
    visible: true,
    layout: { i: "hero", x: 0, y: 0, w: 12, h: 18, static: true },
    content: HERO_COPY,
  },
  {
    key: "brands",
    visible: true,
    layout: { i: "brands", x: 0, y: 18, w: 12, h: 4 },
    content: { title: "Les marques de la pharmacie" },
  },
  {
    key: "catalogue",
    visible: true,
    layout: { i: "catalogue", x: 0, y: 22, w: 12, h: 10 },
    content: {
      title: "Nos rayons",
      sub: "Trouvez vite ce qu'il vous faut.",
    },
  },
  {
    key: "soldes",
    visible: true,
    layout: { i: "soldes", x: 0, y: 32, w: 12, h: 12 },
    content: { title: "Nos promotions", sub: "Choisies par la pharmacie." },
  },
  {
    key: "packs",
    visible: true,
    layout: { i: "packs", x: 0, y: 38, w: 12, h: 10 },
    content: { title: "Nos packs", sub: "Plusieurs produits, un seul prix." },
  },
  {
    key: "featured_categories",
    visible: true,
    layout: { i: "featured_categories", x: 0, y: 44, w: 12, h: 12 },
    content: {
      title: "Disponibles en pharmacie",
      sub: "Une sélection de nos produits en stock.",
    },
  },
  {
    key: "contact",
    visible: true,
    layout: { i: "contact", x: 0, y: 62, w: 12, h: 10 },
    content: {
      title: "Nous trouver",
      sub: "Une question sur un produit ? Écrivez-nous sur WhatsApp ou appelez-nous.",
    },
  },
  {
    key: "footer",
    visible: true,
    layout: { i: "footer", x: 0, y: 72, w: 12, h: 6 },
    content: { title: "" },
  },
];

/** Each model's colors before the pharmacy picks its own (the editor shows them on the model's card). */
export const PALETTES: Record<StoreTemplate, TemplateCustomization["brandColors"]> = {
  lumiere: { primary: "#1FA97E", secondary: "#F4C9D9", accent: "#E9C887" },
  classique: { primary: "#75B239", secondary: "#EDF0F5", accent: "#E86B00" },
  moderne: { primary: "#0E7C86", secondary: "#DFF3F0", accent: "#5FD3BC" },
  apotheose: { primary: "#C7A662", secondary: "#2A2620", accent: "#8C6A3F" },
  elegance: { primary: "#4F7D5C", secondary: "#EEF2EA", accent: "#B45309" },
};

const FONTS: Record<StoreTemplate, TemplateCustomization["fontPairing"]> = {
  lumiere: "moderne",
  classique: "classique",
  moderne: "moderne",
  apotheose: "classique",
  elegance: "editorial",
};

export function defaultCustomization(template: StoreTemplate): TemplateCustomization {
  return {
    storeName: "Pharmacie Lumière",
    brandColors: PALETTES[template],
    fontPairing: FONTS[template],
    logoUrl: null,
    sections: DEFAULT_SECTIONS.map((s) => ({
      ...s,
      content: { ...s.content },
    })),
    featuredCategoryIds: [],
  };
}
