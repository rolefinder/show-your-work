/* Status and document selection for every non-asset path.

   Cloudflare Pages would otherwise answer unknown routes with a 200, because
   the SPA fallback makes every path "found". This decides 200 vs 404 itself
   from dist/known-paths.json (generated at build time by
   scripts/emit-seo-artifacts.ts from scripts/lib/routes.ts — the same table
   the prerenderer walks and the sitemap lists). Known route -> 200, anything
   else -> 404; the client router's "notfound" view renders once JS boots.

   It deliberately does not lean on the _redirects catch-all: `wrangler pages
   dev` logs that rule as an "infinite loop" and drops it, and with it gone
   every non-"/" route — valid or not — fell through to Cloudflare's native
   no-asset-found handling with no app content at all (ADR 014). */
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";

  // Real static assets (css/js/images/xml/json/the static 404.html/etc.)
  // must never go through this — let Cloudflare serve them normally.
  if (path !== "/" && /\.[a-z0-9]+$/i.test(path)) return context.next();

  let knownPaths;
  try {
    const manifestRes = await context.env.ASSETS.fetch(new URL("/known-paths.json", url));
    knownPaths = await manifestRes.json();
  } catch {
    return context.next(); // manifest missing/unreadable — fail open
  }
  const isKnown = Array.isArray(knownPaths) && knownPaths.includes(path);

  const res = await fetchDoc(context, url, path, isKnown);
  const text = await res.text();
  return new Response(text, { status: isKnown ? 200 : 404, headers: res.headers });
}

/* Hand back the RIGHT document. Once scripts/prerender-routes.ts has run, each
   route has its own dist/<route>.html carrying that route's title, description,
   canonical, OG tags and JSON-LD. Always serving index.html — which this
   middleware used to do — would throw all of that away and leave crawlers with
   the home page's metadata on every URL. Falling back to the shell also covers
   the build where Playwright was unavailable and nothing was prerendered. */
async function fetchDoc(context, url, path, isKnown) {
  if (isKnown && path !== "/") {
    try {
      const routeDoc = await context.env.ASSETS.fetch(new URL(`${path}.html`, url));
      if (routeDoc.ok) return routeDoc;
    } catch {
      // fall through to the shell
    }
  }
  return context.env.ASSETS.fetch(new URL("/index.html", url));
}
