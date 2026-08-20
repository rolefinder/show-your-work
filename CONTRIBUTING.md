# Contributing

Thanks for your interest in **recruit-me**.

If you are here to *use* the template rather than change it, you want
[docs/guide](./docs/guide/README.md) instead — building your own site should
never require touching this repository's code.

## Setup

```bash
bun install --frozen-lockfile
pip install --user pyyaml
bunx playwright install chromium
```

bun 1.2+ (`.bun-version` pins what CI installs), Node 20+ (`.nvmrc` pins 22,
which is what CI runs) and Python 3.9+.
Full detail, including the three things that go wrong on a fresh machine, is in
[docs/guide/setup.md](./docs/guide/setup.md).

```bash
bun run dev     # authoring loop, ~2s rebuilds
bun run test    # every gate — run this before you push
```

## Ground rules

1. **MIT.** Contributions are under the same license. If a change vendors or
   bundles third-party code into the tree, add it to
   [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md) in the same PR.
2. **The demo persona must be self-evidently fake.** `corpus:check` requires
   `fake` in the persona name and in every demo slug, and rejects real-person
   and employer fingerprints. This is not fussiness: every route ships
   prerendered `Person` JSON-LD, so a demo deploy nobody customized would
   publish structured data asserting that a plausible-sounding human exists. A
   name like `Fake Name` fails loudly; a name like `Avery Quill` fails
   plausibly.
3. **CSP first.** No CDN React, no browser calls to model hosts. The graph
   engine is vendored and self-hosted for this reason.
4. **The Fit contract.** `aligned` requires at least one citation, and every
   quote must be real text from a published page. `fit-smoke` enforces both,
   plus the equality of the browser and Worker evidence packs. Keep the JSON
   shape stable.
5. **Identity is data.** Nothing that names a person belongs under `src/`,
   `functions/`, `graph/` or `public/`. `config:check` reads the current
   identity out of the generated module and fails if it appears in code —
   see [ADR 016](./docs/architecture/adr/016-adopter-config-boundary.md).
6. Prefer small, verifiable PRs over large speculative refactors.

## One fact, one reader

This repo has shipped the same bug four times: some fact acquired a second
reader, the two drifted, and the disagreement was invisible until it caused
damage.

| The fact | The two readers | What it did |
|---|---|---|
| "is this still the template?" | the deploy workflow's `grep` vs `check-pages-target`'s parser | `demo: "true"`, `demo: True` and a trailing `# comment` evaded the grep — the workflow would have deployed a placeholder site while the root-path check inside it skipped |
| "is this the demo persona?" | `check-ready`'s `/fake/` vs `corpus:check`'s `fake` substring | `Fakeperson Doe` satisfied one and evaded the other |
| a YAML scalar | `check-ready`'s regex vs `check-pages-target`'s | one stripped inline comments, one did not, so both gates read `origin` differently |
| the Fit evidence pack | `src/fit/evidence.ts` vs `scripts/emit-evidence.py` | **nothing** — `fit-smoke` asserts the two are equal |

The fourth is the only one that never bit, and the reason is the rule:

1. **Prefer one implementation.** Node-side YAML scalars come from
   `scripts/lib/yaml-lite.mjs`. A workflow that needs a decision the code
   already makes calls the code (`check-pages-target.mjs --deploy-guard`), it
   does not re-derive it in bash.
2. **When a second implementation is genuinely unavoidable** — the emitters are
   Python, the preflight is Node, and neither can call the other cheaply —
   **a test asserts the two agree.** `parity:check` does this for the content
   resolvers across seven adopter states; `fit-smoke` does it for the evidence
   packs.
3. **Never encode the same concept as two patterns.** If you are about to write
   a regex for something another file already recognises, read that file's
   value instead. `check-ready` compares against
   `content/demo/about/profile.yaml` rather than matching for "fake".

If `parity:check` fails, fix the divergence. Do not adjust the test to match.

## Things that are generated

Do not hand-edit these; edit their source and rebuild.

| Generated | From |
|---|---|
| `src/generated/content.ts` | `content/**.yaml`, via `scripts/emit-content.py` |
| `dist/**` | the whole build |
| `functions/_lib/fit-engine.js` | `src/fit/match.ts`, via `build-fit-worker.mjs` |
| `assets/graph-engine.js` | `graph/*.mjs`, via `build-graph-vendor.mjs` |
| `public/*` **in `dist/`** | the templates in `public/`, with identity injected |

## What CI runs

`bun run test` — fourteen gates around one full build, in this order:

```
additive:check -> parity:check -> corpus:check -> content:check -> secrets:check -> style:check
  -> build
  -> config:check -> publication:check -> pages:check -> fit:smoke -> graph:smoke -> seo:smoke
  -> csp:smoke -> ux:check
```

`publication:check` runs *after* `build` on purpose: it reads `dist/`, so on a
clean checkout it has nothing to scan until the build has produced one.

Note `bun run test`, not `bun test` — the latter is bun's own test runner,
which matches no files here and exits 0 without running a single gate.

plus a `lint` job: every script parses, content YAML parses, documented numbers
still match source (`docs:check`), and every relative doc link resolves
(`docs:links`).

Each gate exists because it already caught something real, and each names what
it found rather than just failing. If one blocks you, the message is the
starting point — see the table in
[docs/guide](./docs/guide/README.md#when-something-fails).

## Docs

- **ADRs are records.** Add a new one rather than rewriting an old one to match
  a later decision. `docs/architecture/adr/`.
- **`docs/history/` is unmaintained** by design. Do not update it to match
  current reality; that is what makes it history.
- If you change a number the docs quote — a Fit weight, a search score, an
  input cap — `docs:check` will fail until the prose is updated too.

## Branching

Short-lived `feat/`, `fix/`, `docs/`, `chore/`, `refactor/` branches from
`main`. Squash-merge. Never merge with red checks.
