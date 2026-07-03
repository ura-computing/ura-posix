/** msw server — Node adapter for the test environment. The handlers list
 *  starts empty; per-test or per-suite setups push handlers via
 *  `server.use(http.<verb>(path, ...))`. Pattern used:
 *
 *      import { http, HttpResponse } from "msw";
 *      server.use(http.get("/v1/auth/me", () => HttpResponse.json({...})));
 *
 *  Unhandled requests fail loudly (configured in `setupTests.ts`) so a
 *  missing handler can't silently pass through and hit the network. */
import { setupServer } from "msw/node";


export const server = setupServer();
