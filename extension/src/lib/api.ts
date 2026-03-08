import { API_URL } from "../constants";
import { getToken } from "./storage";

export interface UploadResult {
  inserted: number;
  skipped: number;
}

export async function uploadCsv(
  fileType: "achat" | "vente",
  csvText: string
): Promise<UploadResult> {
  const token = await getToken();
  if (!token) throw new Error("Non authentifié");

  const endpoint = fileType === "achat" ? "/uploads/achat" : "/uploads/vente";
  const blob = new Blob([csvText], { type: "text/csv" });
  const formData = new FormData();
  formData.append("file", blob, "export.csv");

  const res = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${text}`);
  }

  return res.json() as Promise<UploadResult>;
}
