import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QUERY_KEYS } from "@/constants";

type DocType = "achat" | "vente";

const CHUNK_SIZE = 500;

function parseCSVRows(text: string): { header: string; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/);
  const headerLine = lines[0] ?? "";
  const header = headerLine;
  const headers = headerLine.split(";").map((h) => h.replace(/^"|"$/g, "").trim());
  const dataLines = lines.slice(1).filter((l) => l.trim() !== "");
  const rows = dataLines.map((line) => {
    const cells = line.split(";").map((c) => c.replace(/^"|"$/g, "").trim());
    const row: Record<string, string> = {};
    headers.forEach((key, i) => {
      row[key] = cells[i] ?? "";
    });
    return row;
  });
  return { header, rows };
}

export type UploadProgress = { current: number; total: number };

export type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: UploadProgress }
  | { status: "success"; inserted: number; skipped: number }
  | { status: "cancelled"; inserted: number }
  | { status: "error"; message: string };

export function useUploadCsvBatched() {
  const queryClient = useQueryClient();
  const cancelRef = useRef(false);
  const [state, setState] = useState<UploadState>({ status: "idle" });

  const upload = useCallback(async (file: File, docType: DocType) => {
    cancelRef.current = false;
    setState({ status: "uploading", progress: { current: 0, total: 1 } });

    let text: string;
    try {
      text = await file.text();
    } catch {
      setState({ status: "error", message: "Impossible de lire le fichier" });
      return;
    }

    const { rows } = parseCSVRows(text);
    if (rows.length === 0) {
      setState({ status: "error", message: "Fichier CSV vide ou invalide" });
      return;
    }

    const totalChunks = Math.ceil(rows.length / CHUNK_SIZE);
    let totalInserted = 0;
    let totalSkipped = 0;

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      if (cancelRef.current) {
        setState({ status: "cancelled", inserted: totalInserted });
        return;
      }

      const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
      setState({ status: "uploading", progress: { current: chunkNum, total: totalChunks } });

      const chunk = rows.slice(i, i + CHUNK_SIZE);
      try {
        const res = docType === "achat"
          ? await api.uploads.achatJson(chunk)
          : await api.uploads.venteJson(chunk);
        totalInserted += res.inserted ?? 0;
        totalSkipped += res.skipped ?? 0;
      } catch (err) {
        setState({ status: "error", message: (err as Error).message ?? "Erreur d'importation" });
        return;
      }
    }

    queryClient.invalidateQueries({
      queryKey: docType === "achat" ? QUERY_KEYS.achat : QUERY_KEYS.ventes,
    });
    setState({ status: "success", inserted: totalInserted, skipped: totalSkipped });
  }, [queryClient]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const reset = useCallback(() => {
    cancelRef.current = false;
    setState({ status: "idle" });
  }, []);

  return { state, upload, cancel, reset };
}
