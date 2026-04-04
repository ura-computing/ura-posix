import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../setup";
import {
  getStats,
  analyseMarge,
  getPharmacyStats,
  analyseMargeForPharmacy,
  exportExcel,
  exportExcelForPharmacy,
} from "@/api/stats";
import { eCategoryType } from "@/types";

const BASE = "http://localhost:8000";

describe("stats API", () => {
  // ── getStats ───────────────────────────────────────────────────────────────
  describe("getStats()", () => {
    it("returns StatsResponse from GET /stats", async () => {
      const result = await getStats();
      expect(result).toHaveProperty("kpis");
      expect(result.kpis).toHaveProperty("ventes_total", 50000);
      expect(result).toHaveProperty("monthly_trend");
      expect(result).toHaveProperty("top_categories");
      expect(result).toHaveProperty("advanced_kpis");
      expect(result).toHaveProperty("tva");
      expect(result).toHaveProperty("marge");
      expect(result).toHaveProperty("type_breakdown");
    });

    it("sends date and category_type query params", async () => {
      let capturedUrl = "";
      server.use(
        http.get(`${BASE}/stats`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({
            kpis: {}, advanced_kpis: {}, tva: {}, marge: {}, type_breakdown: {},
            monthly_trend: [], top_categories: [],
          });
        }),
      );
      await getStats("2026-01-01", "2026-03-31", eCategoryType.PHARMACIE);
      const url = new URL(capturedUrl);
      expect(url.searchParams.get("date_from")).toBe("2026-01-01");
      expect(url.searchParams.get("date_to")).toBe("2026-03-31");
      expect(url.searchParams.get("category_type")).toBe("pharmacie");
    });

    it("omits category_type when set to ALL", async () => {
      let capturedUrl = "";
      server.use(
        http.get(`${BASE}/stats`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({
            kpis: {}, advanced_kpis: {}, tva: {}, marge: {}, type_breakdown: {},
            monthly_trend: [], top_categories: [],
          });
        }),
      );
      await getStats("2026-01-01", "2026-03-31", eCategoryType.ALL);
      const url = new URL(capturedUrl);
      expect(url.searchParams.has("category_type")).toBe(false);
    });

    it("throws on server error", async () => {
      server.use(
        http.get(`${BASE}/stats`, () =>
          HttpResponse.json({ detail: "Internal error" }, { status: 500 }),
        ),
      );
      await expect(getStats()).rejects.toThrow("Internal error");
    });
  });

  // ── analyseMarge ───────────────────────────────────────────────────────────
  describe("analyseMarge()", () => {
    it("returns AnalyseMargeResponse from GET /stats/analyse-marge", async () => {
      const result = await analyseMarge();
      expect(result).toHaveProperty("kpis");
      expect(result.kpis).toHaveProperty("total_ventes_dh", 50000);
      expect(result).toHaveProperty("rows");
    });

    it("sends mode query param", async () => {
      let capturedUrl = "";
      server.use(
        http.get(`${BASE}/stats/analyse-marge`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({ kpis: {}, rows: [] });
        }),
      );
      await analyseMarge("2026-01-01", "2026-03-31", eCategoryType.PHARMACIE, "product");
      const url = new URL(capturedUrl);
      expect(url.searchParams.get("date_from")).toBe("2026-01-01");
      expect(url.searchParams.get("date_to")).toBe("2026-03-31");
      expect(url.searchParams.get("category_type")).toBe("pharmacie");
      expect(url.searchParams.get("mode")).toBe("product");
    });

    it("omits optional params when not provided", async () => {
      let capturedUrl = "";
      server.use(
        http.get(`${BASE}/stats/analyse-marge`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({ kpis: {}, rows: [] });
        }),
      );
      await analyseMarge();
      const url = new URL(capturedUrl);
      expect(url.searchParams.has("date_from")).toBe(false);
      expect(url.searchParams.has("mode")).toBe(false);
    });
  });

  // ── getPharmacyStats ───────────────────────────────────────────────────────
  describe("getPharmacyStats()", () => {
    it("calls GET /admin/pharmacy/:id/stats with correct pharmacyId", async () => {
      let capturedUrl = "";
      server.use(
        http.get(`${BASE}/admin/pharmacy/:id/stats`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({
            kpis: {}, advanced_kpis: {}, tva: {}, marge: {}, type_breakdown: {},
            monthly_trend: [], top_categories: [],
          });
        }),
      );
      await getPharmacyStats(42, "2026-01-01", "2026-03-31");
      expect(capturedUrl).toContain("/admin/pharmacy/42/stats");
      const url = new URL(capturedUrl);
      expect(url.searchParams.get("date_from")).toBe("2026-01-01");
      expect(url.searchParams.get("date_to")).toBe("2026-03-31");
    });

    it("returns StatsResponse", async () => {
      const result = await getPharmacyStats(1);
      expect(result).toHaveProperty("kpis");
      expect(result.kpis.ventes_total).toBe(50000);
    });
  });

  // ── analyseMargeForPharmacy ────────────────────────────────────────────────
  describe("analyseMargeForPharmacy()", () => {
    it("calls GET /admin/pharmacy/:id/stats/analyse-marge", async () => {
      let capturedUrl = "";
      server.use(
        http.get(`${BASE}/admin/pharmacy/:id/stats/analyse-marge`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({ kpis: {}, rows: [] });
        }),
      );
      await analyseMargeForPharmacy(7, "2026-01-01", "2026-03-31", eCategoryType.PARAPHARMACIE, "category");
      expect(capturedUrl).toContain("/admin/pharmacy/7/stats/analyse-marge");
      const url = new URL(capturedUrl);
      expect(url.searchParams.get("date_from")).toBe("2026-01-01");
      expect(url.searchParams.get("category_type")).toBe("parapharmacie");
      expect(url.searchParams.get("mode")).toBe("category");
    });

    it("returns AnalyseMargeResponse", async () => {
      const result = await analyseMargeForPharmacy(1);
      expect(result).toHaveProperty("kpis");
      expect(result).toHaveProperty("rows");
    });
  });

  // ── exportExcel ────────────────────────────────────────────────────────────
  describe("exportExcel()", () => {
    it("returns a Blob from GET /stats/export-excel", async () => {
      const blob = await exportExcel("2026-01-01", "2026-03-31");
      expect(blob).toBeDefined();
      expect(blob.size).toBeGreaterThan(0);
      expect(typeof blob.text).toBe("function");
    });

    it("sends category_type param", async () => {
      let capturedUrl = "";
      server.use(
        http.get(`${BASE}/stats/export-excel`, ({ request }) => {
          capturedUrl = request.url;
          return new HttpResponse("data", {
            status: 200,
            headers: { "Content-Type": "application/octet-stream" },
          });
        }),
      );
      await exportExcel("2026-01-01", "2026-03-31", eCategoryType.PHARMACIE);
      const url = new URL(capturedUrl);
      expect(url.searchParams.get("category_type")).toBe("pharmacie");
    });
  });

  // ── exportExcelForPharmacy ─────────────────────────────────────────────────
  describe("exportExcelForPharmacy()", () => {
    it("returns a Blob from /admin/pharmacy/:id/stats/export-excel", async () => {
      const blob = await exportExcelForPharmacy(1, "2026-01-01", "2026-03-31");
      expect(blob).toBeDefined();
      expect(blob.size).toBeGreaterThan(0);
      expect(typeof blob.text).toBe("function");
    });

    it("includes pharmacyId in URL", async () => {
      let capturedUrl = "";
      server.use(
        http.get(`${BASE}/admin/pharmacy/:id/stats/export-excel`, ({ request }) => {
          capturedUrl = request.url;
          return new HttpResponse("data", {
            status: 200,
            headers: { "Content-Type": "application/octet-stream" },
          });
        }),
      );
      await exportExcelForPharmacy(99);
      expect(capturedUrl).toContain("/admin/pharmacy/99/stats/export-excel");
    });
  });
});
