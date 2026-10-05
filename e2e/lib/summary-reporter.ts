/** Printed at the end of every run, after Playwright's « 74 passed »: a test = one
 *  `test(...)` block (a whole user story); the numbers below are what it really checked.
 *    checks          every `expect(...)` (one per screen value, file, API answer …)
 *    oracle values   every single value compared with expected.json (expectSame)
 *    user actions    clicks, typing, page loads, downloads
 *    API calls       every /v1 call recorded (.results/calls.jsonl) */
import { existsSync, readFileSync } from "node:fs";
import type { FullResult, Reporter, TestCase, TestResult, TestStep } from "@playwright/test/reporter";

import { CALLS_FILE, COMPARED_FILE } from "./paths";

const fr = (n: number) => n.toLocaleString("fr-FR");

const lines = (file: string) => (existsSync(file) ? readFileSync(file, "utf-8").split("\n").filter(Boolean) : []);

export default class SummaryReporter implements Reporter {
  private tests = 0;
  private files = new Set<string>();
  private status: Record<string, number> = {};
  private checks = 0;
  private actions = 0;

  onTestEnd(test: TestCase, result: TestResult): void {
    this.tests += 1;
    this.files.add(test.location.file);
    this.status[result.status] = (this.status[result.status] ?? 0) + 1;
    const walk = (steps: TestStep[]) => {
      for (const s of steps) {
        if (s.category === "expect") this.checks += 1;
        if (s.category === "pw:api") this.actions += 1;
        walk(s.steps);
      }
    };
    walk(result.steps);
  }

  onEnd(result: FullResult): void {
    const compared = lines(COMPARED_FILE).reduce((n, l) => n + Number(l), 0);
    const calls = lines(CALLS_FILE).length;
    const by = ["passed", "failed", "timedOut", "skipped", "interrupted"]
      .filter((s) => this.status[s])
      .map((s) => `${fr(this.status[s])} ${s}`)
      .join(", ");
    console.log(
      [
        "",
        `  Summary (${result.status})`,
        `    tests          ${fr(this.tests)} in ${this.files.size} files: ${by || "none"}`,
        `    checks         ${fr(this.checks)}`,
        `    oracle values  ${fr(compared)} compared with expected.json`,
        `    user actions   ${fr(this.actions)} (clicks, typing, page loads)`,
        `    API calls      ${fr(calls)}`,
        "",
      ].join("\n"),
    );
  }
}
