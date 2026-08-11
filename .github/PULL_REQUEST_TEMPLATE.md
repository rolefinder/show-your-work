<!--
Building your own site should never need a PR here — that is docs/guide.
This template is for changing the template itself.
-->

## What changes, and why

<!-- The problem first. If it fixes an issue, "Fixes #123". -->

## How it was verified

<!--
`npm test` is the bar. If a gate could not run locally, say which and why —
Chromium missing means prerendering and ux:check silently skipped.
-->

- [ ] `npm test` passes locally
- [ ] Chromium installed, so prerendering and `ux:check` actually ran

## Checklist

- [ ] **No identity in code.** Nothing under `src/`, `functions/`, `graph/` or `public/` names a person
- [ ] **Nothing generated was hand-edited.** `src/generated/content.ts`, `dist/`, `functions/_lib/fit-engine.js`, `assets/graph-engine.js` come from their sources
- [ ] **Additive adoption holds.** No template file committed at a path an adopter is meant to add
- [ ] **Docs match.** If a number the docs quote changed, the prose changed too — `docs:check` enforces this
- [ ] **New third-party code is attributed** in `THIRD-PARTY-NOTICES.md`, if this vendors or bundles any
- [ ] **A decision, not just a change?** Add an ADR rather than editing an existing one
- [ ] Contributions are under the project's MIT license

<!--
If a gate failed and you changed the gate: say why the gate was wrong.
That is a legitimate PR, and it needs the argument in the description.
-->
