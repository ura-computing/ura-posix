import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { me } from "@/api/auth";
import { QUERY_KEYS } from "@/constants";
import type { User } from "@/types";

/**
 * Polls GET /auth/me every 4 seconds while the tab is active.
 * Detects status changes (pending→active, active→pending) and updates
 * the React Query cache so the UI reacts immediately without a re-login.
 */
export function useStatusPoller(user: User | null | undefined) {
  const queryClient = useQueryClient();
  const prevStatus = useRef(user?.status);

  useEffect(() => {
    if (!user) return;

    prevStatus.current = user.status;

    const interval = setInterval(async () => {
      try {
        const fresh = await me();
        const statusChanged = fresh.status !== prevStatus.current;
        const permissionsChanged = JSON.stringify(fresh.permissions) !== JSON.stringify(user?.permissions);
        if (statusChanged || permissionsChanged) {
          prevStatus.current = fresh.status;
          queryClient.setQueryData(QUERY_KEYS.me, fresh);
        }
      } catch {
        // Network error — silently ignore, will retry next tick
      }
    }, 4_000);

    return () => clearInterval(interval);
  }, [user?.id, queryClient, user]);
}
