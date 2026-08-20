# Setup

## Prerequisites

| Need | Why | Check |
|---|---|---|
| **bun 1.2+** | Installs the dependencies and runs the four TypeScript build steps directly — which is why there is no `tsx` in `package.json`. `.bun-version` pins the version CI installs | `bun --version` |
| **Node 20+** | esbuild and Playwright both require 18+, and 18 is end-of-life. Every gate under `scripts/*.mjs` is a Node program. `.nvmrc` pins 22, which is what CI runs | `node --version` |
| **Python 3.9+** with PyYAML | The content emitter and three gates are Python. CI runs 3.12, which is the tested configuration | `python -c "import yaml"` |
| **Chromium via Playwright** | Prerendering and the UX audit both drive a real browser | `bunx playwright --version` |

```bash
bun install --frozen-lockfile
pip install --user pyyaml
bunx playwright install chromium
```

### The three things that actually go wrong

**`python3` is not `python` on Windows.** `python3` is the Microsoft Store
stub: it exists, satisfies `command -v`, and exits non-zero with an install
advert. `bun run ready` probes by *running* each interpreter rather than
looking it up on `PATH`, for exactly this reason. Use `python`.

**Playwright is optional, and that is the trap.** Without Chromium the build
still succeeds — it just produces an SPA-only `dist/`, so every route ships the
home page's `<title>`, canonical and JSON-LD, and a crawler that does not run
JavaScript sees one page. You get a warning, not an error. Set
`PRERENDER_REQUIRED=1` in CI and in your Pages build environment so a deploy
can never silently ship that way.

**PyYAML is not installed by `bun install`.** Two package managers, two install
steps. `bun run ready` exits `2` (distinct from a config problem) and names the
`pip` command if it is missing.

## First build

```bash
bun run build     # -> dist/
bun run preview   # http://localhost:4173
```

Open <http://localhost:4173/fit> and paste a real job description. What you are
looking at is the demo persona's corpus, so the brief will cite fake projects —
that is the point, it proves nothing is invented.

`bun run test` runs the same build plus every gate. Run it before you push.

## Make it yours

If you have Claude Code, **`/launch`** does everything from here to a live
URL: it asks for your details in one pass, builds, takes a single
authorization before anything goes public, and hands back the link. The rest
of this page is what it runs.

```bash
bun run init
```

Prompts for name, tagline, location, email, origin, summary, profile links and
an accent color. It writes `content/config/site.yaml` and
`content/about/profile.yaml`, replaces the demo persona's Fit stop words with
your name, clears the demo disclaimer, and sets `demo: false`.

| Flag | Effect |
|---|---|
| `--dry-run` | Print what would be created, write nothing |
| `--starter-content` | Also add example project and post files showing the editorial contract |
| `--config me.json` | Non-interactive; the JSON takes the same keys, plus a free-form `links` map |
| `--force` | Replace answers you already gave. Without it, init refuses to overwrite |

**It only creates files.** It does not edit `src/`, it does not edit `tokens/`,
and it does not touch `content/demo/`. If a setup step ever asks you to edit or
delete something the template ships, that is a bug in the template — see
[ADR 021](../architecture/adr/021-additive-only-adoption.md).

### Demo mode turns itself off

There is no flag. The site is a demo exactly while
`content/about/profile.yaml` has not been added — that file carries the name
and email on every page and in every JSON-LD `Person` block, so if it is still
the demo's, the deployment is a demo.

While it is, the site wears visible "this corpus is fictional" chrome.
`corpus:check` keeps `content/demo/` obviously fake forever; it never scans
what you add, because your corpus is *supposed* to name a real person.

## Is it ready?

```bash
bun run ready
```

Answers one question deterministically: is this config filled in, or is it
still the template? It reports placeholders and never fixes them — guessing
your identity is precisely what this project exists not to do.

| Exit | Meaning |
|---|---|
| `0` | Ready to build |
| `1` | Config still has placeholders, an unreviewed draft, or a published `TODO` — each one listed |
| `2` | A toolchain dependency is missing — a different problem, so a different code |

Then, in Claude Code, `/build-show-your-work` runs the preflight, optionally drafts
project YAML from the sources you name in `content/config/sources.yaml`, builds
with prerendering, and verifies the artifact.

## The authoring loop

Do not use `bun run build` while writing. Use:

```bash
bun run dev
```

It watches `content/`, `src/`, `tokens/` and `styles.css` and rebuilds only the
tier a change needs — roughly 2s for a content edit against ~23s for a full
build. Most of the saving is that prerendering is skipped: per-route documents
and social cards are a publish-time concern, not something you need while
writing a paragraph. Run `bun run build` before you deploy.
