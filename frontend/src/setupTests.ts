/** Vitest setup — runs once per test file BEFORE any tests.
 *
 *  - Registers @testing-library/jest-dom matchers (toBeInTheDocument, etc.).
 *  - Starts an msw `server` so hooks see deterministic responses for the API
 *    layer. Each test can override handlers via `server.use(http.get(...))`.
 *  - Resets handlers + cleans up React DOM between tests so state doesn't leak.
 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

import { server } from "@/mocks/server";


// Sonner pulls in browser-only DOM APIs; stub the imperative `toast.*` calls
// so onSuccess/onError handlers don't crash mid-callback in jsdom (where no
// <Toaster /> is mounted).
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error:   vi.fn(),
    info:    vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
  },
}));


beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
