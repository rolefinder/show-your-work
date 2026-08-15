#!/usr/bin/env -S npx tsx
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

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { SITE_PROFILE } from "../src/generated/content";
import { buildRoutes, notFoundRoute } from "./lib/routes";
import { applyRouteHead, esc, SITE, type RouteMeta } from "./lib/site-meta";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const PORT = Number(process.env.PRERENDER_PORT || 4178);

/**
 * The card renders against the site's REAL tokens.
 *
 * This used to regex `--rm-brand` out of tokens/colors.css — the file
 * docs/guide/theming.md tells adopters never to edit. Adopter overrides land in
 * dist/tokens/adopter.css, which that never read, so setting theme.accent
 * turned the whole site purple and left every social card in the template's
 * shipped teal. The card is the first thing a recruiter sees, and it was the
 * one surface still wearing someone else's colours.
 *
 * Reading dist/ rather than the source tree is what fixes it: by the time
 * prerender runs (last in the build), scripts/build.mjs has copied tokens/ and
 * emit-html.ts has written adopter.css from site.yaml. Import order matches
 * tokens/tokens.css — adopter.css LAST, so its :root wins, the same ordering
 * additive:check asserts for the served page.
 */
const CARD_TOKEN_FILES = [
  "colors.css",
  "typography.css",
  "spacing.css",
  "effects.css",
  "adopter.css",
];

function cardCss(): string {
  const tokens = CARD_TOKEN_FILES.map((f) => {
    const path = join(dist, "tokens", f);
    return existsSync(path) ? readFileSync(path, "utf8") : "";
  }).join("\n");
  const card = readFileSync(join(root, "scripts", "lib", "og-card.css"), "utf8");
  return tokens + "\n" + card;
}

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
   Markup only. Every value lives in scripts/lib/og-card.css, against the real
   tokens inlined by cardCss() — so the card cannot drift from the site, and
   check-style-tokens can see it. */
function cardHtml(route: RouteMeta, css: string): string {
  // A long title needs the smaller type step; expressed as a class so the size
  // stays in the stylesheet rather than being interpolated in here.
  const bodyClass = route.card.length > 34 ? ' class="long-title"' : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body${bodyClass}>
    <div class="eyebrow">${esc(route.eyebrow)}</div>
    <div><div class="accent"></div><h1>${esc(route.card)}</h1>
    <p class="desc">${esc(route.desc)}</p></div>
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

  /* Social cards — card-sized viewport, in a context pinned to the light
     scheme. The card paints --surface-inverse over --fg-on-inverse, and those
     two swap under prefers-color-scheme: dark. Inheriting the runner's scheme
     would mean the same commit produced a dark card on one machine and a light
     one on another. */
  const cardContext = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    colorScheme: "light",
  });
  const cardPage = await cardContext.newPage();
  const css = cardCss();
  let cardCount = 0;
  for (const route of routes) {
    await cardPage.setContent(cardHtml(route, css), { waitUntil: "networkidle" });
    await cardPage.screenshot({ path: join(dist, "assets", "og", `${route.key}.png`) });
    cardCount++;
  }
  await cardContext.close();

  console.log(`prerender: ok - ${docCount} route docs, ${cardCount} og cards`);
} catch (err) {
  console.error("prerender: failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
}
