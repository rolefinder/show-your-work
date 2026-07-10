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
- Demo corpus is fictional (**Avery Quill**); never paste real portfolio YAML
  from a private dogfood site into this repo
- Browser CSP stays strict (`script-src 'self'`, `connect-src 'self'`); do not
  widen for third-party model CDNs in v1
- Fit `aligned` claims require ≥1 citation to published content

See `docs/strategy/recruit-me-security.md` and ADR 012 for the fuller surface map.
