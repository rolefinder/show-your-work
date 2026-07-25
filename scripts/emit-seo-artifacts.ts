#!/usr/bin/env -S npx tsx
// Build-time SEO artifacts: sitemap.xml, robots.txt, llms.txt, and
// known-paths.json.
//
// known-paths.json is load-bearing, not cosmetic — functions/_middleware.js
// uses it to tell "unknown route" apart from "known route", and to decide
// 200 vs 404. Every artifact here is derived from scripts/lib/routes.ts, the
// same table the prerenderer walks, so they cannot drift apart.
//
// Usage: npx tsx scripts/emit-seo-artifacts.ts

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_CONFIG, SITE_PROFILE } from "../src/generated/content";
import { buildRoutes, knownPaths, visibleBlog, visibleWork } from "./lib/routes";
import { SITE } from "./lib/site-meta";

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

/**
 * llms.txt — the AEO counterpart to robots.txt: a plain-text map of the site
 * for language models, so an assistant asked about this person can cite real
 * pages instead of guessing. https://llmstxt.org
 */
function llmsTxt(): string {
  const lines = [
    `# ${SITE_PROFILE.name}`,
    "",
    `> ${SITE_PROFILE.tagline}`,
    "",
    SITE_PROFILE.summary,
    "",
    `Location: ${SITE_PROFILE.location}`,
    `Contact: ${SITE_PROFILE.email}`,
  ];
  if (SITE_PROFILE.github) lines.push(`GitHub: ${SITE_PROFILE.github}`);
  if (SITE_PROFILE.linkedin) lines.push(`LinkedIn: ${SITE_PROFILE.linkedin}`);
  lines.push("", "## Work", "");
  for (const w of visibleWork) {
    lines.push(`- [${w.title}](${SITE}/work/${w.slug}): ${w.summary.replace(/\s+/g, " ").trim()}`);
  }
  lines.push("", "## Writing", "");
  for (const b of visibleBlog) {
    lines.push(`- [${b.title}](${SITE}/blog/${b.slug}): ${b.summary.replace(/\s+/g, " ").trim()}`);
  }
  lines.push("", "## Skills", "", SITE_PROFILE.skills.join(", "), "");
  lines.push("## Tools", "");
  lines.push(
    `- [Fit](${SITE}/fit): paste a job description, get a brief where every aligned claim cites a page above.`,
    `- [Graph](${SITE}/graph): how the work connects.`,
    "",
  );
  return lines.join("\n");
}

function main(): void {
  const routes = buildRoutes();
  const paths = knownPaths();

  if (SITE_CONFIG.origin.includes("example.com")) {
    console.warn(
      "emit-seo-artifacts: content/config/site.yaml still has the placeholder " +
        `origin (${SITE_CONFIG.origin}) - sitemap.xml/robots.txt/llms.txt will ship with it. ` +
        "Set your real domain before deploying somewhere that will actually be crawled.",
    );
  }

  const sitemap =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    routes
      .filter((r) => !r.noindex)
      .map((r) => `  <url>\n    <loc>${escapeXml(SITE + r.path)}</loc>\n  </url>`)
      .join("\n") +
    "\n</urlset>\n";

  const robots =
    "User-agent: *\n" +
    "Allow: /\n" +
    "\n" +
    `Sitemap: ${SITE}/sitemap.xml\n`;

  mkdirSync(dist, { recursive: true });
  writeFileSync(join(dist, "sitemap.xml"), sitemap, "utf8");
  writeFileSync(join(dist, "robots.txt"), robots, "utf8");
  writeFileSync(join(dist, "llms.txt"), llmsTxt(), "utf8");
  writeFileSync(join(dist, "known-paths.json"), JSON.stringify(paths), "utf8");

  console.log(
    `emit-seo-artifacts: ok - ${paths.length} sitemap URLs, ${paths.length} known paths, ` +
      `llms.txt (origin=${SITE})`,
  );
}

main();
