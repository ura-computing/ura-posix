import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ACTIONS, QUERY_KEYS } from "../constants";

function sendMsg<T>(msg: object): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(res as T);
    });
  });
}

async function fetchToken(): Promise<string | null> {
  const res = await sendMsg<{ token: string | null }>({ action: ACTIONS.GET_TOKEN });
  return res.token;
}

async function removeToken(): Promise<void> {
  await sendMsg({ action: ACTIONS.CLEAR_TOKEN });
}

export function useToken() {
  return useQuery({
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
