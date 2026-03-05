import type { AuthProvider } from "@refinedev/core";
import { api } from "@/lib/api";
import type { User } from "@/types";

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    try {
      const data = await api.auth.login({ email, password });
      api.storeSession(data);
      const redirectTo = data.user.profile_complete ? "/" : "/profile/setup";
      return { success: true, redirectTo };
    } catch (err) {
      return {
        success: false,
        error: { name: "Login failed", message: (err as Error).message },
      };
    }
  },

  register: async ({ email, password, name }) => {
    try {
      const data = await api.auth.register({ email, password, name });
      api.storeSession(data);
      return { success: true, redirectTo: "/profile/setup" };
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
    if (user) return { authenticated: true };
    return {
      authenticated: false,
      logout: true,
      redirectTo: "/login",
      error: { name: "Unauthorized", message: "Please log in" },
    };
  },

  getIdentity: async () => {
    return api.getStoredUser() as User | null;
  },

  getPermissions: async () => null,

  onError: async (error) => {
    if (error?.response?.status === 401) return { logout: true };
    return { error };
  },
};
