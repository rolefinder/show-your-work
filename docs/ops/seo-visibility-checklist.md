# SEO/AEO checklist — for adopters deploying this template

Copy this into your own notes (or a PR description) after you deploy your
fork somewhere real. None of these can be automated by an agent — they're
dashboard/account actions on services this template doesn't control.

## Before anything else

- [ ] Set your real domain in `content/config/site.yaml` (`origin:`),
      re-run `bun run build`, and confirm `dist/sitemap.xml`/`dist/robots.txt`
      no longer say `example.com`.

## Unblock AI crawlers at the edge (Cloudflare only — do this first)

**This is the one that silently costs you everything.** Every Cloudflare zone
created since 2025-07-01 blocks GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot
and Google-Extended by default, before `robots.txt` is read. Your `llms.txt`,
your structured data and your MCP endpoint are all invisible until you change
it, and nothing in this repo can.

- [ ] Cloudflare dashboard → **AI Crawl Control** (formerly AI Audit).
- [ ] Allow the search crawlers at minimum: `OAI-SearchBot`,
      `Claude-SearchBot`, `PerplexityBot` — these are how you get cited.
- [ ] Allow the user-initiated fetchers: `ChatGPT-User`, `Claude-User`,
      `Perplexity-User` — someone asking an assistant about you right now.
- [ ] Decide separately on training crawlers (`GPTBot`, `ClaudeBot`,
      `Google-Extended`, `CCBot`). Blocking these does **not** remove you from
      AI search, and `Google-Extended` has no effect on Google Search ranking.
- [ ] After a few days, check the Crawlers tab: it lists which AI services
      actually fetched your content in the last 24 hours. That is the only real
      confirmation the change worked.
- [ ] Keep `ai_crawlers:` in `content/config/site.yaml` in agreement with what
      you set here, so `robots.txt` and the edge tell the same story.

## Verify the agent-facing surface

- [ ] `curl https://<your-domain>/llms.txt` — the index.
- [ ] `curl https://<your-domain>/llms-full.txt` — every page in full.
- [ ] `curl https://<your-domain>/evidence.json` — the corpus as JSON.
- [ ] Cloudflare only: `curl -X POST https://<your-domain>/api/mcp -H 'Content-Type: application/json' -H 'MCP-Protocol-Version: 2026-07-28' -H 'Mcp-Method: server/discover' -d '{"jsonrpc":"2.0","id":1,"method":"server/discover","params":{}}'`
      should return your supported protocol versions.
- [ ] Ask ChatGPT, Claude and Perplexity a question only your site answers
      ("what has &lt;your name&gt; built with &lt;a skill on your site&gt;?") and see
      whether they cite your pages. This is the actual scoreboard.

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
