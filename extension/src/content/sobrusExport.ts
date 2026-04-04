/**
 * ISOLATED WORLD content script — Sobrus export pages.
 *
 * Intercepts CSV download clicks, queues them, and processes one at a time.
 * Jobs array is kept in memory (no async read-modify-write race conditions).
 */

import { ACTIONS, CANCEL_UPLOAD_KEY, UPLOAD_STATUS_KEY } from "../constants";

const CHUNK_SIZE = 500;

export type UploadJob = {
  id: string;
  state: "queued" | "uploading" | "success" | "error" | "cancelled";
  fileType: "achat" | "vente";
  filename?: string;
  current?: number;
  total?: number;
  inserted?: number;
  skipped?: number;
  error?: string;
  timestamp: number;
};

function detectFileType(headerLine: string): "achat" | "vente" {
  const h = headerLine.toLowerCase();
  if (h.includes("référence de livraison") || h.includes("bon de livraison") || h.includes("fournisseur")) {
    return "achat";
  }
  return "vente";
}

function isExtensionAlive(): boolean {
  try { return !!chrome.runtime?.id; } catch { return false; }
}

function sendMsg<T>(msg: object): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!isExtensionAlive()) {
      reject(new Error("context_invalidated"));
      return;
    }
    try {
      chrome.runtime.sendMessage(msg, (res) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(res as T);
      });
    } catch (err) {
      reject(err);
    }
  });
}

// ── In-memory jobs (source of truth) ────────────────────────────────────────

let _jobs: UploadJob[] = [];

// Hydrate from storage once on load — only keep active/recent jobs
chrome.storage.local.get(UPLOAD_STATUS_KEY, (res) => {
  const raw = res[UPLOAD_STATUS_KEY];
  if (Array.isArray(raw)) {
    const now = Date.now();
    _jobs = raw.filter((j: UploadJob) =>
      j.state === "uploading" || j.state === "queued" || (now - j.timestamp < 60_000)
    );
    if (_jobs.length < raw.length) _syncToStorage();
  }
});

function _syncToStorage() {
  chrome.storage.local.set({ [UPLOAD_STATUS_KEY]: _jobs });
}

function updateJob(jobId: string, patch: Partial<UploadJob>) {
  const idx = _jobs.findIndex((j) => j.id === jobId);
  if (idx !== -1) {
    _jobs[idx] = { ..._jobs[idx], ...patch, timestamp: Date.now() };
    _syncToStorage();
  }
}

// ── Queue ───────────────────────────────────────────────────────────────────

type QueueItem = { apiUrl: string; filename?: string; jobId: string };
const _queue: QueueItem[] = [];
let _processing = false;

document.addEventListener(
  "click",
  (e) => {
    const anchor = (e.target as Element).closest<HTMLAnchorElement>(
      'a[download][href*="api.pharma.sobrus.com/reports/exports"]'
    );
    if (!anchor) return;

    e.preventDefault();
    e.stopPropagation();

    const filename = anchor.download || anchor.textContent?.trim() || undefined;
    const jobId = crypto.randomUUID();
    const fileType = filename?.toLowerCase().includes("achat") ? "achat" as const : "vente" as const;

    // Add queued job to in-memory array + storage
    _jobs.push({
      id: jobId,
      state: "queued",
      fileType,
      filename,
      timestamp: Date.now(),
    });
    _syncToStorage();

    // Add to processing queue
    _queue.push({ apiUrl: anchor.href, filename, jobId });
    if (!_processing) processQueue();
  },
  true,
);

async function processQueue() {
  if (_processing) return;
  _processing = true;

  while (_queue.length > 0) {
    const item = _queue.shift()!;
    await handleExport(item.apiUrl, item.filename, item.jobId);
  }

  _processing = false;
}

// ── Export handler ───────────────────────────────────────────────────────────

async function handleExport(apiUrl: string, filename: string | undefined, jobId: string) {
  const update = (patch: Partial<UploadJob>) => updateJob(jobId, patch);

  update({ state: "uploading", current: 0, total: 1 });

  try {
    // 1. Fetch CSV from Sobrus
    let csvText: string;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      let res: Response;
      try {
        res = await fetch(apiUrl, { credentials: "include", signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      csvText = await res.text();
    } catch (err) {
      update({ state: "error", error: `Téléchargement échoué: ${(err as Error).message}` });
      return;
    }

    // 2. Detect type + split
    const lines = csvText.split("\n");
    const header = lines[0];
    const fileType = detectFileType(header);
    const dataLines = lines.slice(1).filter((l) => l.trim() !== "");

    update({ fileType });

    if (dataLines.length === 0) {
      update({ state: "error", error: "Fichier CSV vide" });
      return;
    }

    const totalChunks = Math.ceil(dataLines.length / CHUNK_SIZE);
    let totalInserted = 0;
    let totalSkipped = 0;
    let batchId: number | undefined;

    // 3. Send chunks one by one
    for (let i = 0; i < dataLines.length; i += CHUNK_SIZE) {
      // Check cancellation
      const cancelCheck = await new Promise<boolean>((resolve) => {
        chrome.storage.local.get(CANCEL_UPLOAD_KEY, (res) => resolve(!!(res[CANCEL_UPLOAD_KEY])));
      });
      if (cancelCheck) {
        chrome.storage.local.remove(CANCEL_UPLOAD_KEY);
        update({ state: "cancelled", inserted: totalInserted, skipped: totalSkipped });
        return;
      }

      const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
      update({ state: "uploading", current: chunkNum, total: totalChunks });

      const csvChunk = [header, ...dataLines.slice(i, i + CHUNK_SIZE)].join("\n");

      try {
        const res = await sendMsg<{ success: boolean; inserted?: number; skipped?: number; batch_id?: number; error?: string }>({
          action: ACTIONS.UPLOAD_CHUNK,
          csvChunk,
          fileType,
          filename,
          batchId,
        });
        if (!res.success) throw new Error(res.error ?? "Erreur inconnue");
        if (res.batch_id) batchId = res.batch_id;
        totalInserted += res.inserted ?? 0;
        totalSkipped += res.skipped ?? 0;
      } catch (err) {
        update({ state: "error", error: (err as Error).message });
        return;
      }
    }

    // 4. Success
    update({ state: "success", inserted: totalInserted, skipped: totalSkipped });

    if (isExtensionAlive()) {
      chrome.runtime.sendMessage({
        action: ACTIONS.SAVE_NOTIFICATION,
        fileType,
        inserted: totalInserted,
        skipped: totalSkipped,
      });
    }
  } catch {
    update({ state: "error", error: "Erreur inattendue" });
  }
}
