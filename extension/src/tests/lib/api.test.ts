import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock storage module before importing api
vi.mock("../../lib/storage", () => ({
  getToken: vi.fn(),
}));

// Mock constants to avoid import.meta.env issues
vi.mock("../../constants", () => ({
  API_URL: "http://localhost:8000",
}));

import { uploadCsv } from "../../lib/api";
import { getToken } from "../../lib/storage";

const mockedGetToken = vi.mocked(getToken);

describe("uploadCsv", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    mockedGetToken.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when no token is available", async () => {
    mockedGetToken.mockResolvedValue(null);

    await expect(uploadCsv("vente", "header\nrow1")).rejects.toThrow("Non authentifié");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends correct FormData with file blob for vente", async () => {
    mockedGetToken.mockResolvedValue("test-token");
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ inserted: 5, skipped: 1, batch_id: 42 }),
    });

    const result = await uploadCsv("vente", "header\nrow1");

    expect(fetchSpy).toHaveBeenCalledOnce();

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://localhost:8000/uploads/vente");
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);

    expect(result).toEqual({ inserted: 5, skipped: 1, batch_id: 42 });
  });

  it("sends to achat endpoint for achat file type", async () => {
    mockedGetToken.mockResolvedValue("test-token");
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ inserted: 3, skipped: 0, batch_id: 1 }),
    });

    await uploadCsv("achat", "header\nrow1");

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://localhost:8000/uploads/achat");
  });

  it("passes filename correctly in FormData", async () => {
    mockedGetToken.mockResolvedValue("test-token");
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ inserted: 0, skipped: 0, batch_id: 1 }),
    });

    await uploadCsv("vente", "header\nrow1", "sales-export.csv");

    const [, options] = fetchSpy.mock.calls[0];
    const formData = options.body as FormData;
    const file = formData.get("file") as File;
    expect(file).toBeTruthy();
    expect(file.name).toBe("sales-export.csv");
  });

  it("uses default filename when none is provided", async () => {
    mockedGetToken.mockResolvedValue("test-token");
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ inserted: 0, skipped: 0, batch_id: 1 }),
    });

    await uploadCsv("vente", "header\nrow1");

    const [, options] = fetchSpy.mock.calls[0];
    const formData = options.body as FormData;
    const file = formData.get("file") as File;
    expect(file.name).toBe("export.csv");
  });

  it("includes batch_id in FormData when provided", async () => {
    mockedGetToken.mockResolvedValue("test-token");
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ inserted: 0, skipped: 0, batch_id: 99 }),
    });

    await uploadCsv("vente", "header\nrow1", undefined, 99);

    const [, options] = fetchSpy.mock.calls[0];
    const formData = options.body as FormData;
    expect(formData.get("batch_id")).toBe("99");
  });

  it("does not include batch_id when not provided", async () => {
    mockedGetToken.mockResolvedValue("test-token");
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ inserted: 0, skipped: 0, batch_id: 1 }),
    });

    await uploadCsv("vente", "header\nrow1");

    const [, options] = fetchSpy.mock.calls[0];
    const formData = options.body as FormData;
    expect(formData.get("batch_id")).toBeNull();
  });

  it("adds Authorization header from token", async () => {
    mockedGetToken.mockResolvedValue("my-secret-jwt");
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ inserted: 0, skipped: 0, batch_id: 1 }),
    });

    await uploadCsv("vente", "header\nrow1");

    const [, options] = fetchSpy.mock.calls[0];
    expect(options.headers).toEqual({ Authorization: "Bearer my-secret-jwt" });
  });

  it("throws on non-ok response with status and body", async () => {
    mockedGetToken.mockResolvedValue("test-token");
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 422,
      text: () => Promise.resolve("Unprocessable Entity"),
    });

    await expect(uploadCsv("vente", "header\nrow1")).rejects.toThrow(
      "422: Unprocessable Entity"
    );
  });

  it("throws on non-ok response even if body reading fails", async () => {
    mockedGetToken.mockResolvedValue("test-token");
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.reject(new Error("body read failed")),
    });

    await expect(uploadCsv("vente", "header\nrow1")).rejects.toThrow("500: ");
  });
});
