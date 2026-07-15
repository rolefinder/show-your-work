# ADR 014: SEO/AEO baseline (sitemap, robots.txt, real 404, manifest)

**Status:** Accepted
**Date:** 2026-07-15

## Context

This template shipped with zero SEO tooling: no sitemap.xml, no robots.txt,
no manifest.json, and no dedicated 404 handling — unmatched paths silently
render the homepage via `viewFor()`'s fallback, with an unconditional
`_redirects` SPA catch-all (`/* /index.html 200`) always returning `200`.
Ported the equivalent infra from a sibling project (harrison-site) that
had just built it out, adapted to this repo's actual shape rather than
copied — the two repos differ in ways that change the right design.

## Key structural difference from the sibling project

harrison-site prerenders every route to a real static file at build time
(Playwright), so removing its `_redirects` catch-all was safe — every
known route already had a real file Cloudflare would serve directly, and
only genuinely unknown paths ever reached the catch-all. **This repo has
no prerendering** — every route (`/about`, `/work/:slug`, etc.) is
virtual, served by the same `index.html` shell. Removing the catch-all
here would break every direct visit to every route, not just unknown
ones. The 404 design had to be different because of this, not as a matter
of preference.

## Decision

1. **`content/config/site.yaml`** (new) holds the deployment's absolute
   origin (`origin: https://example.com` placeholder — this template has
   no fixed domain). `packages/content/emit_site.py` now also emits
   `export const SITE_ORIGIN` into `src/generated/content.ts`, reusing the
   existing Python→TS pipeline rather than adding a Node YAML dependency.
2. **`scripts/emit-seo-artifacts.ts`** (new, run via `tsx`, wired into
   `npm run build` right after `bundle`) generates three files into
   `dist/`: `sitemap.xml`, `robots.txt`, and **`known-paths.json`** — the
   last one is load-bearing, not cosmetic (see decision 3). Warns loudly
   if `SITE_ORIGIN` is still the placeholder.
3. **404 handling, given no prerendering**: originally tried leaning on
   `_redirects`' existing catch-all (`/* /index.html 200`) plus a
   `context.next()`-wrapping middleware, mirroring the sibling project.
   Verified locally with `wrangler pages dev` before trusting it (same
   discipline the sibling project's own 404 work needed) and found that
   catch-all rule doesn't reliably apply at all — `wrangler pages dev`
   logs it as an "infinite loop" and drops it, and with it gone, every
   non-`/` route (valid or not) fell through to Cloudflare's native
   no-asset-found handling with **no app content whatsoever**, not just a
   wrong status code. Whether that's a local-dev-only quirk or also true
   at the edge, a 404 mechanism that can silently break every real route
   under some condition isn't acceptable, so `functions/_middleware.js`
   no longer depends on `_redirects` at all: for any non-asset path
   (detected by file extension, so real static files always pass through
   untouched) it fetches `/index.html` itself via `context.env.ASSETS.fetch()`
   and serves it directly, deciding `200` vs `404` itself from
   `dist/known-paths.json`. `viewFor()`'s new `"notfound"` view still
   renders once the client boots, for either status. The existing
   `_redirects` catch-all is left in place (harmless, possibly redundant)
   rather than removed, in case something outside this middleware's path
   still depends on it. A separate static `404.html` exists too
   (hand-authored, not prerendered — this repo doesn't have Playwright and
   adding it just for one static page wasn't proportionate) purely as the
   response body when a direct `/404.html` request is made.
4. **`manifest.json` + a placeholder icon** (`assets/icon.svg`, explicitly
   commented as adopter-replaceable — there were no existing icon assets
   in this repo to reuse, unlike the sibling project).
5. **Client-side per-route title/description/canonical/og:url updates**
   added to `src/app.tsx` (mirroring the pattern the sibling project used
   *before* it had prerendering) — **known limitation**: since there's no
   prerendering here, none of this is visible to a crawler that doesn't
   execute JS. This is an honest gap, not an oversight; adding real
   prerendering (Playwright + a per-route snapshot step) would close it
   but is a bigger lift than this pass's scope justified for a template
   with 2 work items and 1 blog post today.
6. **`.claude/settings.json`** added with the same `.env`/secrets/
   destructive-git deny-list pattern as the sibling project, scoped down
   to what actually applies here (no `secrets/` layout, no trunk-flow
   plugin config — those aren't present in this repo).
7. **`npm run seo:check`... actually `seo:smoke`** (`scripts/seo-smoke.mjs`)
   added to the `test` chain, checking `dist/` has real sitemap/robots/
   known-paths/manifest/404.html and that the known-paths count matches
   the sitemap URL count (catches the two ever drifting apart).

## Explicitly out of scope this pass

- **BreadcrumbList / other JSON-LD** — skipped. Without prerendering,
  structured data would only be client-injected (same crawler-visibility
  caveat as decision 5), and a `Person`/`WebSite` entity schema doesn't
  make sense for a template whose demo persona ("Avery Quill") is
  explicitly fictional — a real adopter would need to author their own
  entity schema for their own real identity, not inherit a fake one.
- **IndexNow wiring** — this repo has no GitHub Actions deploy workflow
  (Cloudflare's own git integration deploys directly), so there's no
  existing hook point to run a post-deploy ping from, unlike the sibling
  project's `deploy-pages.yml`. Needs its own decision on mechanism
  (a Cloudflare-side deploy hook? a manual runbook step?) before
  implementing — not resolved here.
- **Real prerendering** — see decision 5. Worth revisiting if this
  template's content volume or adoption grows past what client-side-only
  metadata can reasonably support.

## Consequences

- Adopters must edit `content/config/site.yaml` before deploying somewhere
  real, or ship a sitemap/robots.txt full of `example.com`. The build
  warns about this loudly but doesn't hard-fail — a placeholder origin is
  a legitimate state for local preview/CI.
- `known-paths.json` must be regenerated whenever `content/work/` or
  `content/blog/` changes (already covered — it's part of `npm run build`,
  driven by the same generated content the router itself uses, so it
  can't drift from the client router's own idea of what's valid).
