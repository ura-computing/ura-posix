import "@testing-library/jest-dom";
import { setupServer } from "msw/node";
import { handlers } from "./mocks/handlers";

export const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "warn" });

  // Seed a fake JWT so that `getToken()` returns a value by default
  localStorage.setItem("apcm_token", "test-token");
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
  localStorage.clear();
});
