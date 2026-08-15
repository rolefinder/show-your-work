# ADR 024: Read-only MCP endpoint (`/api/mcp`)

**Status:** Accepted
**Date:** 2026-08-15

## Context

The site already publishes two machine-readable surfaces: `llms.txt` (an index
for answer engines, ADR 014) and `evidence.json` (the URL-cited corpus behind
`/fit`). Both are *pull* artifacts — an agent has to know they exist, fetch them
and parse them. MCP is how agents actually connect to software, and the audience
for a recruiter-facing portfolio now includes screeners and assistants that
never render a page.

The constraint is the one that shapes everything else here: no surface may cost
money, and no surface may weaken the cite-or-missing honesty of a published
claim.

## Decision

`functions/api/mcp.ts` — a Pages Function implementing MCP's Streamable HTTP
transport in its simplest legal form.

1. **Stateless, single-response.** One JSON-RPC message per POST, one JSON
   response. No sessions, no SSE, no server-initiated messages, no batching.
   `GET` returns 405; a notification (absent `id`) returns 202. Protocol
   versions 2025-06-18 / 2025-03-26 / 2024-11-05, echoing the client's if known.

2. **Three read-only tools over the published corpus:**
   - `list_pages` — every published page as `{id, kind, title, url, skills}`,
     optionally filtered by kind.
   - `get_page` — one page's full text by evidence id.
   - `fit_brief` — the deterministic matcher from `_lib/fit-engine.js`, the same
     bundle `/api/fit` uses, so both entry points answer a JD identically.

3. **No model runs server-side.** This is the load-bearing one. ADR 010's rule
   is that nothing in the matching path may hallucinate, and the README's claim
   is that a brief "cannot invent an employer, a date, or a metric" because it
   can only quote text that already exists in `content/`. An endpoint that
   summarized the corpus with an LLM would break exactly the property that makes
   the output worth trusting — and would add an API key, a bill, and a prompt
   injection surface fed by an untrusted job description.

   The division is deliberate: **the intelligence is the agent's, the honesty is
   ours.** The agent already has a model; what it lacks is a corpus it can trust,
   and that is what this serves.

4. **Zero metered resources.** No KV, no secrets, no bindings, no outbound
   calls. The only cost surface is the Function invocation itself, so the
   endpoint cannot run up a bill. Input caps: 64 KB body, 12 000-character JD
   (the same limit `/api/fit` enforces).

5. **Wildcard CORS, deliberately.** The corpus is public by construction — it is
   the published site. There is no origin-gated state to protect and no session
   to rebind, which is what the spec's origin-validation guidance defends
   against, so `Access-Control-Allow-Origin: *` lets browser-based agents
   connect.

6. **Discovery is emitted only where the endpoint exists.** GitHub Pages, the
   default target, cannot run Functions at all. `.well-known/mcp.json` and the
   `llms.txt` entry are therefore written only when
   `deploy.target: cloudflare-pages`. Advertising an endpoint that 404s would be
   worse than not advertising one. `evidence.json` is static, public and
   identical on both targets, so it is listed in `llms.txt` unconditionally as
   the fallback an agent can always use.

7. **Identity comes from the corpus, never from this file.** `serverInfo.name`
   is derived from the about page, because `config:check` fails the build on a
   name or origin hardcoded under `functions/` — and it is right to, since this
   file ships to every fork.

## Consequences

- Agents can enumerate, read and score the portfolio without scraping, and every
  claim they surface carries a canonical URL back to the site.
- **A pre-existing bug had to be fixed first.** `functions/_middleware.js` runs
  ahead of every Function, and an `/api` path has no file extension, so it fell
  through to the known-paths lookup — which lists the site's *routes*, never its
  *endpoints* — and was answered with a 404 document before any handler ran.
  `POST /api/fit` was unreachable on Cloudflare for this reason. `/api/*` now
  goes straight to `context.next()`.
- `npm run mcp:smoke` asserts both halves in-process: the protocol surface, and
  the routing. A protocol test that passes while the route 404s in production
  would be worse than no test. It runs the handler directly rather than under
  `wrangler pages dev`, which needs a login-shaped environment and would make it
  the kind of check that gets skipped.
- No deploy steps change: `wrangler pages deploy dist` already bundles
  `functions/` from the repo root.
- If MCP capabilities worth exposing appear (resources, prompts), they should
  stay read-only over committed artifacts. Anything metered needs a quota and a
  fail-closed posture first.

## Alternatives considered

**Server-side LLM summarization** — "query the pages with an LLM" read as
inference on this side of the wire. Rejected: it contradicts decision 3 above,
and every agent that would call this endpoint already has a better model than
the site could afford to run. What agents lack is grounding, not fluency.

**A search tool.** `retrieveEvidence` is not exported from the bundled engine, so
adding one means changing the worker's entry point. For a portfolio-sized corpus
`list_pages` + `get_page` already lets an agent read everything, and `fit_brief`
covers ranked retrieval. Worth revisiting if a corpus ever gets large enough that
enumeration is impractical.
