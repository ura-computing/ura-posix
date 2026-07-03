import { api } from "@/api/client";
import type { DataImportsResponse } from "@/types";


export function listImports(page = 1, limit = 50): Promise<DataImportsResponse> {
  return api(`/data/imports?page=${page}&limit=${limit}`);
}

export function deleteImport(batchId: number): Promise<{ id: number; deleted_rows: number; file_type: string }> {
  return api(`/data/imports/${batchId}`, { method: "DELETE" });
}