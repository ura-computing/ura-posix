/** Classique (after the free « Pharmative » template): a full-width photo of a pharmacy under a dark veil, white
 *  titles in Nunito, fresh green, square corners, and a strip of 3 promises overlapping the photo. */
import { unsplash, type StoreModel } from "@/storefront/ui/model";

import { Hero } from "./Hero";

export const classique: StoreModel = {
  look: {
    page: "#FFFFFF",
    surface: "#FFFFFF",
    tint: "#F4F5F9",
    ink: "#25262A",
    inkSoft: "#6C757D",
    line: "#E9ECF2",
    onPrimary: "#FFFFFF",
    radius: "6px",
    buttonRadius: "4px",
    shadow: "0 2px 18px rgba(37,38,42,.06)",
  },
  fonts: {
    classique: { display: "'Nunito', system-ui, sans-serif", body: "'Nunito', system-ui, sans-serif" },
    moderne: { display: "'Plus Jakarta Sans', system-ui, sans-serif", body: "'Nunito', system-ui, sans-serif" },
    editorial: { display: "'Playfair Display', Georgia, serif", body: "'Nunito', system-ui, sans-serif" },
  },
  photo: unsplash("photo-1576602976047-174e57a47881"),
  Hero,
};
