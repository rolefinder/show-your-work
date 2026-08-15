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

let ogChecked = 0;

/** og:image and twitter:image must both point at a file that exists in dist/. */
function checkOgImage(doc, label) {
  for (const [attr, re] of [
    ["og:image", /<meta property="og:image" content="([^"]*)"/],
    ["twitter:image", /<meta name="twitter:image" content="([^"]*)"/],
  ]) {
    const url = (doc.match(re) || [])[1];
    if (!url) fail(`${label} has no ${attr}`);
    // Same-origin absolute URL -> a path under dist/.
    const path = url.replace(/^https?:\/\/[^/]+/, "");
    if (!path.startsWith("/")) fail(`${label} ${attr} is not an absolute URL: ${url}`);
    const file = join(dist, ...path.split("/").filter(Boolean));
    if (!existsSync(file)) {
      fail(`${label} ${attr} points at ${path}, but dist${path} does not exist`);
    }
    ogChecked++;
  }
}

for (const name of ["sitemap.xml", "robots.txt", "known-paths.json", "manifest.json", "404.html", "llms.txt", "llms-full.txt"]) {
  if (!existsSync(join(dist, name))) fail(`dist/${name} missing`);
}

/* ---------------------------------------------------------------- AEO ------
   The agent-facing surface rots silently: nothing renders it, so a regression
   here is invisible until a site stops being cited and nobody knows why. */

const robotsTxt = readFileSync(join(dist, "robots.txt"), "utf8");
/* A blanket `User-agent: *` cannot express intent across crawlers that train,
   crawlers that index for citation, and crawlers fetching one page because a
   user just asked. The search group is the one that matters for a portfolio. */
for (const agent of ["OAI-SearchBot", "Claude-SearchBot", "PerplexityBot"]) {
  if (!new RegExp(`^User-agent: ${agent}$`, "m").test(robotsTxt)) {
    fail(`robots.txt does not name ${agent} — AI answer engines are the distribution channel for this site`);
  }
}

const llmsFull = readFileSync(join(dist, "llms-full.txt"), "utf8");
const llmsIndex = readFileSync(join(dist, "llms.txt"), "utf8");
/* Cross-link tokens are renderer markup. Left in these files, an answer engine
   quotes "{{work:slug|Label}}" back at a reader verbatim. */
for (const [name, text] of [["llms.txt", llmsIndex], ["llms-full.txt", llmsFull]]) {
  if (text.includes("{{")) fail(`${name} contains raw {{…}} cross-link tokens — strip them before publishing`);
}
if (llmsFull.length <= llmsIndex.length) {
  fail("llms-full.txt is not longer than llms.txt — it should carry full page text, not just the index");
}
/* "Full" has to mean full. The editorial contract is the most citable copy on
   a work page — Fit prefers `outcome` and `evidence` as quotes precisely
   because they are whole authored claims — and the first version of this file
   rendered only summary + body, silently dropping all of it. */
const evidencePack = JSON.parse(readFileSync(join(dist, "evidence.json"), "utf8"));
for (const doc of evidencePack.docs.filter((d) => d.kind === "work")) {
  for (const claim of doc.claims || []) {
    const needle = claim.slice(0, 60);
    if (!llmsFull.replace(/\s+/g, " ").includes(needle.replace(/\s+/g, " "))) {
      fail(`llms-full.txt omits a claim Fit would cite, from ${doc.url}: "${needle}…"`);
    }
  }
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
 * Prerender coverage. Skipped entirely when the build ran without Playwright
 * (a legitimate state — see scripts/run-prerender.mjs), but once ANY route is
 * prerendered, EVERY indexable route must be, or some URLs would silently ship
 * with the home page's metadata.
 */
const home = readFileSync(join(dist, "index.html"), "utf8");
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
    /* The tag and the artifact have to agree. Every route emits an og:image
       URL, and nothing checked that a file existed at the other end — a card
       that failed to render, or a route key that stopped matching its filename,
       would ship a broken preview to every recruiter the link reaches while
       every gate stayed green. */
    checkOgImage(doc, `dist${p}.html`);
    checkedRoutes++;
  }
  checkOgImage(readFileSync(join(dist, "index.html"), "utf8"), "dist/index.html");
}

console.log("seo-smoke ok", {
  urlCount,
  knownPaths: knownPaths.length,
  prerendered,
  checkedRoutes,
  ogImagesResolved: ogChecked,
});
