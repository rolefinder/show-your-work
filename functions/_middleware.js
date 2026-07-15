/* This template has no prerendering — every route (/, /about, /work/:slug,
   etc.) is virtual. Only "/" corresponds to a real file (index.html); every
   other route depends on the _redirects SPA-fallback rule to get served at
   all. That rule turned out NOT reliable enough to build a 404 check on top
   of (confirmed locally via `wrangler pages dev`: it logged the catch-all
   as an "infinite loop" and dropped it, which meant every non-"/" route —
   valid or not — fell through to Cloudflare's native no-asset-found
   handling with no app content at all). So this middleware doesn't lean on
   _redirects at all: for any non-asset path, it fetches index.html itself
   and serves it directly, deciding the status itself from
   dist/known-paths.json (generated at build time by
   scripts/emit-seo-artifacts.ts from the same content that drives the
   app's own router in src/app.tsx). Known route -> 200. Anything else ->
   404, same body — the client router (viewFor() in src/app.tsx) renders
   its own "notfound" view once JS boots. */
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

  const shellRes = await context.env.ASSETS.fetch(new URL("/index.html", url));
  const text = await shellRes.text();
  return new Response(text, { status: isKnown ? 200 : 404, headers: shellRes.headers });
}
