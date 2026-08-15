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
import { linkLabel } from "../src/profile-links";
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
  for (const [key, href] of Object.entries(SITE_PROFILE.links)) {
    lines.push(`${linkLabel(key)}: ${href}`);
  }
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
    `- [Evidence pack](${SITE}/evidence.json): every page above as JSON — id, title, canonical URL, full text, skills.`,
  );
  /* Only advertise the MCP endpoint where it can actually run. GitHub Pages
     serves no Functions, so listing it there would send every agent that reads
     this file to a 404. evidence.json above is the static equivalent and works
     on both targets. */
  if (MCP_AVAILABLE) {
    lines.push(
      `- [MCP](${SITE}/api/mcp): Model Context Protocol endpoint (streamable-http, read-only) — ` +
        "tools: list_pages, get_page, fit_brief. No model runs server-side.",
    );
  }
  lines.push("");
  return lines.join("\n");
}

/** Pages Functions exist only on Cloudflare; GitHub Pages cannot run them. */
const MCP_AVAILABLE = SITE_CONFIG.deployTarget === "cloudflare-pages";

/**
 * .well-known/mcp.json — registry-style discovery, so an agent handed only the
 * domain can find the endpoint rather than being told about it out of band.
 */
function mcpManifest(): string {
  return (
    JSON.stringify(
      {
        name: SITE_PROFILE.name,
        description: `Read-only portfolio corpus for ${SITE_PROFILE.name}. Enumerate pages, read their text, and score a job description against published evidence.`,
        remotes: [{ type: "streamable-http", url: `${SITE}/api/mcp` }],
      },
      null,
      2,
    ) + "\n"
  );
}

export function emitSeoArtifacts(): void {
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

  if (MCP_AVAILABLE) {
    mkdirSync(join(dist, ".well-known"), { recursive: true });
    writeFileSync(join(dist, ".well-known", "mcp.json"), mcpManifest(), "utf8");
  }

  console.log(
    `emit-seo-artifacts: ok - ${paths.length} sitemap URLs, ${paths.length} known paths, ` +
      `llms.txt (origin=${SITE})` +
      (MCP_AVAILABLE ? ", .well-known/mcp.json" : " - no MCP manifest (deploy target has no Functions)"),
  );
}

// Still runnable on its own; scripts/emit-artifacts.ts imports it instead
// so the build pays tsx's ~1.6s startup once rather than per emitter.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  emitSeoArtifacts();
}
