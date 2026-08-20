# ADR 024: A read-only MCP endpoint, and why it can never cost anything

**Status:** Accepted · 2026-08-11

## Context

The template already publishes two machine-readable surfaces: `llms.txt`, an
index for answer engines, and `evidence.json`, the URL-cited corpus behind
`/fit`. Both are pull artifacts — an agent has to already know to fetch and
parse them.

The audience for a portfolio now includes screeners and assistants that are
agents, and MCP is how agents connect to things. A site whose entire premise is
"every claim cites a page you actually published" should be readable by the
software doing the reading, rather than scraped out of rendered HTML where the
citations are lost.

The constraint is the one that governs every surface here: nothing may cost
money, and nothing may weaken cite-or-missing.

## Decision

`functions/api/mcp.ts` implements MCP's Streamable HTTP transport in its
simplest legal form.

### Stateless, single-response

Each POST carries one JSON-RPC message and gets one JSON response. No sessions,
no SSE, no server-initiated messages, no batching. GET returns 405 because
there is no stream to offer. A notification — a message with **no `id` member
at all** — gets a bare 202; `id: null` is discouraged-but-valid and still
expects a response, so only a truly absent id counts.

Protocol versions 2025-06-18 / 2025-03-26 / 2024-11-05 are supported; the
client's is echoed when recognised, otherwise the newest.

### Three read-only tools, all over `evidence.json`

| Tool | Returns |
|---|---|
| `list_pages` | every published page as `{id, kind, title, url, skills}`, optionally filtered by kind |
| `get_page` | one page's full text by evidence id |
| `fit_brief` | the deterministic matcher's brief for a pasted job description |

`fit_brief` calls the same `functions/_lib/fit-engine.js` that `/api/fit` calls,
loaded with the same `fit-config.json` the browser path reads. There is no
second matcher to drift — an agent gets exactly the brief the site would render,
citations included. The job description is untrusted input and reaches nothing
but the deterministic matcher (ADR 012).

### One quota, shared with `/api/fit`

**Amended 2026-08-11.** This section originally said "zero metered resources":
no Workers AI, no secrets, no bindings, and the invocation itself under the
free-plan cap. That was true of the *resources* and wrong about the *control*.

`/api/fit` charges 2 briefs per day per IP. This endpoint exposes the same
matcher through `fit_brief` and, as first written, charged nothing — so the
limit had a second unmetered door, and anyone wanting unlimited briefs simply
called MCP instead. A limit with a second door is not a limit.

Both endpoints now call `functions/_shared/quota.ts` and use **the same key**,
so the budget is per caller rather than per endpoint. Only `fit_brief` is
charged; `list_pages` and `get_page` are reads of a static file and stay free,
so an agent can always enumerate and read the corpus even after the matcher is
exhausted. `mcp-smoke` asserts all three properties.

Still true: no Workers AI, no secrets, no bindings beyond the quota counter,
which holds a hashed IP and an integer. Input caps are 64 KB of body and 12,000
characters of job description, matching `/api/fit`.

### Wildcard CORS, deliberately

The corpus **is** the published site, so there is no origin-gated state to
protect and no session to rebind — which is what the spec's origin-validation
guidance defends against. `Access-Control-Allow-Origin: *` lets browser-based
agents connect to something that is public by construction.

### Discovery is gated on the deploy target

`.well-known/mcp.json` and the `llms.txt` entry are emitted **only when the
deploy target is Cloudflare Pages.** Pages Functions do not exist on GitHub
Pages, which is this template's default target, so publishing a discovery
document there would advertise an endpoint that 404s.

> That is worse than publishing nothing. An agent that finds no manifest
> concludes the site has no MCP server; an agent that finds one pointing at a
> 404 concludes the server is broken, and may well report that to whoever asked.

### Identity stays data

`serverInfo.name` is the constant `show-your-work-portfolio` — a stable protocol
identifier, not a person. The human-readable `title` is read from the built
`manifest.json` at request time. Hardcoding the adopter's name would fail
`config:check`, which is the point of ADR 016.

## Consequences

- An agent can enumerate, read and score the portfolio without scraping, and
  every claim it surfaces carries a canonical URL back to the site.
- No deploy step is added: `functions/` is already bundled by both deploy paths.
- `mcp:smoke` drives the handler with real `Request` objects and a `fetch` stub
  that serves `dist/` off disk, so it needs neither wrangler nor a port. It
  asserts the protocol basics, that `kind` filtering does not leak another kind,
  that an unknown tool and an oversized JD are refused — and that **every
  `aligned` row carries a citation**, the same contract `fit-smoke` enforces for
  the site.
- GitHub Pages adopters get no MCP endpoint. Stated in `docs/guide/deploy.md`
  alongside the other Functions-only capabilities rather than discovered.
- If MCP later grows capabilities worth exposing — resources, prompts — they
  stay read-only over committed artifacts. Anything metered would need a quota
  and fail-closed behaviour first.
