import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../setup";
import {
  listAchats,
  listVentes,
  achatCategories,
  venteCategories,
  achatTvaRates,
  venteTvaRates,
  exportAchat,
  exportVente,
  achatSuggestions,
  venteSuggestions,
  getCategorySuffixes,
} from "@/api/transactions";

const BASE = "http://localhost:8000";

describe("transactions API", () => {
  // ── listAchats ─────────────────────────────────────────────────────────────
  describe("listAchats()", () => {
    it("returns paginated achat data", async () => {
      const result = await listAchats({ page: 1, limit: 20 });
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("pagination");
      expect(result.pagination).toMatchObject({ page: 1, limit: 20 });
      expect(result.data.length).toBeGreaterThan(0);
    });

    it("sends correct query params including filters", async () => {
      let capturedUrl = "";
      server.use(
        http.get(`${BASE}/achat`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({
            data: [],
            pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
          });
        }),
      );
      await listAchats({
        page: 2,
        limit: 10,
        search: "doliprane",
        categories: ["Cat A", "Cat B"],
        tva: ["7"],
        dateFrom: "2026-01-01",
        dateTo: "2026-03-01",
      });
      const url = new URL(capturedUrl);
      expect(url.searchParams.get("page")).toBe("2");
      expect(url.searchParams.get("limit")).toBe("10");
      expect(url.searchParams.get("search")).toBe("doliprane");
      expect(url.searchParams.getAll("category")).toEqual(["Cat A", "Cat B"]);
      expect(url.searchParams.getAll("tva")).toEqual(["7"]);
      expect(url.searchParams.get("date_from")).toBe("2026-01-01");
      expect(url.searchParams.get("date_to")).toBe("2026-03-01");
    });

    it("throws on server error", async () => {
      server.use(
        http.get(`${BASE}/achat`, () =>
          HttpResponse.json({ detail: "Server error" }, { status: 500 }),
        ),
      );
      await expect(listAchats({ page: 1, limit: 20 })).rejects.toThrow("Server error");
    });
  });

  // ── listVentes ─────────────────────────────────────────────────────────────
  describe("listVentes()", () => {
    it("returns paginated vente data", async () => {
      const result = await listVentes({ page: 1, limit: 20 });
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("pagination");
      expect(result.data.length).toBeGreaterThan(0);
    });

    it("sends correct query params", async () => {
      let capturedUrl = "";
      server.use(
        http.get(`${BASE}/ventes`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({
            data: [],
            pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
          });
        }),
      );
      await listVentes({ page: 3, limit: 50, search: "test" });
      const url = new URL(capturedUrl);
      expect(url.searchParams.get("page")).toBe("3");
      expect(url.searchParams.get("limit")).toBe("50");
      expect(url.searchParams.get("search")).toBe("test");
    });
  });

  // ── achatCategories / venteCategories ──────────────────────────────────────
  describe("achatCategories()", () => {
    it("returns string array from GET /achat/categories", async () => {
      const cats = await achatCategories();
      expect(Array.isArray(cats)).toBe(true);
      expect(cats).toEqual(["Cat A", "Cat B"]);
    });
  });

  describe("venteCategories()", () => {
    it("returns string array from GET /ventes/categories", async () => {
      const cats = await venteCategories();
      expect(Array.isArray(cats)).toBe(true);
      expect(cats).toEqual(["Cat X", "Cat Y"]);
    });
  });

  // ── TVA rates ──────────────────────────────────────────────────────────────
  describe("achatTvaRates()", () => {
    it("returns string array of TVA rates", async () => {
      const rates = await achatTvaRates();
      expect(rates).toEqual(["7", "20"]);
    });
  });

  describe("venteTvaRates()", () => {
    it("returns string array of TVA rates", async () => {
      const rates = await venteTvaRates();
      expect(rates).toEqual(["7", "20"]);
    });
  });

  // ── exportAchat ────────────────────────────────────────────────────────────
  describe("exportAchat()", () => {
    it("sends export=true and filter params", async () => {
      let capturedUrl = "";
      server.use(
        http.get(`${BASE}/achat`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({ data: [] });
        }),
      );
      await exportAchat("doliprane", ["Cat A"], "2026-01-01", "2026-03-01", ["7"]);
      const url = new URL(capturedUrl);
      expect(url.searchParams.get("export")).toBe("true");
      expect(url.searchParams.get("search")).toBe("doliprane");
      expect(url.searchParams.getAll("category")).toEqual(["Cat A"]);
      expect(url.searchParams.get("date_from")).toBe("2026-01-01");
      expect(url.searchParams.get("date_to")).toBe("2026-03-01");
      expect(url.searchParams.getAll("tva")).toEqual(["7"]);
    });

    it("works with minimal params", async () => {
      let capturedUrl = "";
      server.use(
        http.get(`${BASE}/achat`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({ data: [] });
        }),
      );
      await exportAchat("", []);
      const url = new URL(capturedUrl);
      expect(url.searchParams.get("export")).toBe("true");
      expect(url.searchParams.has("search")).toBe(false);
    });
  });

  // ── exportVente ────────────────────────────────────────────────────────────
  describe("exportVente()", () => {
    it("sends export=true and filter params for ventes", async () => {
      let capturedUrl = "";
      server.use(
        http.get(`${BASE}/ventes`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({ data: [] });
        }),
      );
      await exportVente("aspirin", ["Cat X"], "2026-02-01", "2026-04-01");
      const url = new URL(capturedUrl);
      expect(url.searchParams.get("export")).toBe("true");
      expect(url.searchParams.get("search")).toBe("aspirin");
      expect(url.searchParams.getAll("category")).toEqual(["Cat X"]);
    });
  });

  // ── suggestions ────────────────────────────────────────────────────────────
  describe("achatSuggestions()", () => {
    it("returns suggestions object", async () => {
      const result = await achatSuggestions("dol");
      expect(result).toHaveProperty("products");
      expect(result).toHaveProperty("suppliers");
      expect(result).toHaveProperty("refs");
    });
  });

  describe("venteSuggestions()", () => {
    it("returns suggestions object", async () => {
      const result = await venteSuggestions("dol");
      expect(result).toHaveProperty("products");
      expect(result).toHaveProperty("clients");
      expect(result).toHaveProperty("refs");
    });
  });

  // ── getCategorySuffixes ────────────────────────────────────────────────────
  describe("getCategorySuffixes()", () => {
    it("returns category suffix array", async () => {
      const result = await getCategorySuffixes();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty("category", "Cat A");
      expect(result[0]).toHaveProperty("suffix", "CA");
    });
  });
});
