# Privacy

Two audiences, and they need different things from this file.

- **Visitors to a site built from this template** — what the site does with
  what you type into it. That is [What the site collects](#what-the-site-collects).
- **Adopters deploying it** — the notice you are publishing on your own behalf,
  and the short list of changes that make it stop being true.
  That is [If you are the adopter](#if-you-are-the-adopter).

This is a description of how the software behaves, written from its source. It is
not legal advice. If you deploy this under a company's name, or to visitors in
the EU or UK, have counsel read it first — see [Where this stops](#where-this-stops).

## What the site collects

**In the default build: nothing.** Not "nothing important" — no collection
mechanism ships in the template at all.

- **No analytics.** No Google Analytics, no Plausible, no PostHog, no
  self-hosted beacon. No pageview is recorded anywhere by this code.
- **No cookies, and no tracking storage.** The template sets no cookie and
  writes no identifier to `localStorage` or `sessionStorage`.
- **No third-party requests.** Every asset — scripts, styles, fonts, the WebGL
  graph vendor bundle — is served from the site's own origin. No CDN, no
  third-party font provider. A strict Content-Security-Policy enforces this
  rather than leaving it to good intentions, and `bun run csp:smoke` checks it.
- **No accounts, no sign-in, no uploads, no payments.** There is nothing to log
  into and no file storage.
- **No AI, and no LLM call.** The Fit matcher is deterministic text matching
  over a prebuilt evidence pack. Nothing you type is sent to a model.

### The job description you paste into `/fit`

This is the only place a visitor types something substantial, so it is worth
being exact.

**It stays in your browser.** Pressing *Run Fit* runs the matcher on the page
itself, against an evidence pack the site already downloaded as a static file.
The job description is never sent to the server, never written to disk, and
never logged. Close the tab and it is gone. Nothing about it is retained,
because it never arrives anywhere that could retain it.

That matters because a JD often contains more than a public posting: an
unannounced role, a hiring manager's name, salary bands, or a candidate's
details. None of it reaches the site's operator.

### Ordinary web-server logs

The site is static files served over HTTPS, so whoever hosts it — Cloudflare
Pages, GitHub Pages, or another host — keeps the usual access logs: IP address,
user agent, requested path, timestamp. That is the host's logging, under the
host's retention, not something this template collects or controls. It records
that a page was requested; it never contains a pasted job description, because
the JD is never in a request.

## If you are the adopter

You publish this notice, so you are the one who has to keep it true. It is true
of the template as it ships. Three changes would make it false, and the first
one is the one people actually hit.

**1. Enabling the optional `/api/fit` Pages Function.** The template ships
`functions/api/fit.ts`, which is **not** used by the site's own UI — the browser
path always matches locally. If you route traffic to it, job descriptions start
being POSTed to your server. Its current handler stores no JD (it keeps only a
per-day counter in KV for a 2/day quota, expiring in 48 hours), so the truthful
notice becomes "sent to our server, matched, and discarded, not stored." If you
add a retention store, request logging that captures bodies, or PDF upload — all
contemplated in
[`docs/architecture/adr/012-recruiter-fit-security-data.md`](docs/architecture/adr/012-recruiter-fit-security-data.md)
— then you are storing other people's data and this notice needs rewriting, not
patching. The in-page notice on `/fit` needs updating too: it currently promises
the JD stays in the tab.

**2. Adding analytics.** Any tag, beacon, or hosted analytics script makes the
"no analytics / no cookies / no third-party requests" claims false at once, and
in most cases adds a consent obligation. You will also have to widen the CSP to
let it load, which is a useful moment to stop and reconsider.

**3. Adding a contact form, mailing list, or comments.** Each one is a new
collection point that needs describing here.

**Keep this file reachable.** A privacy notice nobody can find does not do the
job. Link it from your site's footer, or paste its content into a page of your
own — adoption here is additive, so add a route rather than editing template
files (`bun run additive:check`).

**Before publishing, run `/sanitize`.** Your own content is the likelier
liability: an employer's internal codename or client name in a project write-up
is a confidentiality problem this file cannot help with.

## Where this stops

- **This is a factual description of the code, not a lawyer-drafted policy.**
  For a personal portfolio collecting nothing, that is usually proportionate.
  For a company deployment, or once you enable any of the three changes above,
  get it reviewed.
- **It says nothing about GDPR or UK data protection.** Serving EU or UK
  visitors brings obligations — lawful basis, a controller identity and contact
  point, data-subject rights, and a consent mechanism before any non-essential
  storage loads — that this notice does not attempt to satisfy. The default
  build collecting nothing puts you in a good starting position, not a compliant
  one.
- **Your host has its own policy.** Cloudflare's or GitHub's log handling is
  theirs, and worth linking alongside this file.

## Reporting a problem

Privacy or security concerns with the template itself:
see [`SECURITY.md`](SECURITY.md). Concerns about a specific deployed site go to
whoever runs it — not to this repository.
