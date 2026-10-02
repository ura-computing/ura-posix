/** PharmaGest end-to-end suite.
 *
 *  One run = fresh `apcm_e2e` database + freshly generated huge Sobrus CSVs
 *  (resources/tests/generate.py) + the oracle's expected.json. Specs run in
 *  file order (01-…, 02-…), one worker, so the admin → import → check flow
 *  builds on the previous step.
 *
 *  Ports 8001 / 5174 keep the dev servers (8000 / 5173) untouched.
 *    make e2e-tests  headless, every test (pre-push)
 *    make e2e-ui     Playwright UI mode: one window, watch / step through each test
 */
import { defineConfig } from "@playwright/test";

import { API, WEB } from "./lib/paths";

export default defineConfig({
  testDir: "./tests",
  globalSetup: require.resolve("./global-setup"),
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,                    // any stuck test fails in 1 min (imports raise their own limit)
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "report" }]],
  use: {
    baseURL: WEB,
    viewport: { width: 1920, height: 1080 },
    actionTimeout: 15_000,            // a missing button fails in 15 s, not after the 20-min test timeout
    navigationTimeout: 30_000,
    locale: "fr-FR",
    timezoneId: "Africa/Casablanca",
    trace: "on",
    video: "on",
    screenshot: "on",
  },
  // `setup` (admin creates the pharmacy + owner, owner imports the files) always
  // runs first — also when you run a single page spec (make e2e-ui ARGS=…).
  projects: [
    { name: "setup", testMatch: /0[12]-.*\.spec\.ts/ },
    { name: "pages", testMatch: /(0[3-9]|[1-9]\d)-.*\.spec\.ts/, dependencies: ["setup"] },
  ],
  webServer: [
    {
      command: "sh scripts/start-backend.sh",
      url: `${API}/v1/health`,
      timeout: 5 * 60_000,
      reuseExistingServer: false,
      stdout: "pipe",
    },
    {
      command: "npm --prefix ../frontend run dev -- --port 5174 --strictPort",
      url: WEB,
      env: { VITE_BACKEND_URL: API },
      timeout: 2 * 60_000,
      reuseExistingServer: false,
    },
  ],
});
