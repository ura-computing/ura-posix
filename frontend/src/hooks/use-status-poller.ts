import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { USER_KEY } from "@/constants";
import type { User } from "@/types";

/**
 * Polls GET /auth/me every 4 seconds for all logged-in users.
 * Detects both approvals (pending→active) and revocations (active→pending),
 * updates localStorage and invalidates Refine's identity cache so the UI
 * reacts immediately without a re-login.
 */
export function useStatusPoller(user: User | null | undefined) {
  const queryClient = useQueryClient();
  const prevStatus = useRef(user?.status);

  useEffect(() => {
    if (!user) return;

    prevStatus.current = user.status;

    const interval = setInterval(async () => {
      try {
        const fresh = await api.auth.me();
        if (fresh.status !== prevStatus.current) {
          prevStatus.current = fresh.status;
          localStorage.setItem(USER_KEY, JSON.stringify(fresh));
          // Immediately push new identity to all subscribers (no async refetch delay)
          queryClient.setQueryData(["getUserIdentity"], fresh);
        }
      } catch {
        // Network error — silently ignore, will retry next tick
      }
    }, 4_000);

    return () => clearInterval(interval);
  }, [user?.id, queryClient]);
}
