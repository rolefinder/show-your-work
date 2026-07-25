# Security Policy

## Supported versions

Security fixes target the latest `main` of this template.

## Reporting a vulnerability

Email **harrison@quant-h2.com** with a description and reproduction steps.
Do not open a public issue for sensitive reports while the repo is private;
after a public flip, prefer coordinated disclosure.

## Baseline expectations

- No secrets, Cloudflare account IDs, API tokens, or real PII in the tree
- `wrangler.toml` with real bindings stays local / CI secrets — only
  `wrangler.example.toml` is committed
- Demo corpus is fictional and self-evidently so (**Fake Name**, `fake-*`
  slugs); never paste real portfolio YAML from a private dogfood site into
  this repo
- `npm run corpus:check` fails if `content/` contains real-person / employer
  fingerprints (Harrison, LPL, non-`example.*` emails, etc.)
- `npm run secrets:check` fails on high-signal credential patterns (AWS keys,
  GitHub PATs, private key blocks, etc.) — wired into `npm test` / CI
- Browser CSP stays strict (`script-src 'self'`, `connect-src 'self'`); do not
  widen for third-party model CDNs in v1
- Fit `aligned` claims require ≥1 citation to published content
- No production Cloudflare account IDs in-tree (`wrangler.example.toml` only)
- Graph vendor is self-hosted (`assets/graph-engine.js`); no CDN Sigma/Graphology

## Before flipping the repo public

Done in-tree:

- [x] Dependabot (npm + Actions)
- [x] CI `npm run test` (corpus + secrets + build + fit/graph smoke)
- [x] Strict CSP `_headers`
- [x] Fictional corpus gate
- [x] Local secret pattern scan (`scripts/check-secrets.py`)

Still needed (human / org):

- [ ] Enable **GitHub secret scanning** + push protection on the repo
- [ ] Optional: add [gitleaks](https://github.com/gitleaks/gitleaks) or
      TruffleHog as a dedicated workflow (local script is the baseline)
- [ ] Owner review that no real Cloudflare account IDs / tokens remain
- [ ] Confirm LICENSE + SECURITY contacts are correct for public disclosure
- [ ] **Do not** auto-flip visibility from an agent PR — owner action only

See the [security posture](docs/strategy/recruit-me-security.md) and
[ADR 012](docs/architecture/adr/012-recruiter-fit-security-data.md) for the
fuller surface map. The original gap list is kept, unmaintained, in
[docs/history](docs/history/SITE_OSS_GAP_LIST.md).
