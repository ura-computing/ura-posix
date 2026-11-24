/** Lumière: light and airy, pastel blooms and leaves drifting behind the page, the pharmacy's first product floating
 *  in the hero. */
import { unsplash, type StoreModel } from "@/storefront/ui/model";

import { Decor, Hero } from "./Hero";

export const lumiere: StoreModel = {
  look: {
    page: "#FBFCFB",
    surface: "rgba(255,255,255,.85)",
    tint: "transparent",
    ink: "#1B3A34",
    inkSoft: "#5B7A72",
    line: "rgba(0,0,0,.06)",
    onPrimary: "#FFFFFF",
    radius: "24px",
    buttonRadius: "9999px",
    shadow: "0 20px 50px -30px rgba(0,0,0,.2)",
  },
  fonts: {
    moderne: { display: "'Fraunces', Georgia, serif", body: "'Plus Jakarta Sans', system-ui, sans-serif" },
    classique: { display: "'Cormorant Garamond', Georgia, serif", body: "'Spectral', Georgia, serif" },
    editorial: { display: "'Playfair Display', Georgia, serif", body: "'Inter', system-ui, sans-serif" },
  },
  photo: unsplash("photo-1471864190281-a93a3070b6de"),
  Hero,
  Decor,
};
