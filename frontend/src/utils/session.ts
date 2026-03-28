import { TOKEN_KEY } from "@/constants";

export const getToken = (): string | null => sessionStorage.getItem(TOKEN_KEY);
export const storeSession = (token: string): void => sessionStorage.setItem(TOKEN_KEY, token);
export const clearSession = (): void => sessionStorage.removeItem(TOKEN_KEY);
export const hasSession = (): boolean => !!sessionStorage.getItem(TOKEN_KEY);
