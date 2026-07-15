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

console.log("seo-smoke ok", { urlCount, knownPaths: knownPaths.length });
