import { translate } from "@/i18n/I18nProvider";

/** Single source of truth for the API base URL.
 *
 *  - With VITE_BACKEND_URL set (production docker build, or dev w/ env file):
 *    absolute URL → cross-origin fetch → backend CORS (allow_credentials=True
 *    + FRONTEND_URL origin) handles the cookie flow.
 *  - Without it (dev with no env): falls back to "/v1" → Vite dev-server proxy
 *    forwards to VITE_BACKEND_URL.
 *
 *  Only `request()` below uses it — don't re-declare BASE elsewhere. */
const API_BASE = `${import.meta.env.VITE_BACKEND_URL ?? ""}/v1`;

export class ApiErr extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

interface ApiOptions extends Omit<RequestInit, "body" | "method"> {
  /** Query string: arrays → repeated keys, null / undefined / "" skipped. */
  params?: object;
}

// Global 401 escape hatch — main.tsx registers a handler that clears the `me`
// cache, which makes AppLayout's auth guard bounce to /login. This keeps the
// fetch wrapper ignorant of TanStack Query and React Router.
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

function toQuery(params?: object): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    for (const x of Array.isArray(v) ? v : [v]) {
      if (x != null && x !== "") p.append(k, String(x));
    }
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

async function request<T>(method: string, path: string, body?: unknown, opts: ApiOptions = {}): Promise<T> {
  const { params, headers, ...rest } = opts;
  // FormData (file upload): the browser sets the multipart Content-Type + boundary.
  const form = body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}${toQuery(params)}`, {
      method,
      credentials: "include",
      headers: {
        ...(form ? {} : { "Content-Type": "application/json" }),
        "X-Requested-With": "XMLHttpRequest",
        ...headers,
      },
      body: body == null ? undefined : form ? body : JSON.stringify(body),
      ...rest,
    });
  } catch {
    // Server down / no network: fetch throws a TypeError with an English message.
    throw new ApiErr(0, translate("toast.networkError"));
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: ReturnType<typeof JSON.parse> = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body (proxy error page) */
  }

  if (!res.ok) {
    // `{detail, code, params}` (backend errors.py) → `errors.<code>` in the UI language.
    // Unknown code → the French `detail`, else a generic message.
    const key = `errors.${data?.code}`;
    const text = translate(key, data?.params);
    const detail =
      text !== key ? text : typeof data?.detail === "string" ? data.detail : translate("toast.genericError");
    if (res.status === 401) onUnauthorized?.();
    throw new ApiErr(res.status, detail);
  }

  return data as T;
}

/** `api.get<Row[]>(API.x.list.url, { params })`, `api.delete(API.x.remove.url(id))`.
 *  Paths live in `api/api.ts`. */
export const api = {
  get: <T>(path: string, opts?: ApiOptions) => request<T>("GET", path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: ApiOptions) => request<T>("POST", path, body, opts),
  put: <T>(path: string, body?: unknown, opts?: ApiOptions) => request<T>("PUT", path, body, opts),
  patch: <T>(path: string, body?: unknown, opts?: ApiOptions) => request<T>("PATCH", path, body, opts),
  delete: <T = void>(path: string, opts?: ApiOptions) => request<T>("DELETE", path, undefined, opts),
  /** Multipart POST of one file under the "file" field. */
  upload: <T>(path: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<T>("POST", path, fd);
  },
};
