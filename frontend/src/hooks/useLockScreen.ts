/** Lock screen (« Mon compte » → « Verrouillage »):
 *  - `useIdleLock`: after `lock.seconds` with no click, key, touch or scroll in ANY tab of the app (the last activity is
 *    shared through localStorage: one tab in use keeps the others open), this device's session is locked
 *    (`POST /auth/lock`) and `me` refreshed → `AppLayout` shows `LockScreen` over the page (nothing is lost under it);
 *  - `useLockNow`: « Verrouiller l'écran » (sidebar), the same lock at once;
 *  - `useUnlock`: the 6-digit code → every query again (they got 423 while locked); 5 wrong codes → logged out.
 *  Locking / unlocking reaches the other tabs at once (BroadcastChannel). */
import { useEffect } from "react";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { API } from "@/api/api";
import { api, type ApiErr } from "@/api/client";
import { useLogout } from "@/hooks/useLogout";
import type { LockState, MeResponse } from "@/types/auth";

const ACTIVITY_KEY = "pg-last-activity";
const CHANNEL = "pg-lock";
const EVENTS = ["pointerdown", "keydown", "mousemove", "wheel", "touchstart", "scroll"] as const;

function readActivity(): number {
  try {
    return Number(localStorage.getItem(ACTIVITY_KEY)) || 0;
  } catch {
    return 0; // storage blocked: this tab's own activity only
  }
}

function writeActivity(at: number): void {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(at));
  } catch {
    // storage blocked: this tab's own activity only
  }
}

function tellOtherTabs(): void {
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage("lock-changed");
    channel.close();
  } catch {
    // no BroadcastChannel: the other tabs see it at their next request (423)
  }
}

/** This device's session locks; `me` refreshed → the lock screen (here and in the other tabs). */
async function lockThisDevice(qc: QueryClient): Promise<void> {
  await api.post(API.auth.lock.url);
  tellOtherTabs();
  await qc.invalidateQueries({ queryKey: API.auth.me.key });
}

export function useIdleLock(lock: LockState | undefined) {
  const qc = useQueryClient();
  const enabled = !!lock?.enabled && lock.has_pin && !lock.locked;
  const limitMs = (lock?.seconds ?? 300) * 1000;

  // Another tab locked or unlocked: this one follows.
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = () => void qc.invalidateQueries({ queryKey: API.auth.me.key });
    } catch {
      channel = null;
    }
    return () => channel?.close();
  }, [qc]);

  useEffect(() => {
    if (!enabled) return;
    let last = Date.now();
    writeActivity(last);
    let written = last;
    const onActivity = () => {
      last = Date.now();
      if (last - written > 5000) {
        written = last; // at most one write every 5 s
        writeActivity(last);
      }
    };
    for (const e of EVENTS) window.addEventListener(e, onActivity, { passive: true });
    const timer = window.setInterval(() => {
      const idle = Date.now() - Math.max(last, readActivity());
      if (idle < limitMs) return;
      window.clearInterval(timer);
      void lockThisDevice(qc);
    }, 1000); // 15 s is a choice: checked every second
    return () => {
      window.clearInterval(timer);
      for (const e of EVENTS) window.removeEventListener(e, onActivity);
    };
  }, [enabled, limitMs, qc]);
}

/** « Verrouiller l'écran »: lock now, without waiting for the idle delay (the counter PC left for a minute). */
export function useLockNow() {
  const qc = useQueryClient();
  const { mutate, isPending } = useMutation({ mutationFn: () => lockThisDevice(qc) });
  return {
    lockNow: () => mutate(),
    isLocking: isPending,
  };
}

export function useUnlock() {
  const qc = useQueryClient();
  const { handleLogout } = useLogout();
  const { mutateAsync, isPending, error, reset } = useMutation<MeResponse, ApiErr, string>({
    mutationFn: (pin) => api.post<MeResponse>(API.auth.unlock.url, { pin }),
    onSuccess: () => {
      writeActivity(Date.now());
      tellOtherTabs();
      void qc.invalidateQueries(); // everything that got 423 while locked
    },
    onError: (err) => {
      if (err.status !== 403) return;
      toast.error(err.detail); // 5 wrong codes (`pinTooMany`): this session is over
      handleLogout();
    },
  });
  return {
    unlock: (pin: string) => mutateAsync(pin).then(() => undefined),
    isUnlocking: isPending,
    unlockError: error?.status === 400 ? error.detail : null,
    clearError: reset,
    logout: handleLogout,
  };
}
