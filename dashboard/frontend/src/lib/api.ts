import { API_URL, TOKEN_KEY, USER_KEY } from "@/constants";
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

export const api = {
  auth: {
    login: (payload: LoginPayload) =>
      request<AuthToken>("/auth/login", { method: "POST", body: JSON.stringify(payload) }),

    register: (payload: RegisterPayload) =>
      request<AuthToken>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),

    me: () => request<User>("/auth/me"),

    updateMe: (payload: ProfileUpdatePayload) =>
      request<User>("/auth/me", { method: "PUT", body: JSON.stringify(payload) }),
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
