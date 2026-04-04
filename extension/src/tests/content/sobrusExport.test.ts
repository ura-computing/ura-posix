import { describe, it, expect } from "vitest";
import type { UploadJob } from "../../content/sobrusExport";

describe("UploadJob type", () => {
  it("has the correct shape for a queued job", () => {
    const job: UploadJob = {
      id: "abc-123",
      state: "queued",
      fileType: "vente",
      timestamp: Date.now(),
    };

    expect(job.id).toBe("abc-123");
    expect(job.state).toBe("queued");
    expect(job.fileType).toBe("vente");
    expect(job.timestamp).toBeTypeOf("number");
    expect(job.filename).toBeUndefined();
    expect(job.current).toBeUndefined();
    expect(job.total).toBeUndefined();
    expect(job.inserted).toBeUndefined();
    expect(job.skipped).toBeUndefined();
    expect(job.error).toBeUndefined();
  });

  it("has the correct shape for an uploading job", () => {
    const job: UploadJob = {
      id: "def-456",
      state: "uploading",
      fileType: "achat",
      filename: "achats-export.csv",
      current: 2,
      total: 5,
      timestamp: Date.now(),
    };

    expect(job.state).toBe("uploading");
    expect(job.fileType).toBe("achat");
    expect(job.filename).toBe("achats-export.csv");
    expect(job.current).toBe(2);
    expect(job.total).toBe(5);
  });

  it("has the correct shape for a success job", () => {
    const job: UploadJob = {
      id: "ghi-789",
      state: "success",
      fileType: "vente",
      inserted: 150,
      skipped: 3,
      timestamp: Date.now(),
    };

    expect(job.state).toBe("success");
    expect(job.inserted).toBe(150);
    expect(job.skipped).toBe(3);
  });

  it("has the correct shape for an error job", () => {
    const job: UploadJob = {
      id: "jkl-012",
      state: "error",
      fileType: "vente",
      error: "Fichier CSV vide",
      timestamp: Date.now(),
    };

    expect(job.state).toBe("error");
    expect(job.error).toBe("Fichier CSV vide");
  });

  it("has the correct shape for a cancelled job", () => {
    const job: UploadJob = {
      id: "mno-345",
      state: "cancelled",
      fileType: "achat",
      inserted: 50,
      skipped: 1,
      timestamp: Date.now(),
    };

    expect(job.state).toBe("cancelled");
    expect(job.inserted).toBe(50);
    expect(job.skipped).toBe(1);
  });

  it("accepts all valid state values", () => {
    const states: UploadJob["state"][] = ["queued", "uploading", "success", "error", "cancelled"];
    states.forEach((state) => {
      const job: UploadJob = {
        id: `test-${state}`,
        state,
        fileType: "vente",
        timestamp: Date.now(),
      };
      expect(job.state).toBe(state);
    });
  });

  it("accepts both achat and vente file types", () => {
    const types: UploadJob["fileType"][] = ["achat", "vente"];
    types.forEach((fileType) => {
      const job: UploadJob = {
        id: `test-${fileType}`,
        state: "queued",
        fileType,
        timestamp: Date.now(),
      };
      expect(job.fileType).toBe(fileType);
    });
  });
});
