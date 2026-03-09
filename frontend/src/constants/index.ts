export const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:8000/";
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const CLOUDINARY_UPLOAD_URL = import.meta.env.VITE_CLOUDINARY_UPLOAD_URL;
export const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
export const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const TOKEN_KEY = "pharmagest_token";

export const QUERY_KEYS = {
  me: ["me"] as const,
  achat: ["achat"] as const,
  ventes: ["ventes"] as const,
  pharmacies: ["admin", "pharmacies"] as const,
  adminUsers: ["admin", "users"] as const,
} as const;

export const ENDPOINTS = {
  auth: {
    login: "/auth/login",
    register: "/auth/register",
    me: "/auth/me",
  },
  uploads: {
    achat: "/uploads/achat",
    vente: "/uploads/vente",
    achatJson: "/uploads/achat-json",
    venteJson: "/uploads/vente-json",
  },
  achat: {
    list: "/achat",
    categories: "/achat/categories",
    tvaRates: "/achat/tva-rates",
  },
  ventes: {
    list: "/ventes",
    categories: "/ventes/categories",
    tvaRates: "/ventes/tva-rates",
  },
  data: {
    achats: "/data/achats",
    ventes: "/data/ventes",
  },
  admin: {
    pharmacies: "/admin/pharmacies",
    users: "/admin/users",
  },
} as const;
