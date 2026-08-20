#!/usr/bin/env node
/**
 * SessionStart — install, then report what this machine can actually verify.
 *
 * Two facts decide whether a session's "all green" means anything:
 *
 *   1. Are the dependencies there? A missing python or node_modules turns
 *      every gate into an unrelated-looking error deep in the build.
 *   2. Is Chromium there? Without it the build still SUCCEEDS and produces an
 *      SPA-only dist, and `ux:check` skips — so two of the gates that matter
 *      most quietly do not run (AGENTS.md, "three failure modes").
 *
 * ONE FACT, ONE READER. `check-ready` already answers both, by probing rather
 * than by looking on PATH, and `--json` exists precisely so a caller branches
 * on structure instead of parsing prose. So this installs and then ASKS IT.
 * Nothing here re-probes for bun, python, yaml or a browser.
 *
 * check-ready exits 1 whenever content blockers exist, which is the normal
 * state of an unadopted template — so its exit code is deliberately ignored
 * and the JSON body is what gets read.
 *
 * Content blockers are NOT surfaced. "You have not written your profile yet"
 * is true of every fresh fork and would be noise at the top of every session;
 * `bun run ready` is where a person asks that question.
 *
 * stdout from a SessionStart hook becomes context Claude can see.
 */
import { spawnSync } from "node:child_process";

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const run = (cmd) => spawnSync(cmd, { cwd: root, shell: true, encoding: "utf8" });

const lines = [];

/* --frozen-lockfile: a session start must never silently rewrite bun.lock.
   If it fails, say so and carry on — check-ready below reports the
   consequence (node_modules missing) in its own words. */
const install = run("bun install --frozen-lockfile");
if (install.status !== 0) {
  lines.push("- `bun install --frozen-lockfile` failed. Dependencies may be incomplete.");
}

const ready = run("node scripts/check-ready.mjs --json");
let report;
try {
  report = JSON.parse(ready.stdout);
} catch {
  lines.push("- `check-ready --json` produced no parseable output; environment unverified.");
}

if (report) {
  for (const dep of report.missingDependencies || []) lines.push(`- MISSING: ${dep}`);
  for (const warn of report.toolingWarnings || []) lines.push(`- ${warn}`);
}

if (!lines.length) {
  console.log(
    "show-your-work: dependencies installed, browser present — `bun run test` will run every gate.",
  );
} else {
  console.log(
    ["show-your-work environment:", ...lines, "", "Run `bun run ready` for the full picture."].join("\n"),
  );
}
