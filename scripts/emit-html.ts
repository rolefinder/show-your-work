#!/usr/bin/env -S npx tsx
// Build-time identity injection for the base document.
//
// index.html, 404.html and manifest.json ship as templates carrying visible
// placeholder identity. This rewrites the copies in dist/ from
// content/config/site.yaml (via src/generated/content.ts), so an adopter never
// edits HTML or JSON to stand up their own site — they edit YAML.
//
// Runs after `bundle` (which copies the templates into dist/). If Playwright
// is available, `prerender` later overwrites these same files per route; if it
// is not, what this writes is what ships, so the home document must be
// complete on its own.
//
// Usage: npx tsx scripts/emit-html.ts

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_CONFIG, SITE_PROFILE } from "../src/generated/content";
import { buildRoutes, notFoundRoute } from "./lib/routes";
import { applyRouteHead, esc, swapTag } from "./lib/site-meta";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

/** Tags that are the same on every route, so the prerenderer never touches them. */
function applyGlobalHead(html: string): string {
  let doc = html;
  doc = swapTag(
    doc,
    /<meta name="theme-color" media="\(prefers-color-scheme: light\)"[^>]*>/,
    `<meta name="theme-color" media="(prefers-color-scheme: light)" content="${esc(SITE_CONFIG.themeColor)}" />`,
    "theme-color light",
  );
  doc = swapTag(
    doc,
    /<meta name="theme-color" media="\(prefers-color-scheme: dark\)"[^>]*>/,
    `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${esc(SITE_CONFIG.themeColorDark)}" />`,
    "theme-color dark",
  );
  return doc;
}

function emitIndex(): void {
  const file = join(dist, "index.html");
  const home = buildRoutes()[0];
  writeFileSync(file, applyRouteHead(applyGlobalHead(readFileSync(file, "utf8")), home), "utf8");
}

function emit404(): void {
  const file = join(dist, "404.html");
  if (!existsSync(file)) return;
  // The static 404 is a hand-authored body, not the SPA shell, so only its
  // title is identity-bearing.
  const html = readFileSync(file, "utf8");
  writeFileSync(
    file,
    swapTag(
      html,
      /<title>[\s\S]*?<\/title>/,
      `<title>${esc(notFoundRoute().title)}</title>`,
      "<title>",
    ),
    "utf8",
  );
}

function emitManifest(): void {
  const file = join(dist, "manifest.json");
  const manifest = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  manifest.name = `${SITE_PROFILE.name} — ${SITE_PROFILE.tagline}`;
  manifest.short_name = SITE_CONFIG.shortName || SITE_PROFILE.name;
  manifest.description = SITE_CONFIG.description || SITE_PROFILE.summary;
  manifest.background_color = SITE_CONFIG.themeColor;
  manifest.theme_color = SITE_CONFIG.themeColor;
  writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

export function emitHtml(): void {
  emitIndex();
  emit404();
  emitManifest();
  console.log(
    `emit-html: ok - identity applied to dist/{index,404}.html + manifest.json ` +
      `(name=${SITE_PROFILE.name}, demo=${SITE_CONFIG.demo})`,
  );
}

// Still runnable on its own; scripts/emit-artifacts.ts imports it instead
// so the build pays tsx's ~1.6s startup once rather than per emitter.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  emitHtml();
}
