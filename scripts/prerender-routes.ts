#!/usr/bin/env bun
// Build-time prerender: snapshot every route of the built SPA into its own
// dist/<route>.html with per-route title/description/canonical/OG tags,
// route-appropriate JSON-LD, and a generated 1200x630 social card, using
// headless Chromium against the real dist/ artifact.
//
// Closes the gap ADR 014 §5 recorded honestly: without this, every route's
// metadata is client-set and a crawler that doesn't execute JS sees only the
// home shell.
//
// Exit codes: 0 = prerendered; 2 = Playwright/Chromium unavailable and the
// caller should degrade with a warning; anything else = attempted and failed.
// PRERENDER=0 forces a skip.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { SITE_PROFILE } from "../src/generated/content";
import { buildRoutes, notFoundRoute } from "./lib/routes";
import { applyRouteHead, esc, SITE, type RouteMeta } from "./lib/site-meta";
import { SITE_CONFIG } from "../src/generated/content";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const PORT = Number(process.env.PRERENDER_PORT || 4178);

/**
 * The card's accent stripe is the BRAND colour, which lives in
 * tokens/colors.css as --syw-brand — not in site.yaml. site.yaml's theme_color
 * is the page background, so using it painted a beige bar on a near-black
 * card. Read the token instead of duplicating the value into config, so the
 * card can't drift from the site.
 */
function brandAccent(): string {
  const css = readFileSync(join(root, "tokens", "colors.css"), "utf8");
  const m = css.match(/--syw-brand:\s*(#[0-9a-f]{3,8})/i);
  return m ? m[1] : SITE_CONFIG.themeColorDark;
}
const ACCENT = brandAccent();

if (process.env.PRERENDER === "0") {
  console.warn("prerender: skipped (PRERENDER=0)");
  process.exit(2);
}

let chromium: typeof import("playwright").chromium | undefined;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.warn("prerender: playwright not installed - skipping");
  process.exit(2);
}

const routes: RouteMeta[] = [...buildRoutes(), notFoundRoute()];

/* Tripwire on generated docs — the corpus is scanned upstream, this catches
   template mistakes that splice something in late. */
const SECRET_RE =
  /(-----BEGIN [A-Z ]*PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-)/;

/* ---------------------------- OG card template ----------------------------
   Uses the same system font stack as the site (tokens/typography.css) — the
   template ships no webfont, so the card must not depend on one. */
function cardHtml(route: RouteMeta): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin: 0; box-sizing: border-box; }
    body { width: 1200px; height: 630px;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: ${esc(SITE_CONFIG.themeColorDark)}; color: #f4f1ea;
      display: flex; flex-direction: column; justify-content: space-between; padding: 72px 80px; }
    .eyebrow { font-size: 26px; letter-spacing: 0.14em; text-transform: uppercase;
      color: rgba(244,241,234,0.62); font-weight: 500; }
    h1 { font-size: ${route.card.length > 34 ? 60 : 76}px; font-weight: 600; letter-spacing: -0.02em;
      line-height: 1.06; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .desc { font-size: 30px; line-height: 1.4; color: rgba(244,241,234,0.72); max-width: 20em;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .foot { display: flex; justify-content: space-between; align-items: baseline;
      font-size: 28px; color: rgba(244,241,234,0.62); font-weight: 500; }
    .accent { width: 120px; height: 6px; background: ${esc(ACCENT)}; border-radius: 3px; margin-bottom: 28px; }
  </style></head><body>
    <div class="eyebrow">${esc(route.eyebrow)}</div>
    <div><div class="accent"></div><h1>${esc(route.card)}</h1>
    <p class="desc" style="margin-top:24px">${esc(route.desc)}</p></div>
    <div class="foot"><span>${esc(SITE_PROFILE.name)}</span><span>${esc(SITE.replace(/^https?:\/\//, ""))}</span></div>
  </body></html>`;
}

/* ------------------------- per-route document assembly ------------------------- */
const template = readFileSync(join(dist, "index.html"), "utf8");
if (!template.includes('<div id="root"></div>') || template.includes("data-prerender")) {
  console.error("prerender: dist/index.html is already prerendered - run a fresh build first");
  process.exit(1);
}

function routeDoc(route: RouteMeta, snapshot: string): string {
  let doc = applyRouteHead(template, route);
  doc = doc.replace('<div id="root"></div>', snapshot);
  if (SECRET_RE.test(doc)) {
    throw new Error(`secret-like token in generated doc for ${route.path}`);
  }
  return doc;
}

/* --------------------------------- main --------------------------------- */
async function launch() {
  try {
    return await chromium!.launch();
  } catch {
    return null;
  }
}

// --spa so the server always hands back the client-rendered shell, never a
// route doc this script wrote on a previous build.
const server = spawn(
  process.execPath,
  [join(root, "scripts", "preview.mjs"), "--port", String(PORT), "--spa"],
  { stdio: ["ignore", "pipe", "inherit"] },
);
await new Promise<void>((ready, fail) => {
  const t = setTimeout(() => fail(new Error("preview server did not start")), 10000);
  server.stdout.on("data", (d) => {
    if (String(d).includes("serving")) {
      clearTimeout(t);
      ready();
    }
  });
  server.on("exit", (code) => fail(new Error(`preview server exited (${code}) - port in use?`)));
});

let browser: Awaited<ReturnType<typeof launch>> = null;
try {
  browser = await launch();
  if (!browser) {
    console.warn("prerender: chromium not available - skipping");
    server.kill();
    process.exit(2);
  }
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  // The WebGL engine snapshots as a quiet empty host on content routes; only
  // /graph, where it is the page, gets to load it.
  let allowGraphEngine = false;
  await context.route("**/graph-engine.js*", (r) => (allowGraphEngine ? r.continue() : r.abort()));
  const page = await context.newPage();
  if (process.env.PRERENDER_DEBUG) {
    page.on("pageerror", (e) => console.error("[pageerror]", e.message.slice(0, 300)));
  }
  mkdirSync(join(dist, "assets", "og"), { recursive: true });

  let docCount = 0;
  for (const route of routes) {
    allowGraphEngine = !!route.allowGraphEngine;
    await page.goto(`http://localhost:${PORT}${route.path}`, { waitUntil: "networkidle" });
    await page.waitForSelector(route.waitFor || "main h1", { timeout: 15000 });
    const snapshot = await page.evaluate(() => {
      const rootEl = document.getElementById("root");
      if (!rootEl) throw new Error("no #root");
      const clone = rootEl.cloneNode(true) as HTMLElement;
      clone.setAttribute("data-prerender", "1");
      return clone.outerHTML;
    });

    if (route.path === "/404") {
      // Cloudflare Pages looks for a top-level 404.html, not 404/index.html.
      writeFileSync(join(dist, "404.html"), routeDoc(route, snapshot), "utf8");
    } else if (route.path === "/") {
      writeFileSync(join(dist, "index.html"), routeDoc(route, snapshot), "utf8");
    } else {
      // Pages serves <route>.html extensionlessly at /<route>. Directory
      // indexes would make it redirect to a trailing slash, conflicting with
      // the no-trailing-slash canonical and sitemap URLs.
      const outPath = join(dist, ...route.path.split("/").filter(Boolean)) + ".html";
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, routeDoc(route, snapshot), "utf8");
    }
    docCount++;
  }

  /* Social cards — same session, card-sized viewport. */
  const cardPage = await context.newPage();
  await cardPage.setViewportSize({ width: 1200, height: 630 });
  let cardCount = 0;
  for (const route of routes) {
    await cardPage.setContent(cardHtml(route), { waitUntil: "networkidle" });
    await cardPage.screenshot({ path: join(dist, "assets", "og", `${route.key}.png`) });
    cardCount++;
  }

  console.log(`prerender: ok - ${docCount} route docs, ${cardCount} og cards`);
} catch (err) {
  console.error("prerender: failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
}
