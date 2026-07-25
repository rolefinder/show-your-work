#!/usr/bin/env -S npx tsx
// Build-time identity injection.
//
// index.html, 404.html and manifest.json ship as templates carrying neutral
// placeholder identity. This rewrites the copies in dist/ from
// content/config/site.yaml (via src/generated/content.ts), so an adopter
// never edits HTML or JSON to stand up their own site — they edit YAML.
//
// Runs after `bundle` (which copies the templates into dist/) and before
// `emit:seo`. Idempotent: it rewrites dist/, never the source templates.
//
// Usage: npx tsx scripts/emit-html.ts

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_CONFIG, SITE_PROFILE } from "../src/generated/content";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Replace a whole tag matched by `pattern` with `replacement`. */
function swap(html: string, pattern: RegExp, replacement: string, label: string): string {
  if (!pattern.test(html)) {
    throw new Error(
      `emit-html: no ${label} tag matched in the template — the template and ` +
        "this emitter have drifted apart",
    );
  }
  return html.replace(pattern, replacement);
}

function homeTitle(): string {
  return `${SITE_PROFILE.name} — ${SITE_PROFILE.tagline}`;
}

function emitIndex(): void {
  const file = join(dist, "index.html");
  let html = readFileSync(file, "utf8");
  const title = escapeHtml(homeTitle());
  const desc = escapeHtml(SITE_CONFIG.description || SITE_PROFILE.summary);

  html = swap(html, /<title>[\s\S]*?<\/title>/, `<title>${title}</title>`, "<title>");
  html = swap(
    html,
    /<meta name="description"[^>]*>/,
    `<meta name="description" content="${desc}" />`,
    "description",
  );
  html = swap(
    html,
    /<meta property="og:title"[^>]*>/,
    `<meta property="og:title" content="${title}" />`,
    "og:title",
  );
  html = swap(
    html,
    /<meta property="og:description"[^>]*>/,
    `<meta property="og:description" content="${desc}" />`,
    "og:description",
  );
  html = swap(
    html,
    /<meta name="theme-color" media="\(prefers-color-scheme: light\)"[^>]*>/,
    `<meta name="theme-color" media="(prefers-color-scheme: light)" content="${escapeHtml(SITE_CONFIG.themeColor)}" />`,
    "theme-color light",
  );
  html = swap(
    html,
    /<meta name="theme-color" media="\(prefers-color-scheme: dark\)"[^>]*>/,
    `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${escapeHtml(SITE_CONFIG.themeColorDark)}" />`,
    "theme-color dark",
  );

  writeFileSync(file, html, "utf8");
}

function emit404(): void {
  const file = join(dist, "404.html");
  if (!existsSync(file)) return;
  let html = readFileSync(file, "utf8");
  html = swap(
    html,
    /<title>[\s\S]*?<\/title>/,
    `<title>Page Not Found — ${escapeHtml(SITE_CONFIG.titleSuffix || SITE_PROFILE.name)}</title>`,
    "<title>",
  );
  writeFileSync(file, html, "utf8");
}

function emitManifest(): void {
  const file = join(dist, "manifest.json");
  const manifest = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  manifest.name = homeTitle();
  manifest.short_name = SITE_CONFIG.shortName || SITE_PROFILE.name;
  manifest.description = SITE_CONFIG.description || SITE_PROFILE.summary;
  manifest.background_color = SITE_CONFIG.themeColor;
  manifest.theme_color = SITE_CONFIG.themeColor;
  writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

function main(): void {
  emitIndex();
  emit404();
  emitManifest();
  console.log(
    `emit-html: ok - identity applied to dist/{index,404}.html + manifest.json ` +
      `(name=${SITE_PROFILE.name}, demo=${SITE_CONFIG.demo})`,
  );
}

main();
