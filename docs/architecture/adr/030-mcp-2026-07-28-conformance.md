# ADR 030: `/api/mcp` speaks MCP 2026-07-28, and the era before it

**Status:** Accepted · 2026-08-15 · supersedes the protocol-era decision in
[ADR 024](./024-read-only-mcp-endpoint.md)

> ADR 024 decided *that* this endpoint exists, what its three tools are, that
> it shares one quota with `/api/fit`, and that discovery is gated on the
> deploy target. All of that still holds and is not restated here. What this
> record changes is the **protocol revision** the endpoint speaks.

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

## What was wrong

The implementation ADR 024 recorded was adapted from the sibling site's
equivalent rather than written against the specification. That produced a
**legacy-era server**: it advertised `2025-06-18` as its newest protocol
version, implemented the `initialize` handshake, and did none of the header
validation, per-request metadata, or discovery that the current revision
requires.

The current revision is **2026-07-28**. By the spec's own compatibility matrix,
*Modern client → Legacy server* is rated **"Fails."** The endpoint would not
have worked with a client built against the then-three-week-old spec.

This ADR records the corrected decision. The lesson is cheap to state and was
expensive to miss: **prior art in a sibling repo is not a substitute for the
specification**, especially for a protocol revising on a ~4-month cadence.

## Decision

`functions/api/mcp.ts` — a Pages Function implementing MCP's Streamable HTTP
transport, **dual-era**.

1. **Both protocol eras on one endpoint.** The spec provides for this
   (`basic/versioning` § Backward Compatibility): a request carrying modern
   per-request `_meta` is served statelessly per 2026-07-28; an `initialize`
   request selects legacy semantics. A dual-era server **MAY** serve both
   concurrently on the same endpoint.

   Era is chosen by how the client opens — any modern header or a `_meta`
   protocol version means modern. Modern-only would strand every client built
   against an older revision; legacy-only is what shipped first and fails
   outright against a modern client.

   Advertised: `2026-07-28` (modern), and `2025-11-25` / `2025-06-18` /
   `2025-03-26` / `2024-11-05` through the handshake. `initialize` never echoes
   `2026-07-28` — that revision has no handshake, so offering it to a legacy
   client would be a dead end. An unrecognized ask falls back to the newest
   *legacy* revision.

2. **`server/discover`** (MUST) returns `supportedVersions`, `capabilities`,
   `instructions`, and identity in `_meta["io.modelcontextprotocol/serverInfo"]`.
   Answered on either path, because clients use it as a compatibility probe.

3. **Header validation** (MUST). `MCP-Protocol-Version` and `Mcp-Method` are
   required on modern requests, `Mcp-Name` on `tools/call`, and each is checked
   against the body. A disagreement is the confused-deputy case the spec
   requires servers to reject — a gateway routing on the header while the server
   executes the body — and returns `400` with `-32020`. `Mcp-Name` is decoded
   from the `=?base64?…?=` sentinel before comparison.

4. **Version gate** (MUST). An unsupported version returns `400` with `-32022`
   and `data: {supported, requested}` so the client can retry.

5. **Result shape.** Every result carries `resultType: "complete"` and the
   server's identity in `_meta`. `server/discover` and `tools/list` carry
   `ttlMs` (1 hour) and `cacheScope: "public"` — public is correct because the
   corpus is the published site and identical for every caller. `tools/call`
   results are deliberately *not* cacheable; the spec does not list them, and a
   Fit brief depends on the JD.

6. **Three read-only tools** over the published corpus: `list_pages`,
   `get_page`, and `fit_brief` — the last running the same bundled matcher
   **and the same `fit-config.json`** `/api/fit` and the browser use, so all
   three entry points answer a JD identically.

7. **No model runs server-side.** ADR 010's rule is that nothing in the matching
   path may hallucinate, and the README's claim is that a brief cannot invent an
   employer, a date or a metric because it can only quote text already in
   `content/`. Summarizing the corpus with an LLM would break exactly the
   property that makes the output worth trusting, and would add an API key, a
   bill, and a prompt-injection surface fed by an untrusted job description.
   **The intelligence is the agent's; the honesty is ours.**

8. **Zero metered resources.** No KV, no secrets, no bindings, no outbound
   calls. Input caps: 64 KB body, 12 000-character JD (matching `/api/fit`).

9. **Wildcard CORS, and an explicit Origin policy.** The corpus is public by
   construction, so every origin is valid here. Stated in code rather than
   omitted, because "we have no policy" and "our policy is to allow all" look
   identical from the outside and only one is a decision.

10. **Discovery is emitted only where the endpoint exists.** GitHub Pages, the
    default target, runs no Functions, so `.well-known/mcp.json` and the
    `llms.txt` entry are written only for `cloudflare-pages`. Advertising an
    endpoint that 404s is worse than advertising none. `evidence.json` is
    static and identical on both targets and is listed unconditionally as the
    fallback.

11. **Identity comes from the corpus**, never a constant — `config:check` fails
    the build on a name or origin hardcoded under `functions/`, and it is right
    to: this file ships to every fork.

## Not implemented, deliberately

- **`subscriptions/listen`** — nothing changes at runtime. The corpus is a build
  artifact, so there is no change to notify about between deploys.
- **MRTR / `InputRequiredResult`** — no tool needs input from the user to finish.
- **The Tasks extension** — every tool here is fast and synchronous.
- **Resources and prompts** — the corpus is better served as tools that return
  cited text than as opaque resource URIs.

Each is an omission with a reason, not a gap.

## Consequences

- Agents can enumerate, read and score the portfolio without scraping, and every
  claim they surface carries a canonical URL back to the site.
- **A pre-existing bug had to be fixed first.** `functions/_middleware.js` runs
  ahead of every Function, and an `/api` path has no file extension, so it fell
  through to the known-paths lookup — which lists the site's *routes*, never its
  *endpoints* — and was answered with a 404 document before any handler ran.
  `POST /api/fit` was unreachable on Cloudflare for this reason.
- `npm run mcp:smoke` asserts routing, the legacy era, the modern era, header
  validation and the version gate, in-process rather than under
  `wrangler pages dev` (which needs a login-shaped environment and would make it
  the kind of check that gets skipped). Every assertion was verified to fail
  when its behaviour is removed.
- **`.well-known/mcp.json` is a de-facto convention, not a standard.** Discovery
  is not in the core spec; it is two competing draft proposals — SEP-1649
  (server cards at `/.well-known/mcp/server-card.json`) and SEP-1960 (a manifest
  at `/.well-known/mcp`). The file shipped here uses the widely-used
  `{name, description, remotes[]}` shape. Expect to revisit it when one of those
  proposals lands; nothing depends on it, so churn is cheap.
- Protocol revisions land roughly every four months. This endpoint should be
  re-read against the spec on each one, and `PROTOCOL_VERSIONS` is the first
  thing to check.
