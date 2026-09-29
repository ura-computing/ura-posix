/** Runs once per `playwright test`: start from an empty results/state folder. */
import { mkdirSync, rmSync } from "node:fs";

import { RESULTS_DIR, STATE_DIR } from "./lib/paths";

export default function globalSetup(): void {
  for (const dir of [RESULTS_DIR, STATE_DIR]) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
  }
}
