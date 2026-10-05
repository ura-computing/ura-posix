/** PharmaGest end-to-end suite.
 *
 *  One run = the production images (backend + frontend Dockerfiles) on a fresh
 *  Postgres 17 (e2e/docker-compose.e2e.yml) + freshly generated huge Sobrus CSVs
 *  (resources/tests/generate.py) + the oracle's expected.json. Specs run in
 *  file order (01-…, 02-…), one worker, so the admin → import → check flow
 *  builds on the previous step.
 *
 *  Ports 8001 / 5174 keep the dev servers (8000 / 5173) untouched.
 *    make tests      headless, every test (pre-push)
 *    make tests-ui  a real browser plays one test file (or all), slowed down
 */
import { defineConfig } from "@playwright/test";

import { WEB } from "./lib/paths";

/** Set by `make tests-ui`: maximized window, page fills it. Headless keeps a fixed size. */
const HEADED = process.env.E2E_HEADED === "1";

export default defineConfig({
  testDir: "./tests",
  globalSetup: require.resolve("./global-setup"),
  fullyParallel: false,
  workers: 1,
  timeout: 60_000, // any stuck test fails in 1 min (imports raise their own limit)
  expect: { timeout: 20_000 },
  reporter: [["list"], ["./lib/summary-reporter.ts"], ["html", { open: "never", outputFolder: "report" }]],
  use: {
    baseURL: WEB,
    viewport: HEADED ? null : { width: 1920, height: 1080 },
    actionTimeout: 15_000, // a missing button fails in 15 s, not after the 20-min test timeout
    navigationTimeout: 30_000,
    launchOptions: {
      slowMo: Number(process.env.E2E_SLOWMO ?? 0), // make tests-ui: slow enough to follow
      args: HEADED ? ["--start-maximized"] : [],
    },
    locale: "fr-FR",
    timezoneId: "Africa/Casablanca",
    trace: "on",
    video: "on",
    screenshot: "on",
  },
  // `setup` (admin creates the pharmacy + owner, owner imports the files) always
  // runs first — also when you run a single page spec (make tests-ui ARGS=…).
  projects: [
    { name: "setup", testMatch: /0[12]-.*\.spec\.ts/ },
    { name: "pages", testMatch: /(0[3-9]|[1-9]\d)-.*\.spec\.ts/, dependencies: ["setup"] },
  ],
  // The production images (backend + frontend Dockerfiles) on a fresh Postgres 17:
  // e2e/docker-compose.e2e.yml. First run builds both images (a few minutes), then cached.
  webServer: {
    command: "sh scripts/start-stack.sh",
    url: WEB, // the frontend starts only after the backend is healthy (docker-compose.e2e.yml)
    timeout: 10 * 60_000,
    reuseExistingServer: false,
    stdout: "pipe",
    // SIGTERM (not the default SIGKILL): the script removes the containers on its way out.
    gracefulShutdown: { signal: "SIGTERM", timeout: 30_000 },
  },
});
