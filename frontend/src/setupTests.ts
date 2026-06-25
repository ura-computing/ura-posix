/** Vitest setup — runs once per test file BEFORE any tests.
 *
 *  - Registers @testing-library/jest-dom matchers (toBeInTheDocument, etc.).
 *  - Starts an msw `server` so hooks see deterministic responses for the API
 *    layer. Each test can override handlers via `server.use(http.get(...))`.
 *  - Resets handlers + cleans up React DOM between tests so state doesn't leak.
 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "@/mocks/server";


beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
