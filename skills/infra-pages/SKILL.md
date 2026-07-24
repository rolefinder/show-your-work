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
| `content/about/profile.yaml` | Name, tagline, location, email, skills, contact links |
| `content/work/*.yaml` | One file per project |
| `content/blog/*.yaml` | One file per post |
| `content/config/skills.yaml` | Skill-bank category grouping |
| `content/config/fit.yaml` | Fit tuning: stop words, synonyms, weights, extra caveats |
| `tokens/colors.css` (4 `--rm-*` vars) | Palette, if you want a different one |
| `assets/icon.svg` | Favicon / manifest icon |

## Steps

1. **Fork or copy the template.**
2. **Replace the demo corpus.** Delete `content/work/*.yaml` and
   `content/blog/*.yaml`, write your own, and rewrite
   `content/about/profile.yaml`. `npm run corpus:check` blocks real-person
   fingerprints in the *demo* corpus — once it is your corpus, that gate's
   `FORBIDDEN` list in `scripts/check-fictional-corpus.py` is yours to empty.
3. **Set your identity** in `content/config/site.yaml`: real `origin`,
   `title_suffix`, `description`, `short_name`, and **`demo: false`**.
4. **Clear the demo disclaimer**: empty `extraCaveats` in
   `content/config/fit.yaml`, or every Fit brief you show a recruiter will say
   your corpus is fictional.
5. **Build.** `npm ci && npm run build` — output is `dist/`.
   `npm test` runs the same build plus every gate.
6. **Create the Pages project** pointing at `dist/` (direct upload), or connect
   the repo with build command `npm ci && npm run build` and output directory
   `dist`.
7. **Optional:** bind KV `FIT_QUOTA` for `/api/fit` (see
   `wrangler.example.toml`). The browser Fit path works without it.
8. **Never commit real account IDs** — keep secrets in the dashboard / CI.

## Verify

- `npm test` green, including `config:check` (no identity in code) and
  `style:check` (no raw colors in the component layer).
- `dist/index.html` `<title>` and `og:*` show **your** name, not the
  placeholder — that is `scripts/emit-html.ts` having run.
- Homepage, `/work/<slug>`, `/blog/<slug>`, `/fit` deep links resolve (SPA 200).
- A Fit brief's caveat list has no demo disclaimer once step 4 is done.
- Browser console shows no CSP violations for self-hosted React + `app.js`.
- `POST /api/fit` only if Functions are enabled; browser Fit works without it.

## Known gaps (as of ADR 015/016)

These are template limitations, not setup mistakes:

- **No prerendering.** Per-route `<title>`/description/canonical are set by
  the client, so a crawler that doesn't execute JS sees only the home shell
  (ADR 014). `dist/index.html` metadata *is* real and static; the other routes
  are not.
- **No JSON-LD.** A `Person` entity has to be authored for a real identity;
  the template ships none.
- **Work pages have no structured outcome/evidence fields**, so Fit cites
  prose rather than claims.
