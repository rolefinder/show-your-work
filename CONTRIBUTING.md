# Contributing

Thanks for interest in **recruit-me**.

## Ground rules

1. **Apache-2.0** — contributions are under the same license.
2. **Demo data stays fictional** — Avery Quill only; no real personal bios.
3. **CSP first** — no CDN React, no browser calls to model hosts.
4. **Fit contract** — `aligned` requires ≥1 citation; keep the JSON shape stable.
5. Prefer small, verifiable PRs over large speculative refactors.

## Dev loop

```powershell
pip install --user pyyaml
npm ci
npm run test
npm run preview
```

Edit YAML under `content/`, then rebuild. Do not hand-edit blocks between
`/* BEGIN … */` markers unless you understand `scripts/emit-content.py`.

## Branching

Short-lived `feat/`, `fix/`, `docs/`, `chore/` branches from `main`.
Squash-merge preferred.
