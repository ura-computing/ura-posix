/** Lumière template — palette + fonts.
 *
 *  Personality: light + airy, pastel rose + emerald, soft floating leaves,
 *  blur-in reveals, 3D tilt on product cards. */

import type { TemplateCustomization } from "../_shared/customizationTypes";

export const LUMIERE_TOKENS = {
  fonts: {
    moderne: { display: "'Fraunces', Georgia, serif", body: "'Plus Jakarta Sans', system-ui, sans-serif" },
    classique: { display: "'Cormorant Garamond', Georgia, serif", body: "'Spectral', Georgia, serif" },
    editorial: { display: "'Playfair Display', Georgia, serif", body: "'Inter', system-ui, sans-serif" },
  },
  ink: "#1B3A34",
  inkSoft: "#5B7A72",
  cream: "#FBFCFB",
  mono: "'JetBrains Mono', monospace",
} as const;

/** Build the inline CSS var block from a customization. Rendered on the
 *  outer template wrapper so Tailwind arbitrary vars + our own inline
 *  styles pick them up. */
export function lumiereCssVars(c: TemplateCustomization): React.CSSProperties {
  const fonts = LUMIERE_TOKENS.fonts[c.fontPairing];
  return {
    // brand
    "--lum-primary": c.brandColors.primary,
    "--lum-secondary": c.brandColors.secondary,
    "--lum-accent": c.brandColors.accent,
    // base
    "--lum-ink": LUMIERE_TOKENS.ink,
    "--lum-ink-soft": LUMIERE_TOKENS.inkSoft,
    "--lum-cream": LUMIERE_TOKENS.cream,
    // typography
    "--lum-font-display": fonts.display,
    "--lum-font-body": fonts.body,
    "--lum-font-mono": LUMIERE_TOKENS.mono,
  } as React.CSSProperties;
}
