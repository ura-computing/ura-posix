/** Runs once per `playwright test`, every container up (webServer ready): start from an empty results/state folder;
 *  make tests-ui (E2E_XEPHYR, scripts/run.sh): open the tests window now — not while the images build — and close it
 *  at the end. */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";

import { RESULTS_DIR, STATE_DIR } from "./lib/paths";

export default async function globalSetup(): Promise<() => void> {
  for (const dir of [RESULTS_DIR, STATE_DIR]) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
  }
  return openTestsWindow();
}

/** The tests window (Xephyr: a screen in a window, E2E_SCREEN big): the browsers draw inside it (DISPLAY, read by the
 *  test workers, started after this). Returns what closes it. */
async function openTestsWindow(): Promise<() => void> {
  const size = process.env.E2E_SCREEN;
  if (!process.env.E2E_XEPHYR || !size) return () => {};
  let screen = 99;
  while (existsSync(`/tmp/.X11-unix/X${screen}`)) screen += 1;
  const args = [
    `:${screen}`,
    "-screen",
    size,
    "-title",
    "PharmaGest — tests",
    "-ac",
    "-br",
    "-noreset",
    "-no-host-grab",
  ];
  const xephyr = spawn("Xephyr", args, { stdio: "ignore" });
  for (let i = 0; i < 50 && !existsSync(`/tmp/.X11-unix/X${screen}`); i += 1)
    await new Promise((r) => setTimeout(r, 100));
  process.env.DISPLAY = `:${screen}`;
  return () => {
    xephyr.kill();
  };
}
