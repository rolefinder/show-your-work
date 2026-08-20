# Building your site

Four steps, in order. Each page assumes the one before it.

1. **[Setup](./setup.md)** — prerequisites, your first build, and the three
   things that actually go wrong on a fresh machine.
2. **[Authoring](./authoring.md)** — the content model. What a project file
   holds, how cross-links work, and which fields Fit quotes to a recruiter.
3. **[Theming](./theming.md)** — four variables that drive every color, and
   what the build refuses to let you do.
4. **[Deploying](./deploy.md)** — GitHub Pages by default, Cloudflare Pages for
   real security headers, and an honest account of what differs.

Or skip all four: **`/launch`** in Claude Code asks for your details once, takes
one authorization before anything goes public, and hands back a live URL.

## The shape of the thing

Standing up your own site is an edit to `content/`. Not a fork with code
changes — an edit to YAML. The build reads it and writes everything else, and
`bun run config:check` fails if your name, email or title suffix appears
anywhere under `src/`, `functions/`, `graph/` or `public/`.

That constraint is the product. It is what makes it possible to pull upstream
changes into a site you have been running for a year.

## When something fails

Every gate in `bun run test` exists because it already caught something real, and
each prints what it found rather than just a status. Start with the message.

| It says | Read |
|---|---|
| `check-ready: NOT READY` | [Setup](./setup.md#is-it-ready) |
| `check-ready: MISSING DEPENDENCIES` | [Setup](./setup.md#prerequisites) |
| `check-content: FAILED` | [Authoring](./authoring.md#what-the-content-gate-checks) |
| `check-adopter-config: FAILED` | You edited code where you meant to edit `content/` — the message names the file and line |
| `check-style-tokens: FAILED` | [Theming](./theming.md#the-rule) |
| `check-ux: FAILED` | Run `/ui-review`; the finding is real and names a route, scheme and viewport |
| `check-pages-target: FAILED` | [Deploying](./deploy.md#the-root-path-requirement) — the site would land on a subpath and load blank |
| `pages:setup: NEEDS YOU` | Something only you can do. The message names the exact command |
| `csp:smoke: FAILED` | Something on the page violates its own CSP. Usually an inline `style=` attribute — use a class |
| `check-publication-safety: FAILED` | You are about to publish a term you guarded. Run `/sanitize` and rewrite the sentence |
