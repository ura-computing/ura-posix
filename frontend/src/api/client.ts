import type { ApiError } from "@/types";

const BASE = "/v1";

export class ApiErr extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

// Global 401 escape hatch — main.tsx registers a handler that clears the `me`
// cache, which makes AppLayout's auth guard bounce to /login. This keeps the
// fetch wrapper ignorant of TanStack Query and React Router.
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { body, headers, ...rest } = opts;
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...headers,
    },
    body: body == null ? undefined : JSON.stringify(body),
    ...rest,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const detail = typeof data?.detail === "string"
      ? data.detail
      : Array.isArray(data?.detail)
        ? data.detail.map((e: { msg: string }) => e.msg).join(", ")
        : "Une erreur est survenue. Réessayez plus tard.";
    if (res.status === 401) onUnauthorized?.();
    throw new ApiErr(res.status, detail);
  }

  return data as T;
}

export type { ApiError };