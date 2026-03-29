import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  addNotification,
  clearNotifications,
  dismissNotification,
  getNotifications,
  markAllRead,
  type ApcmNotification,
} from "../lib/storage";

const QUERY_KEY = ["notifications"] as const;

export type { ApcmNotification };

export function useNotifications() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getNotifications,
    staleTime: 0,
  });

  // Keep the cache in sync when chrome.storage changes (e.g. new upload from background)
  useEffect(() => {
    const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ("apcm_notifications" in changes) {
        queryClient.setQueryData(QUERY_KEY, changes["apcm_notifications"].newValue ?? []);
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, [queryClient]);

  const { mutate: dismiss } = useMutation({
    mutationFn: (id: string) => dismissNotification(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const { mutate: clearAll } = useMutation({
    mutationFn: clearNotifications,
    onSuccess: () => queryClient.setQueryData(QUERY_KEY, []),
  });

  const { mutate: readAll } = useMutation({
    mutationFn: markAllRead,
    onSuccess: () =>
      queryClient.setQueryData<ApcmNotification[]>(QUERY_KEY, (prev) =>
        (prev ?? []).map((n) => ({ ...n, read: true }))
      ),
  });

  const notifications = query.data ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    isLoading: query.isLoading,
    dismiss,
    clearAll,
    readAll,
    addNotification: (n: ApcmNotification) =>
      addNotification(n).then(() => queryClient.invalidateQueries({ queryKey: QUERY_KEY })),
  };
}
