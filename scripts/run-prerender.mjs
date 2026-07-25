/**
 * Runs the prerenderer and decides whether its absence should fail the build.
 *
 * Exit 2 from prerender-routes.ts means Playwright or Chromium isn't
 * installed. That is a legitimate state for a fresh clone or a minimal CI
 * image, so the default is to warn and continue with an SPA-only dist —
 * the site still works, it just isn't crawlable without JS.
 *
 * Set PRERENDER_REQUIRED=1 (do this in a deploy pipeline) to turn that
 * warning into a hard failure, so a production deploy can never silently
 * ship without prerendered documents.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const required = process.env.PRERENDER_REQUIRED === "1";

// shell:true — on Windows `npx` is a .cmd shim that spawnSync cannot exec
// directly, and gets back status null with an EINVAL in res.error.
const res = spawnSync("npx --yes tsx scripts/prerender-routes.ts", {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

if (res.error) {
  console.error(`run-prerender: could not start prerender - ${res.error.message}`);
  process.exit(1);
}

if (res.status === 0) process.exit(0);

if (res.status === 2) {
  if (required) {
    console.error(
      "run-prerender: PRERENDER_REQUIRED=1 but Playwright/Chromium is unavailable - " +
        "refusing to publish an SPA-only dist. Run: npx playwright install chromium",
    );
    process.exit(1);
  }
  console.warn(
    "run-prerender: prerender skipped - dist is SPA-only, so per-route metadata " +
      "will not be visible to crawlers that do not execute JS. " +
      "Run `npx playwright install chromium` to enable it.",
  );
  process.exit(0);
}

console.error(`run-prerender: prerender failed (exit ${res.status})`);
process.exit(1);
