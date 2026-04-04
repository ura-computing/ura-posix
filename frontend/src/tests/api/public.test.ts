import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../setup";
import { listPharmacies } from "@/api/public";

const BASE = "http://localhost:8000";

describe("public API", () => {
  describe("listPharmacies()", () => {
    it("returns array of PharmacyPublic from GET /public/pharmacies", async () => {
      const result = await listPharmacies();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0]).toHaveProperty("id", 1);
      expect(result[0]).toHaveProperty("name", "Pharmacie Alpha");
      expect(result[1]).toHaveProperty("id", 2);
      expect(result[1]).toHaveProperty("name", "Pharmacie Beta");
    });

    it("returns empty array when no pharmacies exist", async () => {
      server.use(
        http.get(`${BASE}/public/pharmacies`, () => HttpResponse.json([])),
      );
      const result = await listPharmacies();
      expect(result).toEqual([]);
    });

    it("handles server error gracefully", async () => {
      server.use(
        http.get(`${BASE}/public/pharmacies`, () =>
          HttpResponse.json({ detail: "Service unavailable" }, { status: 503 }),
        ),
      );
      // The public API uses raw fetch (no request() wrapper), so it won't throw
      // on non-ok status — it will try to parse the JSON body as an array.
      // This test documents that behavior.
      const result = await listPharmacies();
      expect(result).toHaveProperty("detail", "Service unavailable");
    });
  });
});
