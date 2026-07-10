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
- `npm run corpus:check` fails if `content/` contains real-person / employer
  fingerprints (Harrison, LPL, non-`example.*` emails, etc.)
- Browser CSP stays strict (`script-src 'self'`, `connect-src 'self'`); do not
  widen for third-party model CDNs in v1
- Fit `aligned` claims require ≥1 citation to published content
- No production Cloudflare account IDs in-tree (`wrangler.example.toml` only)

See `docs/strategy/recruit-me-security.md`, ADR 012, and
`docs/architecture/SITE_OSS_GAP_LIST.md` for the fuller surface map + remaining gaps.
