/** Apothéose: a dark apothecary. Black and gold, tall serif titles, a dimmed photo slowly zooming behind the hero, a
 *  gold line that shines, and 3 of the pharmacy's products rising one after the other. */
import { unsplash, type StoreModel } from "@/storefront/ui/model";

import { Hero } from "./Hero";

export const apotheose: StoreModel = {
  look: {
    page: "#0B0B0C",
    surface: "#151517",
    tint: "#111113",
    ink: "#F5EFE3",
    inkSoft: "#A39E93",
    line: "rgba(199,166,98,.2)",
    onPrimary: "#0B0B0C",
    radius: "2px",
    buttonRadius: "0px",
    shadow: "none",
  },
  fonts: {
    classique: { display: "'Cormorant Garamond', Georgia, serif", body: "'Inter', system-ui, sans-serif" },
    moderne: { display: "'Fraunces', Georgia, serif", body: "'Inter', system-ui, sans-serif" },
    editorial: { display: "'Playfair Display', Georgia, serif", body: "'Inter', system-ui, sans-serif" },
  },
  photo: unsplash("photo-1612817288484-6f916006741a"),
  Hero,
};
