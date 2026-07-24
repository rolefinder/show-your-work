# recruit-me

Open-source (Apache-2.0) personal portfolio **site template** + recruiter **Fit**
surface: paste a job description → cite-or-missing evidence brief against your
published `/work` and `/blog`.

Demo persona: fictional **Avery Quill** (not a real person).

## Quick start

```powershell
pip install --user pyyaml
npm ci
npx playwright install chromium   # enables prerendering
npm run test
npm run preview
```

Open http://localhost:4173/fit and paste a sample JD.

## Make it yours

```powershell
npm run init
```

One pass: writes your identity into `content/config/site.yaml` and
`content/about/profile.yaml`, swaps the demo persona's Fit stop words for
yours, clears the demo disclaimer, and turns demo mode off. `--replace-content`
also swaps the demo corpus for starter files; `--dry-run` shows the plan;
`--config me.json` runs it non-interactively. It never touches `src/`.

## Layout

| Path | Role |
|------|------|
| `content/about\|work\|blog/` | Adopter-owned YAML |
| `content/config/site.yaml` | Deployment identity — origin, title suffix, theme colors, `demo:` |
| `content/config/skills.yaml` | Skill-bank category map (tenant) |
| `content/config/fit.yaml` | Fit tuning — stops, synonyms, weights, extra caveats |
| `scripts/emit-content.py` | Splices typed blocks into `src/app.tsx` |
| `src/fit/` | Deterministic Fit matcher + UI |
| `src/skills/` | Skill-bank UI + `?skill=` filter |
| `graph/` + `src/graph/` | CSP-safe WebGL engine + KG builder (`/graph`) |
| `tokens/` | Design tokens — colors (light/dark), type, spacing, effects, base reset |
| `styles.css` | Component layer; reads tokens only, no literals |
| `functions/api/fit.ts` | Optional same-origin `POST /api/fit` |
| `docs/` | PRDs, ADRs, security, handoff |

## Adopting it

Standing up your own site is a `content/` edit, never a code change — see
[`skills/infra-pages/SKILL.md`](./skills/infra-pages/SKILL.md) for the full
runbook and [ADR 016](./docs/architecture/adr/016-adopter-config-boundary.md)
for why the boundary is drawn there. `npm run config:check` fails the build if
your identity leaks into `src/`.

Every route is prerendered to its own HTML with per-route title, canonical,
OG tags, JSON-LD and a generated social card, so crawlers and link unfurls see
real content without running JS ([ADR 017](./docs/architecture/adr/017-prerender-and-editorial-contract.md)).

## Theming

Every color on the site derives from four variables at the top of
[`tokens/colors.css`](./tokens/colors.css):

```css
--rm-brand: #0f5c4c;      /* accent — links, focus ring, active state */
--rm-brand-deep: #083d33;
--rm-bg: #f7f4ef;         /* page background (light) */
--rm-fg: #1c1a17;         /* primary ink (light) */
```

Change those and the whole site re-themes — component rules never name a
color. Dark mode follows `prefers-color-scheme` automatically. `npm run
style:check` fails the build if a literal color creeps into `styles.css`
or a `var(--x)` stops resolving. See
[ADR 015](./docs/architecture/adr/015-design-token-system.md).

## License

Apache-2.0 — see [LICENSE](./LICENSE).

## Handoff

See [HANDOFF.md](./HANDOFF.md) for product decisions and next slices.
