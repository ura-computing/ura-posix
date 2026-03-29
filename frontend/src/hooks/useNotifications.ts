import { useCallback, useEffect, useState } from "react";

export interface ApcmNotification {
  id: string;
  fileType: "achat" | "vente";
  inserted: number;
  skipped: number;
  timestamp: number;
  read: boolean;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<ApcmNotification[]>([]);

  useEffect(() => {
    // Ask content script for current notifications
    window.postMessage({ type: "APCM_REQUEST_NOTIFICATIONS" }, "*");

    const handler = (e: MessageEvent) => {
      if (e.source !== window) return;
      if (e.data?.type === "APCM_NOTIFICATIONS") {
        setNotifications(e.data.notifications ?? []);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const clearAll = useCallback(() => {
    window.postMessage({ type: "APCM_CLEAR_NOTIFICATIONS" }, "*");
  }, []);

  const dismiss = useCallback((id: string) => {
    window.postMessage({ type: "APCM_DISMISS_NOTIFICATION", id }, "*");
  }, []);

  const markAllRead = useCallback(() => {
    window.postMessage({ type: "APCM_MARK_ALL_READ" }, "*");
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, clearAll, dismiss, markAllRead };
}
