# Security Policy

## Supported versions

Security fixes target the latest `main` of this template.

## Reporting a vulnerability

Email **harrison@quant-h2.com** with a description and reproduction steps, or
open a private advisory through GitHub's **Report a vulnerability** button.
Please do not open a public issue for a sensitive report — coordinated
disclosure gives adopters a chance to pull the fix before the detail is
public.

## Does publishing the architecture help an attacker?

Worth answering directly, because it is the reason people keep portfolio code
private.

**Mostly no, and the parts where it matters are not fixed by hiding the code.**
A built site here is static files. There is no server process, no database, no
login, no session, no user data. An attacker reading `ARCHITECTURE.md` learns
how the build works; there is no running system behind it to pivot into. None
of the controls that matter — the CSP, the response headers, the deterministic
matcher that cannot be prompt-injected because it is not a model — get weaker
when the source is readable. A control that only works while the source is
secret was never a control.

The surface that *is* real, and what bounds it:

| Surface | Bound |
|---|---|
| `POST /api/fit`, `POST /api/mcp` | The only code that runs per request, and only on the Cloudflare target. Both unauthenticated **by design** — the corpus is the published site — and both charged against **one shared daily quota**, so neither is a way around the other |
| Input | 12,000-char job description, 64 KB body. The JD reaches a keyword matcher and nothing else: no model, no shell, no query, no filesystem |
| Secrets | Neither Function reads any. No bindings beyond the optional quota counter, which stores a hashed IP and an integer |
| Your content | The template cannot know what is confidential in *your* writing. `publication:check` enforces a list you declare; `/sanitize` helps you build it |
| Your account | **The actual risk.** Cloudflare and GitHub credentials, token scope, 2FA, and who can push to `main` |

The honest summary: the code being public is close to irrelevant to your
security posture. Your hosting account, your tokens, and what you choose to
write in `content/` are where the risk lives, and they are unaffected by
whether anyone can read `src/`.

## Baseline expectations

- No secrets, Cloudflare account IDs, API tokens, or real PII in the tree
- `wrangler.toml` with real bindings stays local / CI secrets — only
  `wrangler.example.toml` is committed
- Demo corpus is fictional and self-evidently so (**Fake Name**, `fake-*`
  slugs); never paste real portfolio YAML from a private dogfood site into
  this repo
- `npm run corpus:check` fails if `content/demo/` contains real-person or
  employer fingerprints. The patterns are derived from your own
  `content/about/profile.yaml` plus anything you list in
  `content/config/corpus-guard.yaml`; no names are hardcoded in the source
- `npm run secrets:check` fails on high-signal credential patterns (AWS keys,
  GitHub PATs, private key blocks, etc.) — wired into `npm test` / CI
- Browser CSP stays strict (`script-src 'self'`, `connect-src 'self'`); do not
  widen for third-party model CDNs in v1
- Fit `aligned` claims require ≥1 citation to published content
- No production Cloudflare account IDs in-tree (`wrangler.example.toml` only)
- Graph vendor is self-hosted (`assets/graph-engine.js`); no CDN Sigma/Graphology

## Release hardening

Enforced in-tree, on every PR:

- [x] Dependabot (npm + Actions)
- [x] CI `npm run test` (corpus + secrets + build + fit/graph smoke)
- [x] Strict CSP `_headers`
- [x] Fictional corpus gate
- [x] Local secret pattern scan (`scripts/check-secrets.py`)
- [x] Publication-safety gate (`publication:check`) over content *and* `dist/`

Repository settings, which no gate in here can assert:

- [ ] **GitHub secret scanning + push protection** enabled
- [ ] Optional: [gitleaks](https://github.com/gitleaks/gitleaks) or TruffleHog
      as a dedicated workflow — the local script is the baseline, not the ceiling
- [ ] Visibility changes are an owner action. **Never** flip a repo public from
      an agent PR

See the [security posture](docs/strategy/show-your-work-security.md) and
[ADR 012](docs/architecture/adr/012-recruiter-fit-security-data.md) for the
fuller surface map.
