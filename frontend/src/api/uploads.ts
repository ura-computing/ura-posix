import { request, uploadFile } from "./client";
import { ENDPOINTS } from "@/constants";

export const achat = (file: File) =>
  uploadFile<{ inserted: number }>(ENDPOINTS.uploads.achat, file);

export const vente = (file: File) =>
  uploadFile<{ inserted: number }>(ENDPOINTS.uploads.vente, file);

export const achatJson = (rows: Record<string, string>[]) =>
  request<{ inserted: number; skipped: number }>(ENDPOINTS.uploads.achatJson, {
    method: "POST",
    body: JSON.stringify({ rows }),
  });

export const venteJson = (rows: Record<string, string>[]) =>
  request<{ inserted: number; skipped: number }>(ENDPOINTS.uploads.venteJson, {
    method: "POST",
    body: JSON.stringify({ rows }),
  });

export const catalog = (file: File) =>
  uploadFile<{ imported: number }>("/uploads/catalog", file);

export type StockUploadResult = {
  inserted: number;
  skipped_unknown: { pid: string; product: string }[];
  total_rows: number;
};

export const stock = (file: File) =>
  uploadFile<StockUploadResult>(ENDPOINTS.uploads.stock, file);
