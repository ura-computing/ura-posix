import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../setup";
import {
  listPharmacies,
  createPharmacy,
  updatePharmacy,
  deletePharmacy,
  listNonDeclaredProducts,
  getPharmacyOptions,
  updatePharmacyOptions,
  listUsers,
  listPendingOwners,
  approveUser,
  rejectUser,
  revokeUser,
  updateUserRole,
  updateUserPharmacy,
  updateUserPermissions,
  getNotifications,
  getStats,
  getAnalytics,
  listCatalog,
  createMedicament,
  updateMedicament,
  deleteMedicament,
  listCatalogCategories,
  listCategorySuffixes,
  createCategorySuffix,
  updateCategorySuffix,
  deleteCategorySuffix,
  listAllNonDeclared,
} from "@/api/admin";

const BASE = "http://localhost:8000";

describe("admin API", () => {
  // ── Pharmacies ─────────────────────────────────────────────────────────────
  describe("listPharmacies()", () => {
    it("returns array of pharmacies from GET /admin/pharmacies", async () => {
      const result = await listPharmacies();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty("name", "Pharmacie Test");
    });

    it("throws on error", async () => {
      server.use(
        http.get(`${BASE}/admin/pharmacies`, () =>
          HttpResponse.json({ detail: "Forbidden" }, { status: 403 }),
        ),
      );
      await expect(listPharmacies()).rejects.toThrow("Forbidden");
    });
  });

  describe("createPharmacy()", () => {
    it("sends POST /admin/pharmacies with body", async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.post(`${BASE}/admin/pharmacies`, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: 2, name: "New Pharmacy", user_count: 0 });
        }),
      );
      const result = await createPharmacy({ name: "New Pharmacy", address: "456 Rue" });
      expect(capturedBody).toMatchObject({ name: "New Pharmacy", address: "456 Rue" });
      expect(result).toHaveProperty("id", 2);
    });
  });

  describe("updatePharmacy()", () => {
    it("sends PUT /admin/pharmacies/:id", async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.put(`${BASE}/admin/pharmacies/:id`, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: 1, name: "Updated", user_count: 2 });
        }),
      );
      const result = await updatePharmacy(1, { name: "Updated" });
      expect(capturedBody).toEqual({ name: "Updated" });
      expect(result.name).toBe("Updated");
    });
  });

  describe("deletePharmacy()", () => {
    it("sends DELETE /admin/pharmacies/:id and returns deleted flag", async () => {
      const result = await deletePharmacy(1);
      expect(result).toEqual({ deleted: true });
    });

    it("throws on error", async () => {
      server.use(
        http.delete(`${BASE}/admin/pharmacies/:id`, () =>
          HttpResponse.json({ detail: "Not found" }, { status: 404 }),
        ),
      );
      await expect(deletePharmacy(999)).rejects.toThrow("Not found");
    });
  });

  // ── Non-declared products ──────────────────────────────────────────────────
  describe("listNonDeclaredProducts()", () => {
    it("calls GET /admin/pharmacy/:id/non-declared", async () => {
      let capturedUrl = "";
      server.use(
        http.get(`${BASE}/admin/pharmacy/:id/non-declared`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json([{ medicament_id: 1, product: "Produit Inconnu" }]);
        }),
      );
      const result = await listNonDeclaredProducts(5);
      expect(capturedUrl).toContain("/admin/pharmacy/5/non-declared");
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty("product", "Produit Inconnu");
    });
  });

  // ── Pharmacy options ───────────────────────────────────────────────────────
  describe("getPharmacyOptions()", () => {
    it("calls GET /admin/pharmacies/:id/options", async () => {
      const result = await getPharmacyOptions(1);
      expect(result).toHaveProperty("rapports", true);
      expect(result).toHaveProperty("stock", false);
    });
  });

  describe("updatePharmacyOptions()", () => {
    it("sends PUT with permissions wrapper", async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.put(`${BASE}/admin/pharmacies/:id/options`, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ rapports: false, import: true, achat: true, ventes: true, stock: true });
        }),
      );
      const opts = { rapports: false, import: true, achat: true, ventes: true, stock: true };
      await updatePharmacyOptions(1, opts);
      expect(capturedBody).toEqual({ permissions: opts });
    });
  });

  // ── Users ──────────────────────────────────────────────────────────────────
  describe("listUsers()", () => {
    it("returns user array from GET /admin/users", async () => {
      const result = await listUsers();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty("email");
    });

    it("passes pharmacy_id as query param when provided", async () => {
      let capturedUrl = "";
      server.use(
        http.get(`${BASE}/admin/users`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json([]);
        }),
      );
      await listUsers(3);
      const url = new URL(capturedUrl);
      expect(url.searchParams.get("pharmacy_id")).toBe("3");
    });
  });

  describe("listPendingOwners()", () => {
    it("calls GET /admin/users/pending", async () => {
      const result = await listPendingOwners();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("approveUser()", () => {
    it("sends PUT /admin/users/:id/approve", async () => {
      const result = await approveUser(2);
      expect(result).toHaveProperty("id");
    });
  });

  describe("rejectUser()", () => {
    it("sends PUT /admin/users/:id/reject with empty body", async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.put(`${BASE}/admin/users/:id/reject`, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: 2, status: "rejected" });
        }),
      );
      await rejectUser(2);
      expect(capturedBody).toEqual({});
    });
  });

  describe("revokeUser()", () => {
    it("sends PUT /admin/users/:id/revoke", async () => {
      const result = await revokeUser(2);
      expect(result).toHaveProperty("id");
    });
  });

  describe("updateUserRole()", () => {
    it("sends PUT with role payload", async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.put(`${BASE}/admin/users/:id/role`, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: 2, role: "employee" });
        }),
      );
      await updateUserRole(2, "employee");
      expect(capturedBody).toEqual({ role: "employee" });
    });
  });

  describe("updateUserPharmacy()", () => {
    it("sends PUT with pharmacy_id payload", async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.put(`${BASE}/admin/users/:id/pharmacy`, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: 2, pharmacy_id: 5 });
        }),
      );
      await updateUserPharmacy(2, 5);
      expect(capturedBody).toEqual({ pharmacy_id: 5 });
    });
  });

  describe("updateUserPermissions()", () => {
    it("sends PUT with permissions payload", async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.put(`${BASE}/admin/users/:id/permissions`, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: 2, permissions: { rapports: true, achat: false } });
        }),
      );
      const perms = { rapports: true, achat: false };
      await updateUserPermissions(2, perms);
      expect(capturedBody).toEqual({ permissions: perms });
    });
  });

  // ── Admin stats / analytics / notifications ────────────────────────────────
  describe("getStats()", () => {
    it("returns AdminStats from GET /admin/stats", async () => {
      const result = await getStats();
      expect(result).toHaveProperty("total_pharmacies", 5);
      expect(result).toHaveProperty("total_active_users", 12);
      expect(result).toHaveProperty("pending_catalog_requests", 3);
    });
  });

  describe("getAnalytics()", () => {
    it("returns AdminAnalytics from GET /admin/analytics", async () => {
      const result = await getAnalytics();
      expect(result).toHaveProperty("users_by_role");
      expect(result).toHaveProperty("monthly_registrations");
    });
  });

  describe("getNotifications()", () => {
    it("returns AdminNotifications from GET /admin/notifications", async () => {
      const result = await getNotifications();
      expect(result).toHaveProperty("pending_users");
      expect(result).toHaveProperty("pending_requests");
      expect(result.pending_users.length).toBeGreaterThan(0);
    });
  });

  // ── Catalog ────────────────────────────────────────────────────────────────
  describe("listCatalog()", () => {
    it("returns paginated catalog", async () => {
      const result = await listCatalog("dol", 1, 50);
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("pagination");
      expect(result.data[0]).toHaveProperty("product", "Doliprane");
    });

    it("sends search and pagination query params", async () => {
      let capturedUrl = "";
      server.use(
        http.get(`${BASE}/admin/catalog`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({ data: [], pagination: { total: 0, current: 1, pageSize: 10 } });
        }),
      );
      await listCatalog("aspirin", 2, 10);
      const url = new URL(capturedUrl);
      expect(url.searchParams.get("search")).toBe("aspirin");
      expect(url.searchParams.get("page")).toBe("2");
      expect(url.searchParams.get("limit")).toBe("10");
    });
  });

  describe("createMedicament()", () => {
    it("sends POST /admin/catalog", async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.post(`${BASE}/admin/catalog`, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: 3, ...capturedBody });
        }),
      );
      await createMedicament({
        pid: "PID003",
        product: "TestMed",
        tva: "7",
        pph: 10,
        ppv: 15,
        category: "Cat A",
        zone: null,
        barcode1: null,
        barcode2: null,
        laboratoire: null,
        product_type: "pharmacie",
      });
      expect(capturedBody).toHaveProperty("product", "TestMed");
    });
  });

  describe("updateMedicament()", () => {
    it("sends PUT /admin/catalog/:id", async () => {
      const result = await updateMedicament(1, { product: "Updated" });
      expect(result).toHaveProperty("product", "Updated");
    });
  });

  describe("deleteMedicament()", () => {
    it("sends DELETE /admin/catalog/:id", async () => {
      const result = await deleteMedicament(1);
      expect(result).toEqual({ deleted: true });
    });
  });

  describe("listCatalogCategories()", () => {
    it("returns string array", async () => {
      const result = await listCatalogCategories();
      expect(result).toEqual(["Cat A", "Cat B"]);
    });
  });

  // ── Category suffixes (admin) ──────────────────────────────────────────────
  describe("listCategorySuffixes()", () => {
    it("returns array from GET /admin/category-suffixes", async () => {
      const result = await listCategorySuffixes();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty("suffix", "CA");
    });
  });

  describe("createCategorySuffix()", () => {
    it("sends POST /admin/category-suffixes", async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.post(`${BASE}/admin/category-suffixes`, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: 3, category: "Cat C", suffix: "CC", color: null });
        }),
      );
      await createCategorySuffix({ category: "Cat C", suffix: "CC" });
      expect(capturedBody).toMatchObject({ category: "Cat C", suffix: "CC" });
    });
  });

  describe("updateCategorySuffix()", () => {
    it("sends PUT /admin/category-suffixes/:id", async () => {
      const result = await updateCategorySuffix(1, { suffix: "CA-updated" });
      expect(result).toHaveProperty("suffix", "CA-updated");
    });
  });

  describe("deleteCategorySuffix()", () => {
    it("sends DELETE /admin/category-suffixes/:id", async () => {
      const result = await deleteCategorySuffix(1);
      expect(result).toEqual({ deleted: true });
    });
  });

  // ── Special products ───────────────────────────────────────────────────────
  describe("listAllNonDeclared()", () => {
    it("returns array from GET /admin/non-declared", async () => {
      const result = await listAllNonDeclared();
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty("product", "New Drug");
      expect(result[0]).toHaveProperty("pharmacy_name", "Pharmacie Demo");
    });
  });
});
