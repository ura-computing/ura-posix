import { NOTIFICATIONS_STORAGE_KEY, TOKEN_STORAGE_KEY } from "../constants";

export interface ApcmNotification {
  id: string;
  fileType: "achat" | "vente" | "stock";
  inserted: number;
  skipped: number;
  timestamp: number;
  read: boolean;
}

// ── Token ──────────────────────────────────────────────────────────────────────

export function getToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(TOKEN_STORAGE_KEY, (result) => {
      resolve((result[TOKEN_STORAGE_KEY] as string | undefined) ?? null);
    });
  });
}

export function setToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [TOKEN_STORAGE_KEY]: token }, resolve);
  });
}

export function clearToken(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(TOKEN_STORAGE_KEY, resolve);
  });
}

// ── Notifications ──────────────────────────────────────────────────────────────

export function getNotifications(): Promise<ApcmNotification[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(NOTIFICATIONS_STORAGE_KEY, (result) => {
      resolve((result[NOTIFICATIONS_STORAGE_KEY] as ApcmNotification[] | undefined) ?? []);
    });
  });
}

export async function addNotification(n: ApcmNotification): Promise<void> {
  const prev = await getNotifications();
  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [NOTIFICATIONS_STORAGE_KEY]: [n, ...prev] }, resolve);
  });
}

export async function dismissNotification(id: string): Promise<void> {
  const prev = await getNotifications();
  await new Promise<void>((resolve) => {
    chrome.storage.local.set(
      { [NOTIFICATIONS_STORAGE_KEY]: prev.filter((n) => n.id !== id) },
      resolve
    );
  });
}

export async function clearNotifications(): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.storage.local.set({ [NOTIFICATIONS_STORAGE_KEY]: [] }, resolve);
  });
}

export async function markAllRead(): Promise<void> {
  const prev = await getNotifications();
  await new Promise<void>((resolve) => {
    chrome.storage.local.set(
      { [NOTIFICATIONS_STORAGE_KEY]: prev.map((n) => ({ ...n, read: true })) },
      resolve
    );
  });
}
