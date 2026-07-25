# Stand up a recruit-me site on Cloudflare Pages

## When to use

Standing up a new adopter site from this template — going from a fork to a
deployed site under your own name.

## What you edit (and what you never edit)

Everything that identifies your deployment lives in `content/`. The build
reads it and writes the rest. If a step below asks you to edit a file under
`src/`, `index.html`, or `manifest.json`, that is a bug in the template —
`npm run config:check` exists to fail the build when identity leaks into code.

| Edit | Holds |
|------|-------|
| `content/config/site.yaml` | Origin, title suffix, description, theme colors, `demo:` flag |
| `content/about/profile.yaml` | Name, tagline, location, email, skills, `links` map |
| `content/config/sources.yaml` | Optional: repos / resume for `/build-recruit-me` to draft from |
| `content/work/*.yaml` | One file per project |
| `content/blog/*.yaml` | One file per post |
| `content/config/skills.yaml` | Skill-bank category grouping |
| `content/config/fit.yaml` | Fit tuning: stop words, synonyms, weights, extra caveats |
| `tokens/colors.css` (4 `--rm-*` vars) | Palette, if you want a different one |
| `assets/icon.svg` | Favicon / manifest icon |

## Steps

1. **Fork or copy the template**, then `npm ci`.
2. **Run the scaffolder.**

   ```bash
   npm run init
   ```

   It asks for your name, tagline, location, email, site origin, summary,
   profile links, and an accent color, then writes
   `content/config/site.yaml` and `content/about/profile.yaml`, replaces the
   demo persona's Fit stop words with your name tokens, clears the demo
   disclaimer, and sets `demo: false`. Add `--replace-content` to also swap the
   demo corpus for starter files that show the editorial contract, or
   `--dry-run` to see the plan first. Scriptable with
   `npm run init -- --config me.json`.

   `corpus:check` guards the *demo* corpus against real-person fingerprints and
   turns itself off once `demo: false` — your corpus is supposed to name a real
   person.
3. **Write your content**: one file per project in `content/work/`, one per
   post in `content/blog/`, and your real skills in
   `content/about/profile.yaml`. Fill each project's `outcome` and `evidence` —
   that is what Fit quotes to a recruiter.
4. **Enable prerendering** (strongly recommended — without it, per-route
   metadata is invisible to crawlers that don't run JS):

   ```bash
   npx playwright install chromium
   ```
5. **Build.** `npm run build` — output is `dist/`. `npm test` runs the same
   build plus every gate.
6. **Create the Pages project** pointing at `dist/` (direct upload), or connect
   the repo with build command `npm ci && npm run build` and output directory
   `dist`. Set `PRERENDER_REQUIRED=1` in the build environment so a deploy can
   never silently ship without prerendered documents.
7. **Optional:** bind KV `FIT_QUOTA` for `/api/fit` (see
   `wrangler.example.toml`). The browser Fit path works without it.
8. **Never commit real account IDs** — keep secrets in the dashboard / CI.

## Verify

- `npm test` green, including `config:check` (no identity in code) and
  `style:check` (no raw colors in the component layer).
- `dist/index.html` `<title>` and `og:*` show **your** name, not the
  placeholder — that is `scripts/emit-html.ts` having run.
- `dist/work/<slug>.html` exists and its `<title>` and `<link rel="canonical">`
  are that project's, not the home page's — that is prerendering having run.
  `seo-smoke` enforces this once any route is prerendered.
- `dist/llms.txt` lists your work and writing.
- Homepage, `/work/<slug>`, `/blog/<slug>`, `/fit` deep links resolve (SPA 200).
- A Fit brief's caveats have no demo disclaimer, and an aligned requirement
  cites a whole sentence from a project's `outcome`/`evidence` rather than a
  bare skill tag.
- Browser console shows no CSP violations for self-hosted React + `app.js`.
- `POST /api/fit` only if Functions are enabled; browser Fit works without it.

## Known gaps

Template limitations, not setup mistakes:

- **The knowledge graph is its own page** (`/graph`) rather than an embedded
  lens on home and work.
- **No infrastructure-as-code.** The Pages project and custom domain are set
  up in the Cloudflare dashboard; there is no Terraform in this repo.
- **No LinkedIn import.** `packages/ingest/` drafts YAML from a resume or a
  GitHub username for human review; the official-export parser isn't built.
