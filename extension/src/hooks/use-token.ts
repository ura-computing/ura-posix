import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ACTIONS, API_URL, QUERY_KEYS } from "../constants";

function sendMsg<T>(msg: object): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(res as T);
    });
  });
}

export type AuthState = { token: string; role: string; permissions?: Record<string, boolean> } | null;

async function fetchToken(): Promise<AuthState> {
  const res = await sendMsg<{ token: string | null }>({ action: ACTIONS.GET_TOKEN });
  const token = res.token;
  if (!token) return null;

  // Validate token against the backend and fetch user role
  try {
    const resp = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      await sendMsg({ action: ACTIONS.CLEAR_TOKEN });
      return null;
    }
    const user = await resp.json();
    return { token, role: user.role ?? "employee", permissions: user.permissions ?? {} };
  } catch {
    // Backend unreachable — keep token, assume non-admin
    return { token, role: "unknown" };
  }
}

async function removeToken(): Promise<void> {
  await sendMsg({ action: ACTIONS.CLEAR_TOKEN });
}

export function useToken() {
  return useQuery<AuthState>({
    queryKey: QUERY_KEYS.token,
    queryFn: fetchToken,
    staleTime: Infinity,
  });
}

export function useClearToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeToken,
    onSuccess: () => queryClient.setQueryData(QUERY_KEYS.token, null),
  });
}
