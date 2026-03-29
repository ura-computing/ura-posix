import { TOKEN_KEY } from "@/constants";

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const storeSession = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const clearSession = (): void => localStorage.removeItem(TOKEN_KEY);
export const hasSession = (): boolean => !!localStorage.getItem(TOKEN_KEY);
