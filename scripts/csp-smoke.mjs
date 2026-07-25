/**
 * `npm run csp:smoke` — the site must work under its own Content-Security-Policy.
 *
 * On the github-pages target the policy ships inside the document as a
 * `<meta http-equiv>`, because GitHub Pages cannot set response headers. That
 * makes it enforced by the browser on the local preview too — unlike the
 * `_headers` path, which only exists once Cloudflare serves it. So a policy
 * that breaks React, the graph engine, or Fit would previously have shipped and
 * been discovered by a visitor.
 *
 * This loads every route with the CSP enforced (nothing bypassed), records
 * every `securitypolicyviolation` the document raises, and fails on any of
 * them. It also asserts the tag is present exactly when the target says it
 * should be, and that it sits above the first stylesheet or script — a meta
 * CSP does not apply to anything declared before it, so a misplaced tag looks
 * like protection and is not.
 *
 * Usage: node scripts/csp-smoke.mjs [--verbose]
 * Exit 0 = clean | 1 = violations or a misplaced tag | 0 with a warning if no browser.
 */
import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const PORT = Number(process.env.PORT || 4188);
const verbose = process.argv.includes("--verbose");

const generated = readFileSync(join(root, "src", "generated", "content.ts"), "utf8");
const target = (generated.match(/deployTarget:\s*"([^"]*)"/) || [])[1] || "";
const expectMeta = target === "github-pages";

const index = readFileSync(join(dist, "index.html"), "utf8");
const metaAt = index.search(/<meta http-equiv="Content-Security-Policy"/i);

const failures = [];

// ---------- 1. the tag is present, and early enough to mean anything ----------
if (expectMeta && metaAt < 0) {
  failures.push("deploy.target is github-pages but dist/index.html has no <meta http-equiv=\"Content-Security-Policy\">");
} else if (!expectMeta && metaAt >= 0) {
  failures.push(
    `deploy.target is ${target} — _headers carries the real policy there, so the meta tag should not be emitted`,
  );
} else if (expectMeta) {
  const firstResource = Math.min(
    ...[/<link[^>]+rel="stylesheet"/i, /<script\b/i]
      .map((re) => index.search(re))
      .filter((i) => i >= 0)
      .concat([Number.MAX_SAFE_INTEGER]),
  );
  if (metaAt > firstResource) {
    failures.push(
      "the CSP meta tag appears after the first stylesheet or script — a meta policy does not " +
        "apply to anything above it, so those resources are unprotected",
    );
  }
}

// ---------- 2. nothing the page actually does violates it ----------
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.warn("csp-smoke: playwright unavailable - skipping the runtime pass (install: npx playwright install chromium)");
  report();
}

if (!existsSync(join(dist, "index.html"))) {
  console.error("csp-smoke: dist/index.html missing - run npm run build first");
  process.exit(1);
}

const routes = ["/", "/about", "/work", "/blog", "/graph", "/fit"];
const server = spawn(process.execPath, [join(root, "scripts", "preview.mjs"), "--spa"], {
  cwd: root,
  env: { ...process.env, PORT: String(PORT) },
  stdio: "ignore",
});

let browser;
try {
  await waitForServer();
  browser = await chromium.launch();
  // No bypassCSP: the whole point is to be subject to the policy.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  /* Registered before any page script runs, so a violation raised during the
     initial parse is captured too. Evaluated through CDP rather than as a
     document script, so it is not itself subject to script-src. */
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      window.__cspViolations.push({
        directive: e.violatedDirective,
        blocked: e.blockedURI,
        line: e.lineNumber,
      });
    });
  });

  for (const path of routes) {
    await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: "networkidle" });
    const found = await page.evaluate(() => window.__cspViolations || []);
    if (verbose) console.log(`  ${path} - ${found.length} violation(s)`);
    for (const v of found) {
      failures.push(`${path}: ${v.directive} blocked ${v.blocked || "(inline)"}`);
    }
    await page.evaluate(() => (window.__cspViolations = []));
  }
} finally {
  await browser?.close();
  server.kill();
}

report();

function report() {
  if (failures.length) {
    console.error("csp-smoke: FAILED");
    for (const f of [...new Set(failures)]) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(
    `csp-smoke: ok (target=${target || "unset"}, meta CSP ${expectMeta ? "present and first" : "correctly absent"})`,
  );
  process.exit(0);
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("csp-smoke: preview server did not start");
}
