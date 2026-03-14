export const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || "http://localhost:5173";
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const TOKEN_STORAGE_KEY = "pharmagest_token";
export const NOTIFICATIONS_STORAGE_KEY = "apcm_notifications";
export const UPLOAD_STATUS_KEY = "apcm_upload_status";
export const CANCEL_UPLOAD_KEY = "apcm_cancel_upload";

export const QUERY_KEYS = {
  token: ["token"] as const,
} as const;

export const SOBRUS_HOSTNAME = "app.pharma.sobrus.com";
export const SOBRUS_EXPORT_PATHS = ["/reports/exportpurchases", "/reports/exportsales"];
export const INDICATOR_POSITION_KEY = "apcm_indicator_pos";

export const ACTIONS = {
  GET_TOKEN: "GET_TOKEN",
  CLEAR_TOKEN: "CLEAR_TOKEN",
  STORE_TOKEN: "STORE_TOKEN",
  UPLOAD_CHUNK: "UPLOAD_CHUNK",
  SAVE_NOTIFICATION: "SAVE_NOTIFICATION",
} as const;