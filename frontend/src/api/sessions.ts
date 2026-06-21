import { api } from "@/api/client";
import type { Session } from "@/types";

export function listSessions(): Promise<Session[]> {
  return api<Session[]>("/sessions");
}

export function killSession(sessionId: string): Promise<void> {
  return api<void>(`/sessions/${sessionId}`, { method: "DELETE" });
}

export function revokeOtherSessions(): Promise<void> {
  return api<void>("/sessions/revoke-others", { method: "POST" });
}