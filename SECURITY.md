# Security Policy

## Supported versions

Security fixes target the latest `main` of this template.

## Reporting a vulnerability

Email **harrison@quant-h2.com** with a description and reproduction steps, or
open a private advisory through GitHub's **Report a vulnerability** button.
Please do not open a public issue for a sensitive report — coordinated
disclosure gives adopters a chance to pull the fix before the detail is
public.

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
