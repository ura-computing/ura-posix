import type { AuthProvider } from "@refinedev/core";
import { api } from "@/lib/api";
import type { User } from "@/types";

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    try {
      const data = await api.auth.login({ email, password });
      api.storeSession(data);
      window.postMessage({ type: "APCM_AUTH_TOKEN", token: data.access_token }, window.location.origin);

      return { success: true, redirectTo: "/" };
    } catch (err) {
      return {
        success: false,
        error: { name: "Login failed", message: (err as Error).message },
      };
    }
  },

  register: async (payload) => {
    try {
      const data = await api.auth.register(payload);
      api.storeSession(data);
      window.postMessage({ type: "APCM_AUTH_TOKEN", token: data.access_token }, window.location.origin);
      // New accounts are pending — setup profile first, then "/" shows the pending notice
      return { success: true, redirectTo: "/profile/setup" };
    } catch (err) {
      return {
        success: false,
        error: { name: "Registration failed", message: (err as Error).message },
      };
    }
  },

  logout: async () => {
    window.postMessage({ type: "APCM_CLEAR_TOKEN" }, window.location.origin);
    api.clearSession();
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    const token = sessionStorage.getItem("pharmagest_token");
    if (!token) {
      return {
        authenticated: false,
        logout: true,
        redirectTo: "/login",
        error: { name: "Unauthorized", message: "Please log in" },
      };
    }
    // Pending users are authenticated — they land on "/" and see the pending notice
    return { authenticated: true };
  },

  getIdentity: async () => {
    try {
      return await api.auth.me() as User;
    } catch {
      return null;
    }
  },

  getPermissions: async () => null,

  onError: async (error) => {
    if (error?.response?.status === 401) return { logout: true };
    return { error };
  },
};
