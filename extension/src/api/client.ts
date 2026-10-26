/** Same client as the app (frontend/src/api/client.ts): every call goes to `${VITE_BACKEND_URL}/v1`
 *  with the cookies of the PharmaGest session open in the browser (httpOnly `access_token`).
 *  Errors keep the backend `code` (`{detail, code, params}`, app/core/errors.py): the screen shows
 *  `errors.<code>` in the user's language. Runs in the service worker and the popup. */

const API_BASE = `${(import.meta.env.VITE_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "")}/v1`;

export class ApiErr extends Error {
  status: number;
  code: string;
  detail: string;
  params: Record<string, string>;

  constructor(status: number, code: string, detail: string, params: Record<string, string> = {}) {
    super(detail);
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.params = params;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
      body: body == null ? undefined : JSON.stringify(body),
    });
  } catch {
    // Server down / no network: fetch throws a TypeError with an English message.
    throw new ApiErr(0, "network", "PharmaGest injoignable");
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: { code?: string; detail?: unknown; params?: Record<string, string> } | null = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body (proxy error page) */
  }

  if (!res.ok) {
    // No code: a 5xx (proxy page, platform down) = « Le logiciel a rencontré un problème ».
    const code = data?.code ?? (res.status >= 500 ? "serverError" : "unknown");
    const detail = typeof data?.detail === "string" ? data.detail : `HTTP ${res.status}`;
    throw new ApiErr(res.status, code, detail, data?.params ?? {});
  }

  return data as T;
}

/** `api.get<MeResponse>(API.auth.me.url)`, `api.post(API.uploads.vente.url, body)`. Paths live in `api/api.ts`. */
export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
};
