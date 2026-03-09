import type { DataProvider } from "@refinedev/core";
import { API_URL, TOKEN_KEY } from "@/constants";

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json();
}

export const dataProvider: DataProvider = {
  getList: async ({ resource, pagination, filters, meta }) => {
    const page =
      (pagination as { currentPage: number | undefined })?.currentPage ?? 1;
    const limit = pagination?.pageSize ?? 10;

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));

    filters?.forEach((filter) => {
      if ("field" in filter) {
        if (filter.field === "search" || filter.field === "name") {
          params.set("search", String(filter.value));
        } else if (
          filter.field === "categories" &&
          Array.isArray(filter.value)
        ) {
          (filter.value as string[]).forEach((cat) =>
            params.append("category", cat),
          );
        } else if (filter.field === "tva" && Array.isArray(filter.value)) {
          (filter.value as string[]).forEach((t) => params.append("tva", t));
        } else if (filter.field === "date_from" || filter.field === "date_to") {
          if (filter.value) params.set(filter.field, String(filter.value));
        }
      }
    });

    const basePath = (meta as { path?: string })?.path ?? `/${resource}`;
    const payload = await apiFetch(`${basePath}?${params}`);
    return {
      data: payload.data ?? [],
      total: payload.pagination?.total ?? payload.data?.length ?? 0,
    };
  },

  create: async ({ resource, variables }) => {
    const payload = await apiFetch(`/${resource}`, {
      method: "POST",
      body: JSON.stringify(variables),
    });
    return { data: payload.data ?? payload };
  },

  getOne: async ({ resource, id }) => {
    const payload = await apiFetch(`/${resource}/${id}`);
    return { data: payload.data ?? payload };
  },

  update: async ({ resource, id, variables }) => {
    const payload = await apiFetch(`/${resource}/${id}`, {
      method: "PUT",
      body: JSON.stringify(variables),
    });
    return { data: payload.data ?? payload };
  },

  deleteOne: async ({ resource, id }) => {
    const payload = await apiFetch(`/${resource}/${id}`, { method: "DELETE" });
    return { data: payload.data ?? payload };
  },

  getApiUrl: () => API_URL,
};
