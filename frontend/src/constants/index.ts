export const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:8000/";
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const TOKEN_KEY = "apcm_token";

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
    signup: "/auth/signup",
    me: "/auth/me",
    forgotPassword: "/auth/forgot-password",
    forgotPasswordWhatsApp: "/auth/forgot-password-whatsapp",
    verifyOtp: "/auth/verify-otp",
    resetPassword: "/auth/reset-password",
  },
  uploads: {
    achat: "/uploads/achat",
    vente: "/uploads/vente",
    achatJson: "/uploads/achat-json",
    venteJson: "/uploads/vente-json",
    stock: "/uploads/stock",
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

export const FEATURES = [
  { key: "rapports", label: "Rapports" },
  { key: "import", label: "Import" },
  { key: "achat", label: "Achats" },
  { key: "ventes", label: "Ventes" },
  { key: "stock", label: "Stock" },
] as const;
