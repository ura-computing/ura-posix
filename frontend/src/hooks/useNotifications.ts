/** The bell: my last 30 lines (checked every minute), how many are unread, mark one / all as read. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { API, refresh } from "@/api/api";
import type { NotificationsOut } from "@/types";

export function useNotifications() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: API.notifications.list.key,
    queryFn: () => api.get<NotificationsOut>(API.notifications.list.url),
    refetchInterval: 60_000,
  });
  const { mutate: markRead } = useMutation({
    mutationFn: (id: number) => api.post(API.notifications.read.url(id)),
    onSuccess: () => void refresh(qc, API.notifications.read),
  });
  const { mutate: markAllRead } = useMutation({
    mutationFn: () => api.post(API.notifications.readAll.url),
    onSuccess: () => void refresh(qc, API.notifications.readAll),
  });
  return {
    notifications: data?.items ?? [],
    unread: data?.unread ?? 0,
    markRead,
    markAllRead,
  };
}
