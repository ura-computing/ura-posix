import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../setup";
import {
  login,
  signup,
  me,
  updateMe,
  forgotPassword,
  forgotPasswordWhatsApp,
  verifyOtp,
  resetPassword,
} from "@/api/auth";

const BASE = "http://localhost:8000";

describe("auth API", () => {
  // ── login ──────────────────────────────────────────────────────────────────
  describe("login()", () => {
    it("calls POST /auth/login and returns an AuthToken", async () => {
      const result = await login({ email: "a@b.com", password: "pass123" });
      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("token_type", "bearer");
      expect(result.user).toHaveProperty("email", "test@example.com");
    });

    it("sends the correct payload", async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.post(`${BASE}/auth/login`, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            access_token: "tok",
            token_type: "bearer",
            user: { id: 1, email: "a@b.com", role: "owner", status: "active", profile_complete: true },
          });
        }),
      );
      await login({ email: "a@b.com", password: "secret" });
      expect(capturedBody).toEqual({ email: "a@b.com", password: "secret" });
    });

    it("throws on non-ok response", async () => {
      server.use(
        http.post(`${BASE}/auth/login`, () =>
          HttpResponse.json({ detail: "Invalid credentials" }, { status: 401 }),
        ),
      );
      await expect(login({ email: "a@b.com", password: "bad" })).rejects.toThrow("Invalid credentials");
    });
  });

  // ── signup ─────────────────────────────────────────────────────────────────
  describe("signup()", () => {
    it("calls POST /auth/signup and returns an AuthToken", async () => {
      const result = await signup({
        email: "new@user.com",
        password: "pass",
        name: "New User",
      });
      expect(result).toHaveProperty("access_token");
      expect(result.user).toBeDefined();
    });

    it("sends the correct payload including optional fields", async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.post(`${BASE}/auth/signup`, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            access_token: "tok",
            token_type: "bearer",
            user: { id: 2, email: "new@user.com", role: "owner", status: "pending", profile_complete: false },
          });
        }),
      );
      await signup({
        email: "new@user.com",
        password: "pass",
        name: "New User",
        phone: "+212600000001",
        pharmacy_name: "Pharmacie Nouvelle",
      });
      expect(capturedBody).toMatchObject({
        email: "new@user.com",
        password: "pass",
        name: "New User",
        phone: "+212600000001",
        pharmacy_name: "Pharmacie Nouvelle",
      });
    });

    it("throws on server error", async () => {
      server.use(
        http.post(`${BASE}/auth/signup`, () =>
          HttpResponse.json({ detail: "Email already exists" }, { status: 409 }),
        ),
      );
      await expect(signup({ email: "dup@test.com", password: "p", name: "N" })).rejects.toThrow(
        "Email already exists",
      );
    });
  });

  // ── me ─────────────────────────────────────────────────────────────────────
  describe("me()", () => {
    it("calls GET /auth/me and returns User", async () => {
      const user = await me();
      expect(user).toHaveProperty("id", 1);
      expect(user).toHaveProperty("email", "test@example.com");
      expect(user).toHaveProperty("role", "owner");
    });

    it("throws on 401", async () => {
      server.use(
        http.get(`${BASE}/auth/me`, () =>
          HttpResponse.json({ detail: "Not authenticated" }, { status: 401 }),
        ),
      );
      await expect(me()).rejects.toThrow("Not authenticated");
    });
  });

  // ── updateMe ───────────────────────────────────────────────────────────────
  describe("updateMe()", () => {
    it("calls PUT /auth/me with payload and returns updated User", async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.put(`${BASE}/auth/me`, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            id: 1,
            email: "test@example.com",
            name: "Updated Name",
            role: "owner",
            status: "active",
            profile_complete: true,
          });
        }),
      );
      const user = await updateMe({ name: "Updated Name" });
      expect(capturedBody).toEqual({ name: "Updated Name" });
      expect(user.name).toBe("Updated Name");
    });
  });

  // ── forgotPassword ─────────────────────────────────────────────────────────
  describe("forgotPassword()", () => {
    it("calls POST /auth/forgot-password with email", async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.post(`${BASE}/auth/forgot-password`, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return new HttpResponse(null, { status: 204 });
        }),
      );
      await forgotPassword("user@test.com");
      expect(capturedBody).toEqual({ email: "user@test.com" });
    });

    it("throws on server error", async () => {
      server.use(
        http.post(`${BASE}/auth/forgot-password`, () =>
          HttpResponse.json({ detail: "User not found" }, { status: 404 }),
        ),
      );
      await expect(forgotPassword("nobody@test.com")).rejects.toThrow("User not found");
    });
  });

  // ── forgotPasswordWhatsApp ─────────────────────────────────────────────────
  describe("forgotPasswordWhatsApp()", () => {
    it("calls POST /auth/forgot-password-whatsapp with phone", async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.post(`${BASE}/auth/forgot-password-whatsapp`, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return new HttpResponse(null, { status: 204 });
        }),
      );
      await forgotPasswordWhatsApp("+212600000000");
      expect(capturedBody).toEqual({ phone: "+212600000000" });
    });
  });

  // ── verifyOtp ──────────────────────────────────────────────────────────────
  describe("verifyOtp()", () => {
    it("calls POST /auth/verify-otp and returns reset_token", async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.post(`${BASE}/auth/verify-otp`, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ reset_token: "reset-tok-abc" });
        }),
      );
      const result = await verifyOtp("+212600000000", "123456");
      expect(capturedBody).toEqual({ phone: "+212600000000", otp: "123456" });
      expect(result).toHaveProperty("reset_token", "reset-tok-abc");
    });

    it("throws on invalid OTP", async () => {
      server.use(
        http.post(`${BASE}/auth/verify-otp`, () =>
          HttpResponse.json({ detail: "Invalid OTP" }, { status: 400 }),
        ),
      );
      await expect(verifyOtp("+212600000000", "000000")).rejects.toThrow("Invalid OTP");
    });
  });

  // ── resetPassword ──────────────────────────────────────────────────────────
  describe("resetPassword()", () => {
    it("calls POST /auth/reset-password with token and new_password", async () => {
      let capturedBody: Record<string, unknown> | null = null;
      server.use(
        http.post(`${BASE}/auth/reset-password`, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return new HttpResponse(null, { status: 204 });
        }),
      );
      await resetPassword("reset-tok-abc", "newpass123");
      expect(capturedBody).toEqual({ token: "reset-tok-abc", new_password: "newpass123" });
    });

    it("throws on invalid token", async () => {
      server.use(
        http.post(`${BASE}/auth/reset-password`, () =>
          HttpResponse.json({ detail: "Invalid or expired token" }, { status: 400 }),
        ),
      );
      await expect(resetPassword("bad-token", "p")).rejects.toThrow("Invalid or expired token");
    });
  });
});
