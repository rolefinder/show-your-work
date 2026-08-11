# ADR 022: MIT, and attribution for what we actually redistribute

**Status:** Accepted · 2026-08-11 · supersedes the license choice in
[recruit-me PRD §9](../../strategy/recruit-me-prd.md#9-license--fully-open-source-mit)


## Context

The project shipped under Apache-2.0, locked by a PRD decision on 2026-07-09.
The decision that mattered — **true open source, not source-available** — was
right and is unchanged. The choice *between permissive licenses* was made on
grounds that turn out not to describe this project.

Apache-2.0 was chosen for its express patent grant, its explicit trademark
non-grant, and because it is "common for infra / agent tooling adopters." Two
of those three assume a reader who is clearing a dependency for a legal team.
recruit-me's reader is a person deciding whether they are allowed to keep the
fork of a portfolio site they just built. For that reader, the 202-line license
is a cost with no matching benefit.

A second thing surfaced while checking this. `scripts/build-graph-vendor.mjs`
bundles graphology, graphology-layout-forceatlas2 and sigma — all MIT — into
the committed `assets/graph-engine.js`, and it did so with esbuild's
`legalComments: "none"`. Committing that file is redistribution, and MIT
requires the copyright notice to travel with it. Nothing in the tree carried
those notices. The vendored React files were fine — they keep their own
`@license` banner — but nothing said so anywhere a reader would look.

## Decision

### MIT

`LICENSE` is the MIT text, `Copyright (c) 2026 Harrison Halperin`. Every
commit to date is by that one author, so the relicense needed no third-party
consent; there is no contributor whose Apache-2.0 grant is being reinterpreted.

MIT is also what every third-party line in the tree already is. A project whose
entire dependency surface is MIT, shipping under a different license, made
adopters do a compatibility check that has no interesting answer.

**What was given up, honestly:** Apache-2.0's express patent grant, and its
explicit statement that the license conveys no trademark rights. MIT is silent
on both. For a static site generator whose one novel mechanism is deterministic
keyword retrieval, the patent exposure is small — but it is not zero, and it is
the reason to revisit this if recruit-me ever grows something worth patenting.
Trademark on the name `recruit-me` was always separate from the code license
(PRD §9) and is unaffected.

### `THIRD-PARTY-NOTICES.md`

One file, listing only what is **redistributed in-tree**: the vendored React
builds under `assets/vendor/`, and the three packages bundled into
`assets/graph-engine.js`. Build tooling — esbuild, TypeScript, tsx, Playwright,
the `@types/*` packages — is deliberately absent. It never reaches `dist/`, so
it is not redistributed, and listing it would make the file a dependency dump
that nobody maintains and nobody can use to answer a question.

> Rejected: **generating it from `package-lock.json`.** The generated file
> would be dominated by transitive build-time packages, which is exactly the
> set that does not need attribution. The distinction that matters —
> *does this ship to a browser* — is not in the lockfile.

### `legalComments: "eof"`

The graph bundle keeps any license banner its inputs carry, at the end of the
file. Today this changes nothing: the published graphology and sigma dists
carry no banners, and the rebuilt artifact is byte-identical. That is the
point. The setting is what makes the day one of them starts shipping a banner a
non-event, instead of a silent strip that nobody would notice.

## Consequences

- Reading the license is no longer a step in adopting the template.
- Attribution has a home, and `CONTRIBUTING.md` names it: vendoring or bundling
  third-party code into the tree updates `THIRD-PARTY-NOTICES.md` in the same
  PR. Nothing enforces that mechanically — it is a review habit, not a gate,
  because "was this file redistributed" is a judgement a script cannot make.
- No patent grant. Recorded here rather than discovered later.

### Documents that still say Apache-2.0

Left alone on purpose, per the repo's own rule that
[ADRs are records](../../README.md#decision-records) and
[`docs/history/`](../../history/README.md) is unmaintained by design:

| Where | Why it stays |
|---|---|
| [`docs/history/**`](../../history/README.md) | Unmaintained by design. It records what was true then |
| [ADR 015](./015-design-token-system.md) | Names "an Apache-2.0 repo" in passing. Rewriting an accepted ADR to match a later decision would make it lie about what was true when the decision was taken |

Live guidance *was* updated: PRD §9 carries a dated supersession note that
keeps the original rationale table, the Fit PRD's open-questions entry points
here, and `README.md` / `CONTRIBUTING.md` / `package.json` state MIT.
