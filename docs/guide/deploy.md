# Deploying

Two targets. **GitHub Pages** needs no account you do not already have, so it
is the default. **Cloudflare Pages** is the upgrade, and the difference is
security headers rather than convenience.

Set the target in `content/config/site.yaml`:

```yaml
deploy:
  target: github-pages      # or cloudflare-pages
  custom_domain: ""         # optional; emitted as dist/CNAME on Pages
```

Or let an agent do the whole thing: **`/launch`** gathers your details, builds,
asks once before anything goes public, and hands back a URL.

## What differs, honestly

| | GitHub Pages | Cloudflare Pages |
|---|---|---|
| Account needed | none beyond GitHub | a Cloudflare account |
| Setup | `npm run pages:setup`, no dashboard visit | project created in the dashboard |
| **CSP** | `<meta http-equiv>` only | real `Content-Security-Policy` header |
| **`frame-ancestors`** | **unavailable** — invalid in a meta tag | enforced |
| **X-Frame-Options** | **unavailable** — header only | `DENY` |
| HSTS, COOP, CORP | **unavailable** — headers only | set by `public/_headers` |
| Cache-Control on assets | Pages' defaults | immutable, one year |
| `POST /api/fit` | unavailable | optional Function |
| **`POST /api/mcp`** (agents) | **unavailable** — no Functions | read-only MCP endpoint |
| Browser Fit | works | works |
| `llms.txt`, `evidence.json` | identical | identical |
| Prerendering, SEO, sitemap, OG cards | identical | identical |

The reason for the whole middle block is one fact: **GitHub Pages cannot set
HTTP response headers.** `public/_headers` is inert there. The build compensates
by injecting the same policy as a `<meta http-equiv="Content-Security-Policy">`
into every document, first thing after `<meta charset>` — position matters,
because a meta CSP does not apply to anything above it. What survives is the
part that stops script and connection abuse. What does not survive is
clickjacking protection, which has no meta equivalent.

For a portfolio, that is usually an acceptable trade, and it is stated here
rather than glossed so it can be an actual decision.

## Agents

Cloudflare deploys get `POST /api/mcp`, a read-only [MCP](https://modelcontextprotocol.io)
endpoint (ADR 024) so an assistant can enumerate your pages, read them, and
score a job description against them without scraping. It exposes three tools —
`list_pages`, `get_page`, `fit_brief` — over the same corpus and the same
deterministic matcher the site uses. No model runs on the server, so nothing it
returns is generated: every aligned claim cites one of your pages and quotes
text already on it.

`.well-known/mcp.json` and the `llms.txt` entry are written **only** on the
Cloudflare target, because advertising an endpoint that 404s is worse than
advertising none.

On GitHub Pages the agent-facing surface is still real, just static:
`llms.txt` indexes the site and `evidence.json` is the whole corpus as JSON —
id, title, canonical URL, full text and skills per page. Both ship identically
on either target, so an agent can always read your work; only the live scoring
call needs Functions.

## GitHub Pages

### The root-path requirement

Every asset is referenced absolutely (`/app.js`, `/styles.css`, `/assets/…`)
and the client router reads `window.location.pathname` directly. A project site
at `username.github.io/my-portfolio/` therefore 404s on every stylesheet and
script, and the router matches nothing. **The page loads blank.**

So the site must serve at the root, which means one of:

- the repository is named **`<username>.github.io`**, or
- **`deploy.custom_domain`** is set to a domain you own.

```bash
npm run pages:check
```

fails with both fixes spelled out if neither holds. It also fails if `origin`
disagrees with where the site will actually be served, because that quietly
points every canonical URL, the sitemap and every OG image at the wrong host.

It skips while `demo: true` — the template repo is not a deployment.

### Standing it up

```bash
npm run pages:setup -- --dry-run    # prints what it would do, changes nothing
npm run pages:setup
```

This enables Pages over the API with the workflow as the build source, so there
is no settings page to visit. It never prompts and never handles a credential:
if you are not signed in, it exits `2` and tells you to run `gh auth login`
yourself. You need the `repo` and `workflow` scopes — `workflow` because
pushing `.github/workflows/` requires it.

Then push to `main`. `.github/workflows/deploy-github-pages.yml` builds with
`PRERENDER_REQUIRED=1`, re-runs `config:check`, `seo:smoke`, `fit:smoke` and
`pages:check` against that exact commit, and publishes `dist/`.

The repository must be **public** for Pages on a free account. Your `content/`
YAML becomes world-readable.

### Custom domain

Set `deploy.custom_domain` and make `origin` the same host. The build emits
`dist/CNAME`. The DNS record is yours to add — an `ALIAS`/`ANAME` at the apex,
or a `CNAME` on a subdomain, pointing at `<username>.github.io`.

## Cloudflare Pages

See the [`/deploy-pages`](../../.claude/skills/deploy-pages/SKILL.md) skill —
what to edit, how to create the project, and how to verify the deploy is really
yours. Set `deploy.target: cloudflare-pages` first, so the build stops
injecting the meta CSP and lets `public/_headers` do the work.

Set `PRERENDER_REQUIRED=1` in the Pages build environment. Without it a build
on a machine with no browser silently produces an SPA-only site where every
route carries the home page's metadata.

## Moving between them

Change `deploy.target` and rebuild. Nothing else in `content/` changes. Going
to Cloudflare, update `origin` to the new host — `pages:check` only guards the
GitHub Pages side, so nothing else will catch a stale origin there.
