import { request } from "./client";

export type BlExclusion = {
  id: number;
  delivery_ref: string;
  notes: string | null;
  created_at: string | null;
  supplier: string | null;
  delivery_date: string | null;
  total_mad: number | null;
  nb_lines: number | null;
};

export type BlSuggestion = {
  delivery_ref: string;
  supplier: string | null;
  delivery_date: string | null;
  total_mad: number;
  nb_lines: number;
};

export const listExclusions = () =>
  request<BlExclusion[]>("/bl-exclusions");

export const createExclusion = (body: { delivery_ref: string; notes?: string }) =>
  request<BlExclusion>("/bl-exclusions", { method: "POST", body: JSON.stringify(body) });

export const deleteExclusion = (deliveryRef: string) =>
  request<{ deleted: boolean; delivery_ref: string }>(
    `/bl-exclusions/${encodeURIComponent(deliveryRef)}`,
    { method: "DELETE" },
  );

export const suggestBls = (q: string) =>
  request<BlSuggestion[]>(`/bl-exclusions/suggestions?q=${encodeURIComponent(q)}`);
