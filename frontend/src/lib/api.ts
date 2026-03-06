import { API_URL, ENDPOINTS, TOKEN_KEY, USER_KEY } from "@/constants";
import type { AuthToken, LoginPayload, ProfileUpdatePayload, RegisterPayload, User } from "@/types";

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }

  return res.json() as Promise<T>;
}

async function uploadFile<T>(path: string, file: File): Promise<T> {
  const token = getToken();
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Upload failed");
  }
  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    login: (payload: LoginPayload) =>
      request<AuthToken>(ENDPOINTS.auth.login, { method: "POST", body: JSON.stringify(payload) }),

    register: (payload: RegisterPayload) =>
      request<AuthToken>(ENDPOINTS.auth.register, { method: "POST", body: JSON.stringify(payload) }),

    me: () => request<User>(ENDPOINTS.auth.me),

    updateMe: (payload: ProfileUpdatePayload) =>
      request<User>(ENDPOINTS.auth.me, { method: "PUT", body: JSON.stringify(payload) }),
  },

  uploads: {
    achat: (file: File) => uploadFile<{ inserted: number }>(ENDPOINTS.uploads.achat, file),
    vente: (file: File) => uploadFile<{ inserted: number }>(ENDPOINTS.uploads.vente, file),
  },

  tables: {
    achatCategories: () => request<string[]>(ENDPOINTS.achat.categories),
    venteCategories: () => request<string[]>(ENDPOINTS.ventes.categories),
    exportAchat: (search: string, categories: string[], dateFrom?: string, dateTo?: string) => {
      const p = new URLSearchParams({ export: "true" });
      if (search) p.set("search", search);
      categories.forEach((cat) => p.append("category", cat));
      if (dateFrom) p.set("date_from", dateFrom);
      if (dateTo) p.set("date_to", dateTo);
      return request<{ data: Record<string, unknown>[] }>(`${ENDPOINTS.achat.list}?${p}`);
    },
    exportVente: (search: string, categories: string[], dateFrom?: string, dateTo?: string) => {
      const p = new URLSearchParams({ export: "true" });
      if (search) p.set("search", search);
      categories.forEach((cat) => p.append("category", cat));
      if (dateFrom) p.set("date_from", dateFrom);
      if (dateTo) p.set("date_to", dateTo);
      return request<{ data: Record<string, unknown>[] }>(`${ENDPOINTS.ventes.list}?${p}`);
    },
  },

  data: {
    clearAchats: () => request<{ deleted: number }>(ENDPOINTS.data.achats, { method: "DELETE" }),
    clearVentes: () => request<{ deleted: number }>(ENDPOINTS.data.ventes, { method: "DELETE" }),
  },

  storeSession: (data: AuthToken) => {
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  },

  clearSession: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  getStoredUser: (): User | null => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  },
};
