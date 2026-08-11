#!/usr/bin/env node
/**
 * Smoke: dist/ has real sitemap.xml/robots.txt/known-paths.json/manifest.json,
 * the sitemap is real XML with at least the static routes, and known-paths.json
 * matches (functions/_middleware.js depends on this file being accurate).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

for (const name of ["sitemap.xml", "robots.txt", "known-paths.json", "manifest.json", "404.html"]) {
  if (!existsSync(join(dist, name))) fail(`dist/${name} missing`);
}

const sitemap = readFileSync(join(dist, "sitemap.xml"), "utf8");
if (!sitemap.startsWith("<?xml")) fail("sitemap.xml is not XML");
const urlCount = (sitemap.match(/<loc>/g) || []).length;
if (urlCount < 6) fail(`sitemap.xml has only ${urlCount} URLs, expected at least the 6 static routes`);

const robots = readFileSync(join(dist, "robots.txt"), "utf8");
if (!robots.includes("Sitemap:")) fail("robots.txt missing Sitemap directive");

const knownPaths = JSON.parse(readFileSync(join(dist, "known-paths.json"), "utf8"));
if (!Array.isArray(knownPaths) || !knownPaths.includes("/")) fail("known-paths.json malformed or missing '/'");
if (knownPaths.length !== urlCount) {
  fail(`known-paths.json has ${knownPaths.length} entries but sitemap has ${urlCount} — regenerate both together`);
}

const manifest = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8"));
if (!manifest.name) fail("manifest.json missing name");

const notFound = readFileSync(join(dist, "404.html"), "utf8");
if (!notFound.includes('name="robots"') || !notFound.toLowerCase().includes("noindex")) {
  fail("404.html missing a noindex robots meta — functions/_middleware.js keys off this to set a real 404 status");
}

const llms = readFileSync(join(dist, "llms.txt"), "utf8");
if (!llms.includes("## Work")) fail("llms.txt missing the Work section");

/*
 * No raw "<" inside a JSON-LD block, in any emitted document.
 *
 * JSON.stringify does not escape "<", so content containing the literal
 * "</script>" used to close the block early and turn the rest of the payload
 * into live markup on every prerendered route. site-meta.ts ldJson() escapes it
 * to <; this asserts the escaping actually reached the artifact, because
 * the failure is invisible in the source and only shows up in dist/.
 */
function assertLdJsonEscaped(file, doc) {
  for (const m of doc.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    if (m[1].includes("<")) {
      fail(`${file}: JSON-LD contains a raw "<" — it must be escaped as \\u003c or it can close the script block early`);
    }
  }
}

/*
 * Prerender coverage. Skipped entirely when the build ran without Playwright
 * (a legitimate state — see scripts/run-prerender.mjs), but once ANY route is
 * prerendered, EVERY indexable route must be, or some URLs would silently ship
 * with the home page's metadata.
 */
const home = readFileSync(join(dist, "index.html"), "utf8");
assertLdJsonEscaped("dist/index.html", home);
assertLdJsonEscaped("dist/404.html", notFound);
const prerendered = home.includes('data-prerender="1"');
let checkedRoutes = 0;
if (prerendered) {
  for (const p of knownPaths) {
    if (p === "/") continue;
    const file = join(dist, ...p.split("/").filter(Boolean)) + ".html";
    if (!existsSync(file)) fail(`prerendered dist${p}.html missing while index.html is prerendered`);
    const doc = readFileSync(file, "utf8");
    if (!doc.includes('data-prerender="1"')) fail(`dist${p}.html has no prerendered body snapshot`);
    const canonical = (doc.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
    if (!canonical || !canonical.endsWith(p)) {
      fail(`dist${p}.html canonical is ${canonical || "missing"}, expected it to end with ${p}`);
    }
    if (!/<script type="application\/ld\+json">\s*\{"@context"/.test(doc)) {
      fail(`dist${p}.html missing JSON-LD`);
    }
    assertLdJsonEscaped(`dist${p}.html`, doc);
    checkedRoutes++;
  }
}

console.log("seo-smoke ok", {
  urlCount,
  knownPaths: knownPaths.length,
  prerendered,
  checkedRoutes,
});
