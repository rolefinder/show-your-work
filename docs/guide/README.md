# Building your site

Four steps, in order. Each page assumes the one before it.

1. **[Setup](./setup.md)** — prerequisites, your first build, and the three
   things that actually go wrong on a fresh machine.
2. **[Authoring](./authoring.md)** — the content model. What a project file
   holds, how cross-links work, and which fields Fit quotes to a recruiter.
3. **[Theming](./theming.md)** — four variables that drive every color, and
   what the build refuses to let you do.
4. **Deploying** — see the [`/deploy-pages`](../../.claude/skills/deploy-pages/SKILL.md)
   skill. It is ordinary markdown and reads fine on its own; keeping it in one
   place means the steps an agent follows and the steps you follow cannot
   drift apart.

## The shape of the thing

Standing up your own site is an edit to `content/`. Not a fork with code
changes — an edit to YAML. The build reads it and writes everything else, and
`npm run config:check` fails if your name, email or title suffix appears
anywhere under `src/`, `functions/`, `graph/` or `public/`.

That constraint is the product. It is what makes it possible to pull upstream
changes into a site you have been running for a year.

## When something fails

Every gate in `npm test` exists because it already caught something real, and
each prints what it found rather than just a status. Start with the message.

| It says | Read |
|---|---|
| `check-ready: NOT READY` | [Setup](./setup.md#is-it-ready) |
| `check-ready: MISSING DEPENDENCIES` | [Setup](./setup.md#prerequisites) |
| `check-content: FAILED` | [Authoring](./authoring.md#what-the-content-gate-checks) |
| `check-adopter-config: FAILED` | You edited code where you meant to edit `content/` — the message names the file and line |
| `check-style-tokens: FAILED` | [Theming](./theming.md#the-rule) |
| `check-ux: FAILED` | Run `/ui-review`; the finding is real and names a route, scheme and viewport |
