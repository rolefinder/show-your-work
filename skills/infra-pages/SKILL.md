# Cloudflare Pages free-tier standup for recruit-me

## When to use

Standing up a new adopter site from this template on Cloudflare Pages.

## Steps

1. Fork or copy the template; replace `content/**` with your YAML (not Avery Quill).
2. `npm ci && npm run build` — output is `dist/`.
3. Create a Pages project pointing at `dist/` (direct upload) or connect the repo
   with build command `npm ci && npm run build` and output directory `dist`.
4. Confirm `_headers` CSP and `_redirects` SPA fallback ship with the deploy.
5. Optional: bind KV `FIT_QUOTA` for `/api/fit` (see `wrangler.example.toml`).
6. Never commit real account IDs — keep secrets in the dashboard / CI.

## Verify

- Homepage, `/work/<slug>`, `/blog/<slug>`, `/fit` deep links resolve (SPA 200).
- Browser console shows no CSP violations for self-hosted React + `app.js`.
- `POST /api/fit` only if Functions are enabled; browser Fit works offline without it.
