# ADR 020: GitHub Pages as the default target, and what an agent may do alone

**Status:** Accepted · 2026-07-25

## Context

Standing up a show-your-work site required a Cloudflare account, a dashboard visit,
and a human clicking through project creation. Everything before that step was
already automatable — `init --config`, `check-ready`, `npm test` — so the
manual tail was the whole cost of adoption.

Two questions had to be answered together, because the answer to one constrains
the other: **which host**, and **how much may an agent do without asking**.

## Decision

### 1. GitHub Pages is the default target; Cloudflare stays

`deploy.target` in `content/config/site.yaml` selects between them. GitHub
Pages needs no account an adopter does not already have, and Pages can be
enabled entirely over the REST API — `POST /repos/{owner}/{repo}/pages` with
`build_type: workflow` — so there is no dashboard step to hand back to a human.

Cloudflare remains, because the difference is not convenience.

### 2. The security difference is stated, not smoothed over

**GitHub Pages cannot set HTTP response headers at all.** `public/_headers` is
inert there. The build injects the same policy as a
`<meta http-equiv="Content-Security-Policy">` immediately after `<meta charset>`
— position is load-bearing, since a meta CSP does not apply to anything above
it.

What that costs, precisely:

- `frame-ancestors` is invalid in a meta tag. X-Frame-Options is a header. So
  **clickjacking protection is gone**, with no meta equivalent.
- HSTS, COOP and CORP are headers only. Gone.
- `script-src`, `style-src`, `connect-src`, `object-src`, `base-uri`,
  `form-action` all survive, which is most of what matters for a static site
  with no inline script.

`deploy.target` fails the build on an unrecognized value rather than defaulting,
because a typo would otherwise silently pick a weaker security posture.

### 3. Root path only

Every asset is referenced absolutely and the client router reads
`window.location.pathname` raw, so a project site at `<owner>.github.io/<repo>/`
404s on every stylesheet and script and matches no route — it loads blank.

**Rejected: threading a base path** through the router, asset hrefs, canonical
URLs, sitemap, known-paths and the preview server. It is real work on six
surfaces, each a place a subtle break could hide, and it buys a URL shape
(`username.github.io/my-portfolio/`) that is worse for a portfolio than the one
it replaces. A personal site belongs at a root.

So the repository must be named `<owner>.github.io`, or `deploy.custom_domain`
must be set. `check-pages-target` enforces it in preflight *and* in the deploy
workflow, and also fails when `origin` disagrees with where the site will
actually be served — that mismatch silently points every canonical URL, the
sitemap and every OG image at the wrong host.

It skips while `demo: true`: the template repo is not a deployment, is
correctly named `show-your-work`, and correctly has `origin: https://example.com`.

### 4. One authorization gate, and no credential handling ever

`/launch` gathers identity in a single batched pass, builds, then states
exactly what it is about to do — repository name, visibility, push, enable
Pages — and takes **one** yes. After that it runs to a URL without further
prompts.

The boundary that does not move: **an agent never types a password, a token, or
a 2FA code.** `setup-github-pages.mjs` has no prompt path at all. It asks `gh`
whether the human already authenticated and, if not, exits `2` with the exact
command for them to run themselves. Exit `2` means "needs a human" and exit `1`
means "failed" — separated so an agent branches on the code instead of parsing
prose. `check-ready --json` exists for the same reason.

Repository visibility is called out in words at the gate rather than implied,
because Pages on a free account requires a public repository and that makes the
adopter's `content/` YAML world-readable.

## Consequences

- Adoption is: answer some questions, approve once, get a URL.
- Sites on GitHub Pages ship without clickjacking protection. Documented in
  `docs/guide/deploy.md`, in the config comments, and in `/launch`'s final
  report — three places, because it is the one thing a reader could reasonably
  have assumed was fine.
- Moving to Cloudflare is a `deploy.target` change and a rebuild.
- `pages:check` is in `npm test`, so an adopter learns about a subpath repo
  before they push rather than from a blank live page.
- The Fit Worker (`POST /api/fit`) is Cloudflare-only. Browser Fit, which is
  the path almost everyone takes, works on both.
