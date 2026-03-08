import type { AuthProvider } from "@refinedev/core";
import { api } from "@/lib/api";
import type { User } from "@/types";

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    try {
      const data = await api.auth.login({ email, password });
      api.storeSession(data);
      window.postMessage({ type: "APCM_AUTH_TOKEN", token: data.access_token }, window.location.origin);

      // Check account status after login
      if (data.user.status !== "active") {
        return { success: true, redirectTo: "/pending" };
      }
      const redirectTo = data.user.profile_complete ? "/" : "/profile/setup";
      return { success: true, redirectTo };
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
      // All new accounts start as pending — go to pending screen
      return { success: true, redirectTo: "/pending" };
    } catch (err) {
      return {
        success: false,
        error: { name: "Registration failed", message: (err as Error).message },
      };
    }
  },

  logout: async () => {
    api.clearSession();
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    const user = api.getStoredUser();
    if (!user) {
      return {
        authenticated: false,
        logout: true,
        redirectTo: "/login",
        error: { name: "Unauthorized", message: "Please log in" },
      };
    }
    // Pending users are "authenticated" (have a token) but get redirected to /pending
    if (user.status !== "active") {
      return {
        authenticated: false,
        redirectTo: "/pending",
        error: { name: "Pending", message: "account_pending" },
      };
    }
    return { authenticated: true };
  },

  getIdentity: async () => {
    return api.getStoredUser() as User | null;
  },

  getPermissions: async () => null,

  onError: async (error) => {
    if (error?.status === 403 && error?.message === "account_pending") {
      return { redirectTo: "/pending" };
    }
    if (error?.response?.status === 401) return { logout: true };
    return { error };
  },
};
