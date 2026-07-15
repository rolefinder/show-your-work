#!/usr/bin/env -S npx tsx
// Build-time SEO artifacts: sitemap.xml, robots.txt, and known-paths.json
// (the last one is load-bearing here, not cosmetic — see functions/_middleware.js
// for why: this template has no prerendering, so every route is virtual, and
// the 404 middleware needs a real list of valid paths to tell "unknown route"
// apart from "known route the SPA will render client-side").
//
// Usage: npx tsx scripts/emit-seo-artifacts.ts

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BLOG, SITE_ORIGIN, WORK } from "../src/generated/content";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function main() {
  const visibleWork = WORK.filter((w) => w.visible !== false);
  const visibleBlog = BLOG.filter((b) => b.visible !== false);

  const staticPaths = ["/", "/about", "/work", "/blog", "/fit", "/graph"];
  const workPaths = visibleWork.map((w) => `/work/${w.slug}`);
  const blogPaths = visibleBlog.map((b) => `/blog/${b.slug}`);
  const knownPaths = [...staticPaths, ...workPaths, ...blogPaths];

  const isPlaceholderOrigin = SITE_ORIGIN.includes("example.com");
  if (isPlaceholderOrigin) {
    console.warn(
      "emit-seo-artifacts: content/config/site.yaml still has the placeholder " +
        `origin (${SITE_ORIGIN}) — sitemap.xml/robots.txt will ship with it. ` +
        "Set your real domain before deploying somewhere adopters will actually crawl.",
    );
  }

  const urls = knownPaths.map((p) => `${SITE_ORIGIN}${p}`);
  const sitemap =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((loc) => `  <url>\n    <loc>${escapeXml(loc)}</loc>\n  </url>`).join("\n") +
    "\n</urlset>\n";

  const robots =
    "User-agent: *\n" +
    "Allow: /\n" +
    "\n" +
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml\n`;

  mkdirSync(dist, { recursive: true });
  writeFileSync(join(dist, "sitemap.xml"), sitemap, "utf8");
  writeFileSync(join(dist, "robots.txt"), robots, "utf8");
  writeFileSync(join(dist, "known-paths.json"), JSON.stringify(knownPaths), "utf8");

  console.log(
    `emit-seo-artifacts: ok - ${urls.length} sitemap URLs, ${knownPaths.length} known paths (origin=${SITE_ORIGIN})`,
  );
}

main();
