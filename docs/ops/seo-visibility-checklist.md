# SEO/AEO checklist — for adopters deploying this template

Copy this into your own notes (or a PR description) after you deploy your
fork somewhere real. None of these can be automated by an agent — they're
dashboard/account actions on services this template doesn't control.

## Before anything else

- [ ] Set your real domain in `content/config/site.yaml` (`origin:`),
      re-run `bun run build`, and confirm `dist/sitemap.xml`/`dist/robots.txt`
      no longer say `example.com`.

## Google Search Console

- [ ] Add your domain as a property.
- [ ] Verify via DNS TXT at your DNS provider (not an HTML meta tag).
- [ ] Submit `https://<your-domain>/sitemap.xml`.
- [ ] After any content change, use URL Inspection → Request Indexing for
      the pages you just changed.

## Bing Webmaster Tools

- [ ] Add and verify your site.
- [ ] Submit the same sitemap.

## Profile cross-links (the strongest signal for a name/brand search)

- [ ] LinkedIn profile → Website field points at your deployed domain.
- [ ] GitHub profile → Website field points at your deployed domain.
- [ ] Pinned repos' About section links to the matching `/work/<slug>` page.

## Cloudflare-side

- [ ] Confirm your Pages project's custom domain is attached and DNS is
      proxied through Cloudflare (needed for the security headers in
      `_headers` to actually apply).
- [ ] If you want AI/answer-engine crawlers (GPTBot, ClaudeBot, etc.) to
      index you, check Cloudflare's "AI Crawl Control" dashboard setting
      isn't blocking them — `robots.txt` here allows everyone by default,
      but Cloudflare's edge-level toggle can override that.

## Known gaps in this template (see ADR 014)

- No server-rendered/prerendered per-route `<title>`/meta/JSON-LD — a
  crawler that doesn't execute JavaScript sees only the generic homepage
  metadata for every route. If that matters for your use case, prerendering
  (à la the sibling project this was ported from) is the fix, not attempted
  here.
- No IndexNow (Bing/Yandex instant-notify) wiring — this repo has no
  deploy-workflow hook to attach it to. If you add one, `dist/sitemap.xml`
  is your URL source of truth.
