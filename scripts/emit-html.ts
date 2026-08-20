#!/usr/bin/env bun
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
// Usage: bun scripts/emit-html.ts

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

/**
 * The CSP, as a meta tag, for targets that cannot set response headers.
 *
 * GitHub Pages serves static files and offers no header configuration at all,
 * so public/_headers is inert there. A <meta http-equiv> is the only remaining
 * channel, and it is strictly weaker:
 *
 *   - `frame-ancestors` is invalid in meta and is ignored, so clickjacking
 *     protection is gone. X-Frame-Options is a header too, so that is gone as
 *     well. Nothing in the meta tag replaces it.
 *   - HSTS, COOP and CORP are headers only. Unavailable.
 *
 * Everything else in the policy survives, which is most of what matters for a
 * static site with no inline script. The directives are kept identical to
 * _headers so the two cannot drift; the header path is still the real one.
 */
const CSP_META =
  "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; " +
  "img-src 'self' data:; connect-src 'self'; manifest-src 'self'; base-uri 'self'; " +
  "form-action 'self'; object-src 'none'; upgrade-insecure-requests";

/**
 * Insert the policy immediately after <meta charset>. Position is load-bearing:
 * a meta CSP does not apply to anything that appears before it, so putting it
 * after the stylesheet and script tags would enforce nothing while looking
 * like it did.
 */
function applyMetaCsp(html: string): string {
  if (SITE_CONFIG.deployTarget !== "github-pages") return html;
  if (html.includes('http-equiv="Content-Security-Policy"')) return html;
  const charset = html.match(/<meta charset="[^"]*"\s*\/?>/);
  if (!charset) throw new Error("emit-html: no <meta charset> to anchor the CSP meta tag to");
  return html.replace(
    charset[0],
    `${charset[0]}\n  <meta http-equiv="Content-Security-Policy" content="${esc(CSP_META)}" />`,
  );
}

/* The template carries a "these are placeholders, edit the YAML" comment for
   whoever opens public/index.html. Once identity is applied it is not true any
   more, and it was shipping to every adopter's live page telling readers the
   content was a placeholder. */
const TEMPLATE_NOTE = /\s*<!--\s*TEMPLATE\.[\s\S]*?-->/;

function emitIndex(): void {
  const file = join(dist, "index.html");
  const home = buildRoutes()[0];
  const doc = applyRouteHead(applyGlobalHead(readFileSync(file, "utf8")), home);
  writeFileSync(file, applyMetaCsp(doc.replace(TEMPLATE_NOTE, "")), "utf8");
}

/**
 * Adopter palette overrides -> dist/tokens/adopter.css.
 *
 * tokens/adopter.css ships empty and is @imported last, so writing the four
 * --syw-* variables here beats the shipped palette without touching
 * tokens/colors.css. That is the difference between "add a theme: block to
 * your config" and "edit a file the template owns and then fight a merge
 * conflict on every update".
 */
function emitThemeTokens(): void {
  const entries = Object.entries(SITE_CONFIG.theme ?? {}).filter(([, v]) => v);
  if (!entries.length) return;
  const vars: Record<string, string> = {
    accent: "--syw-brand",
    accentDeep: "--syw-brand-deep",
    bg: "--syw-bg",
    fg: "--syw-fg",
  };
  const body = entries.map(([k, v]) => `  ${vars[k]}: ${v};`).join("\n");
  writeFileSync(
    join(dist, "tokens", "adopter.css"),
    `/* GENERATED from content/config/site.yaml \`theme:\` — do not edit. */\n:root {\n${body}\n}\n`,
    "utf8",
  );
}

/**
 * Files GitHub Pages needs and Cloudflare does not.
 *
 * .nojekyll is not optional: without it Pages runs the output through Jekyll,
 * which drops every path beginning with an underscore. That would silently
 * delete _headers and _redirects from the deploy — harmless here, since
 * neither does anything on Pages — but it is the same rule that would eat any
 * future underscore-prefixed asset, and the failure looks like a missing file
 * rather than a build error.
 */
function emitPagesFiles(): void {
  if (SITE_CONFIG.deployTarget !== "github-pages") return;
  writeFileSync(join(dist, ".nojekyll"), "", "utf8");
  if (SITE_CONFIG.customDomain) {
    writeFileSync(join(dist, "CNAME"), SITE_CONFIG.customDomain + "\n", "utf8");
  }
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
  emitThemeTokens();
  emitPagesFiles();
  console.log(
    `emit-html: ok - identity applied to dist/{index,404}.html + manifest.json ` +
      `(name=${SITE_PROFILE.name}, demo=${SITE_CONFIG.demo}, target=${SITE_CONFIG.deployTarget}` +
      `${SITE_CONFIG.customDomain ? `, CNAME=${SITE_CONFIG.customDomain}` : ""})`,
  );
}

// Still runnable on its own; scripts/emit-artifacts.ts imports it instead
// so the pair runs in one process, in the order known-paths.json needs.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  emitHtml();
}
