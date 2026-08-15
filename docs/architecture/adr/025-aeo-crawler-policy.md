# ADR 025: AEO — per-class crawler policy, and the full-text corpus

**Status:** Accepted
**Date:** 2026-08-15

## Context

ADR 014 established the SEO/AEO baseline: sitemap, robots, `llms.txt`, JSON-LD,
canonicals. ADR 017 added prerendering, closing that ADR's honest gap about
client-rendered metadata. ADR 024 added `/api/mcp` so agents can query the
corpus directly.

That covers *being readable*. It does not cover *being allowed to read*, which
turns out to be where the value actually leaks — and for a site whose entire
purpose is being found by a recruiter's assistant, being uncitable is
indistinguishable from not existing.

Two facts drove this pass, both verified against primary sources rather than
inferred:

1. **`User-agent: *` no longer expresses intent.** AI crawlers do three
   different jobs. OpenAI publishes `GPTBot` (training), `OAI-SearchBot`
   (search indexing), and `ChatGPT-User` (real-time user-initiated). Anthropic
   splits `ClaudeBot`, `Claude-SearchBot` and `Claude-User` the same way. A
   single blanket rule cannot say "index me so you can cite me, but leave me
   out of training" — or the reverse — and that is the decision an adopter
   actually has.

2. **Cloudflare blocks these crawlers by default.** Every zone created since
   2025-07-01 ships a managed WAF rule blocking GPTBot, ClaudeBot,
   PerplexityBot, OAI-SearchBot and Google-Extended, and it does not
   distinguish training from search. It applies at the edge, before
   `robots.txt` is read.

Fact 2 is the sharp one for this template, because Cloudflare Pages is the
recommended target for full functionality. An adopter can follow the deploy
guide exactly, ship a flawless agent-facing surface, and be invisible to every
answer engine — with no signal that anything is wrong.

## Decision

1. **robots.txt states a policy per crawler class**, generated from
   `ai_crawlers:` in `content/config/site.yaml`:

   - `search: true` (default) — `OAI-SearchBot`, `Claude-SearchBot`,
     `PerplexityBot`, plus the user-initiated fetchers `ChatGPT-User`,
     `Claude-User`, `Perplexity-User`. This is the distribution channel.
   - `training: true` (default) — `GPTBot`, `ClaudeBot`, `Google-Extended`,
     `Applebot-Extended`, `CCBot`, `Meta-ExternalAgent`, `Bytespider`.

   Both default to allowed, which is right for a portfolio: the search
   crawlers are how you get cited, and a site that exists to be found has
   little to gain from opting out of the corpora that answer questions about
   it. An adopter who disagrees flips a boolean, and the generated file
   explains which switch does what.

   The user-initiated group follows `search` rather than getting its own knob —
   blocking "a human asked about this page just now" serves nobody. The file
   notes that `ChatGPT-User` and `Perplexity-User` may not honour robots.txt at
   all, since the request came from a person; `Claude-User` does.

2. **`llms-full.txt`** joins `llms.txt`. The index tells an engine what exists;
   the expansion means one request gets every page's full text. That is the
   difference between being summarized from a one-line description and being
   quoted from what you wrote. Built from the ADR 023 body grammar, so it
   cannot drift from the rendered page.

3. **Cross-link tokens are stripped** from both files. `{{work:slug|Label}}` is
   renderer markup; left in, an answer engine quotes it back at a reader
   verbatim. `seo:smoke` fails on a stray `{{`.

4. **`<lastmod>` in the sitemap**, from the authored date. AI citation has a
   strong recency bias, and a sitemap with no freshness signal makes a page
   updated last week look identical to one from two years ago. `YYYY-MM` widens
   to its first day rather than being dropped.

5. **The Cloudflare default is documented where it will be read** — a blockquote
   at the top of the deploy guide's agent section, and the first actionable
   block in the SEO checklist. It is a dashboard action; the repo cannot fix
   it, so the only useful thing the repo can do is refuse to let an adopter
   discover it by accident.

6. **`seo:smoke` gates the surface.** It asserts the search-crawler group is
   named in robots.txt, that both llms files exist and carry no raw tokens, and
   that the full-text file is actually longer than the index. This surface rots
   silently — nothing renders it, so a regression is invisible until citations
   stop and nobody knows why.

## Consequences

- `robots.txt` goes from 4 lines to a document that records a decision. That is
  the point: the previous file was a default nobody had chosen.
- Adopters get one honest knob each for the two genuinely different questions,
  instead of one blunt one for a question that is actually two.
- The crawler token lists will drift as vendors add and rename bots. They live
  in one `AI_CRAWLERS` constant in `scripts/emit-seo-artifacts.ts` for that
  reason. Re-check them against vendor documentation periodically; the SEO
  checklist says so.
- `llms-full.txt` grows with the corpus. For a portfolio that is fine; a site
  with hundreds of pages would want to reconsider shipping it whole.
- Nothing here has been verified against a live answer engine — that requires a
  real deployed domain and days of crawl latency. The checklist ends with the
  only test that actually counts: ask ChatGPT, Claude and Perplexity a question
  only your site answers, and see whether they cite you.
