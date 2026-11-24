/** Moderne (after the « Clinova » medical template): teal on deep ink, bold sans titles, a photo in a slowly morphing
 *  shape with the pharmacy's first product floating over it, then a dark strip with the address, phone and WhatsApp. */
import { unsplash, type StoreModel } from "@/storefront/ui/model";

import { Hero } from "./Hero";

export const moderne: StoreModel = {
  look: {
    page: "#FFFFFF",
    surface: "#FFFFFF",
    tint: "#F3F7F7",
    ink: "#0F2A37",
    inkSoft: "#566D75",
    line: "#DCE8EA",
    onPrimary: "#FFFFFF",
    radius: "20px",
    buttonRadius: "12px",
    shadow: "0 24px 48px -32px rgba(15,42,55,.35)",
  },
  fonts: {
    moderne: { display: "'Plus Jakarta Sans', system-ui, sans-serif", body: "'Inter', system-ui, sans-serif" },
    classique: { display: "'Spectral', Georgia, serif", body: "'Inter', system-ui, sans-serif" },
    editorial: { display: "'Playfair Display', Georgia, serif", body: "'Inter', system-ui, sans-serif" },
  },
  photo: unsplash("photo-1584308666744-24d5c474f2ae"),
  Hero,
};
