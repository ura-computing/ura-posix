/** Mock public-store data. Distinct from the dashboard fixtures in
 *  `@/fixtures/storeWebsite` — this is what the deployed store would fetch
 *  from the `/v1/public/*` namespace once the backend lands. For v1 all
 *  templates read from here so /preview + editor-inline preview show the
 *  same catalog. */

import type { VisibleProduct } from "@/types/storeWebsite";

/** A slightly richer catalog than the owner dashboard fixture so the
 *  templates have enough variety (categories × SOLDE × stock buckets)
 *  to demonstrate every visual state. */
export const MOCK_STORE_PRODUCTS: (VisibleProduct & {
  description: string;
  laboratoire: string;
})[] = [
  {
    id: "sp-1",
    name: "Doliprane 1000 mg",
    sobrusCategory: "Médicament",
    storeCategoryId: "cat-soin-quotidien",
    stock: 42,
    ppv: 28.5,
    solde: null,
    visible: true,
    description: "Antalgique et antipyrétique pour adulte. Boîte de 8 comprimés.",
    laboratoire: "Sanofi",
  },
  {
    id: "sp-2",
    name: "Sirop Strepsils Miel",
    sobrusCategory: "Médicament",
    storeCategoryId: "cat-soin-quotidien",
    stock: 4,
    ppv: 45.0,
    solde: 38.0,
    visible: true,
    description: "Soulage rapidement les maux de gorge grâce à un mélange miel-citron.",
    laboratoire: "Reckitt Benckiser",
  },
  {
    id: "sp-3",
    name: "Vitamine C 1000",
    sobrusCategory: "Parapharmacie",
    storeCategoryId: "cat-bien-etre",
    stock: 18,
    ppv: 64.0,
    solde: null,
    visible: true,
    description: "Complément quotidien pour renforcer les défenses naturelles.",
    laboratoire: "Bayer",
  },
  {
    id: "sp-4",
    name: "Biberon Avent 260 ml",
    sobrusCategory: "Parapharmacie",
    storeCategoryId: "cat-bebe",
    stock: 0,
    ppv: 89.0,
    solde: null,
    visible: true,
    description: "Biberon anti-colique, tétine en silicone souple. Sans BPA.",
    laboratoire: "Philips Avent",
  },
  {
    id: "sp-5",
    name: "Crème solaire SPF 50",
    sobrusCategory: "Parapharmacie",
    storeCategoryId: null,
    stock: 12,
    ppv: 120.0,
    solde: 95.0,
    visible: true,
    description: "Protection très haute pour peaux sensibles. Résistante à l'eau.",
    laboratoire: "La Roche-Posay",
  },
  {
    id: "sp-6",
    name: "Smecta sachets x30",
    sobrusCategory: "Médicament",
    storeCategoryId: "cat-bebe",
    stock: 25,
    ppv: 31.0,
    solde: null,
    visible: true,
    description: "Traitement symptomatique de la diarrhée aiguë chez l'adulte et l'enfant.",
    laboratoire: "Ipsen",
  },
  {
    id: "sp-7",
    name: "Magnésium B6",
    sobrusCategory: "Parapharmacie",
    storeCategoryId: "cat-bien-etre",
    stock: 9,
    ppv: 55.0,
    solde: 44.0,
    visible: true,
    description: "Formule anti-fatigue pour retrouver énergie et sérénité.",
    laboratoire: "Sanofi",
  },
  {
    id: "sp-8",
    name: "Sérum physiologique 5 ml x40",
    sobrusCategory: "Parapharmacie",
    storeCategoryId: "cat-bebe",
    stock: 60,
    ppv: 42.0,
    solde: null,
    visible: true,
    description: "Unidoses stériles pour le nettoyage nasal et oculaire du nourrisson.",
    laboratoire: "Cooper",
  },
  {
    id: "sp-9",
    name: "Gel douche surgras 500 ml",
    sobrusCategory: "Parapharmacie",
    storeCategoryId: "cat-soin-quotidien",
    stock: 32,
    ppv: 38.0,
    solde: 30.0,
    visible: true,
    description: "Nettoie en douceur et respecte les peaux sensibles ou atopiques.",
    laboratoire: "Avène",
  },
  {
    id: "sp-10",
    name: "Zinc + Sélénium",
    sobrusCategory: "Parapharmacie",
    storeCategoryId: "cat-bien-etre",
    stock: 15,
    ppv: 72.0,
    solde: null,
    visible: true,
    description: "Duo minéral pour le tonus, les cheveux et la peau.",
    laboratoire: "Solgar",
  },
];

/** Marketing testimonials — same list across templates. */
export const MOCK_TESTIMONIALS = [
  {
    quote: "Un accueil chaleureux, des conseils précieux. Ma pharmacie de cœur.",
    author: "Salma B.",
  },
  {
    quote: "Toujours disponible, même pour un simple avis. Merci pour votre écoute.",
    author: "Younes T.",
  },
  {
    quote: "Livraison rapide et prix corrects. Je recommande sans hésiter.",
    author: "Karim A.",
  },
];

export const MOCK_BRANDS = ["Sanofi", "Bayer", "La Roche-Posay", "Avène", "Philips Avent", "Cooper", "Solgar"];

/** Build the WhatsApp deep link that every "Commander" CTA uses. */
export function whatsappOrderLink(phone: string, productName: string): string {
  const clean = phone.replace(/[^\d]/g, "");
  const msg = encodeURIComponent(`Bonjour, je suis intéressé par : ${productName}. Merci !`);
  return `https://wa.me/${clean}?text=${msg}`;
}
