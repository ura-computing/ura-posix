import { resolve } from "node:path";

export const API = "http://localhost:8001";
export const WEB = "http://localhost:5174";

export const E2E_DIR = resolve(__dirname, "..");
export const REPO_DIR = resolve(E2E_DIR, "..");
export const RESULTS_DIR = resolve(E2E_DIR, ".results"); // calls.jsonl (coverage + timings)
export const STATE_DIR = resolve(E2E_DIR, ".state"); // logged-in sessions + ids
export const CALLS_FILE = resolve(RESULTS_DIR, "calls.jsonl");
export const UI_FILE = resolve(RESULTS_DIR, "ui.jsonl"); // interactive elements seen / used (UI gate)
export const COMPARED_FILE = resolve(RESULTS_DIR, "compared.jsonl"); // values compared with the oracle (summary)
export const EXPECTED_FILE = resolve(REPO_DIR, "resources/tests/expected.json");
