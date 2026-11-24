/** Élégance (after the « Clinova Senior Care » template): calm sage on cream, large serif titles, a photo in an arch
 *  that opens from the bottom, and a round seal turning slowly beside it. */
import { unsplash, type StoreModel } from "@/storefront/ui/model";

import { Hero } from "./Hero";

export const elegance: StoreModel = {
  look: {
    page: "#FBFAF6",
    surface: "#FFFFFF",
    tint: "#F1F4EE",
    ink: "#22302A",
    inkSoft: "#5F6F66",
    line: "#E3E8DF",
    onPrimary: "#FFFFFF",
    radius: "28px",
    buttonRadius: "9999px",
    shadow: "0 30px 60px -40px rgba(34,48,42,.35)",
  },
  fonts: {
    editorial: { display: "'Playfair Display', Georgia, serif", body: "'Inter', system-ui, sans-serif" },
    classique: { display: "'Cormorant Garamond', Georgia, serif", body: "'Spectral', Georgia, serif" },
    moderne: { display: "'Fraunces', Georgia, serif", body: "'Plus Jakarta Sans', system-ui, sans-serif" },
  },
  photo: unsplash("photo-1620916566398-39f1143ab7be"),
  Hero,
};
