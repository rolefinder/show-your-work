```
██████╗ ███████╗ ██████╗██████╗ ██╗   ██╗██╗████████╗      ███╗   ███╗███████╗
██╔══██╗██╔════╝██╔════╝██╔══██╗██║   ██║██║╚══██╔══╝      ████╗ ████║██╔════╝
██████╔╝█████╗  ██║     ██████╔╝██║   ██║██║   ██║   █████╗██╔████╔██║█████╗
██╔══██╗██╔══╝  ██║     ██╔══██╗██║   ██║██║   ██║   ╚════╝██║╚██╔╝██║██╔══╝
██║  ██║███████╗╚██████╗██║  ██║╚██████╔╝██║   ██║         ██║ ╚═╝ ██║███████╗
╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝   ╚═╝         ╚═╝     ╚═╝╚══════╝
```

**A personal site that answers the recruiter's actual question.**
Paste a job description; get a brief where every aligned claim cites a page you
actually published, quoted from it. Nothing is asserted that isn't already
on the site.

Apache-2.0 · self-hosted React + WebGL graph, no CDN · strict CSP · every route
prerendered · no LLM anywhere in the matching path.

---

## The point

Most portfolios make a recruiter do the mapping. This one does it for them, and
refuses to bluff. Here is real output from the shipped demo corpus — not a
mockup:

```
[aligned]  Experience building CI/CD pipelines with GitHub Actions
     cites Fake Project: Merge Gate
     "Delivery runs through merge gates rather than trusting a green
      local build."

[aligned]  Strong YAML content pipeline experience
     cites Fake Project: Content Emit
     "Humans edit YAML and the build owns the emitted module, so a copy
      change can no longer break the application."
```

Three rules make that trustworthy:

- **`aligned` requires at least one citation.** No citation, no claim. Enforced
  in `fit-smoke`, not just intended.
- **Every quote is real text from a real page.** The matcher can only surface
  sentences that already exist in your `content/`, so a brief can't invent an
  employer, a date, or a metric.
- **It highlights, it does not audit.** By default the brief shows the
  requirements your published work covers and stays quiet about the rest — a
  portfolio is advocacy, not a self-assessment. The caveats say so, so it never
  reads as an exhaustive review while omitting rows. Set `show_gaps: true` in
  `content/config/fit.yaml` for the full audit, gaps included.

The matcher is deterministic keyword retrieval, not a model. It cannot
hallucinate an employer, a date, or a metric, because it can only quote text
that already exists in your `content/`.

## Quick start

```powershell
pip install --user pyyaml
npm ci
npx playwright install chromium   # enables prerendering
npm run test
npm run preview
```

Open <http://localhost:4173/fit> and paste a real JD.

While writing, use the authoring loop instead:

```powershell
npm run dev
```

Watches `content/`, `src/`, `tokens/` and rebuilds only what changed — about
2s for a content edit, versus ~23s for a full build. Prerendering is skipped
because it is a publish-time concern; run `npm run build` before deploying.

## Make it yours

```powershell
npm run init
```

Prompts for your identity and writes it into `content/`, swaps the demo
persona's Fit stop words for your name, clears the demo disclaimer, and turns
demo mode off. `--dry-run` shows the plan first, `--replace-content` also swaps
the corpus for starter files, `--config me.json` runs it unattended.
**It never touches `src/`.**

Then, in Claude Code:

```
/build-recruit-me
```

Preflights the config, optionally drafts project YAML from sources you name in
`content/config/sources.yaml` (GitHub repos, a resume) as reviewable
`visible: false` drafts, builds with prerendering, and verifies the artifact.
`npm run ready` runs just the preflight.

## What you get

| Route | What it is |
|-------|-----------|
| `/` `/about` | Who you are, with a contact strip built from `links` |
| `/work/<slug>` | A project page with a fixed editorial brief: problem, outcome, evidence, decisions |
| `/blog/<slug>` | Writing, cross-linked with `{{work:slug\|Label}}` tokens |
| `/graph` | A WebGL knowledge graph of projects, posts and skills — embedded as a lens on `/work` too |
| `/fit` | The brief above. Works offline in the browser; `POST /api/fit` optional |

## How a build runs

```
content/*.yaml
     |
     |  emit-content.py        typed module, slug/filename checked
     v
src/generated/content.ts ------+--> esbuild ------> dist/app.js
     |                         |
     |  scripts/lib/routes.ts  |    one route table, so sitemap, known-paths,
     |  (the single source)    |    prerender and cards cannot drift
     v                         v
emit-html  ->  emit-seo  ->  prerender-routes
  identity      sitemap        per-route <title>, canonical, OG,
  into HTML     robots         JSON-LD, and a 1200x630 social card
                llms.txt
```

## What's actually enforced

Every one of these fails the build, and each exists because it already caught
something real:

| Gate | Refuses to ship |
|------|-----------------|
| `corpus:check` | Real-person fingerprints in the demo corpus — and a demo persona that isn't obviously fake |
| `config:check` | Your name, email or title suffix hardcoded anywhere in `src/` |
| `style:check` | A raw color in the component layer, or a `var(--x)` that resolves to nothing |
| `fit:smoke` | An `aligned` requirement without a citation; a dequalifying verdict leaking into highlight mode; the browser and Worker evidence packs disagreeing |
| `seo:smoke` | A prerendered route missing its own canonical or JSON-LD |
| `csp:smoke` | Anything the page does that its own Content-Security-Policy forbids — this caught the skill-bank dots being silently stripped |
| `pages:check` | A GitHub Pages deploy that would land on a subpath and load blank |
| `content:check` | A cross-link that would 404; a missing required field; a skill spelled two ways |
| `check-ready` | Placeholder identity, an unreviewed draft, or a published `TODO` |

## Theming

Four variables at the top of [`tokens/colors.css`](./tokens/colors.css) drive
every color on the site:

```css
--rm-brand: #0f5c4c;      /* accent — links, focus ring, active state */
--rm-brand-deep: #083d33;
--rm-bg: #f7f4ef;         /* page background (light) */
--rm-fg: #1c1a17;         /* primary ink (light) */
```

Component rules never name a color. Dark mode follows `prefers-color-scheme`.
Contrast was measured, not assumed: every shipped text/background pair clears
WCAG AA (4.5:1) in both light and dark.

## Layout

The repository is arranged so that the directories you edit come first and the
engine stays out of your way. **If you only ever open `content/`, that is the
intended experience.**

### Yours

| Path | Role |
|------|------|
| `content/work\|blog/` | One YAML file per project or post. The bulk of your site |
| `content/about/profile.yaml` | Name, tagline, email, skills, and `links` keyed by platform |
| `content/config/site.yaml` | Deployment identity — origin, title suffix, theme colors, `demo:` |
| `content/config/skills.yaml` | Skill-bank grouping + descriptions |
| `content/config/fit.yaml` | Fit tuning — stops, synonyms, weights, extra caveats |
| `content/config/sources.yaml` | Optional: repos / resume for `/build-recruit-me` to draft from |
| `tokens/colors.css` | Four `--rm-*` variables that drive every color |

### The engine

| Path | Role |
|------|------|
| `src/` | The React app — `fit/` (matcher + UI), `graph/`, `search/`, `skills/` |
| `graph/` | The CSP-safe WebGL engine, bundled to a self-hosted file |
| `tokens/` + `styles.css` | Design tokens, then a component layer that reads only tokens |
| `scripts/` | The build, the emitters, and every gate below. `lib/routes.ts` is the single route table |
| `public/` | Web-root boilerplate — HTML templates, manifest, `_headers`, `_redirects`. Identity is injected into the copies in `dist/`, so **you never edit these** |
| `functions/` | Pages middleware (404 status + route docs) and optional `/api/fit` |
| `packages/` | The YAML→TypeScript emitter, and resume/GitHub ingest |
| `.claude/skills/` | `/build-recruit-me`, `/deploy-pages`, `/ui-review` — live in a fork with no install step |
| `docs/` | ADRs — the reasoning, including what was deliberately *not* built |

## Demo persona

**Fake Name**, with **Fake Project** / **Fake Post** content. Deliberately
unmistakable: every route ships prerendered `Person` JSON-LD, so a demo deploy
nobody customized must read as a placeholder rather than a plausible human.
`corpus:check` enforces that while `demo: true`, and turns itself off once the
corpus is yours.

## Docs

**Building your own site:** [`docs/guide`](./docs/guide/README.md) —
[setup](./docs/guide/setup.md) ·
[authoring](./docs/guide/authoring.md) ·
[theming](./docs/guide/theming.md) ·
[deploying](./docs/guide/deploy.md)

**Changing the template:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) has the
diagrams — the build pipeline, the request path at the edge, how Fit's two
implementations stay in sync, and an annotated directory tree.
[`CONTRIBUTING.md`](./CONTRIBUTING.md) covers the ground rules and what CI
runs; [`AGENTS.md`](./AGENTS.md) is the same contract for coding agents.

**Why it works this way:** [`docs/README.md`](./docs/README.md) indexes the
ADRs, including the options that were rejected. Worth reading first:
[015](./docs/architecture/adr/015-design-token-system.md) (design tokens),
[016](./docs/architecture/adr/016-adopter-config-boundary.md) (why identity is
data, never code),
[017](./docs/architecture/adr/017-prerender-and-editorial-contract.md)
(prerendering + the editorial contract).

## License

Apache-2.0 — see [LICENSE](./LICENSE). Contributing:
[CONTRIBUTING.md](./CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
· [SECURITY.md](./SECURITY.md).
