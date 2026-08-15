# Documentation

## I want to build my site

Start here: **[Building your site](./guide/README.md)** —
[setup](./guide/setup.md) · [authoring](./guide/authoring.md) ·
[theming](./guide/theming.md) · [deploying](./guide/deploy.md)

## I want to understand or change the code

- [**ARCHITECTURE.md**](../ARCHITECTURE.md) — the build pipeline, the request
  path at the edge, how Fit's two implementations stay in sync, and an
  annotated directory tree
- [Package boundaries](architecture/PACKAGE_BOUNDARIES.md) — what owns what, so
  a future split stays honest

### Decision records

Why things are the way they are, **including the options that were rejected**.
Read 015–017 first; they cover most of what you would otherwise have to infer.

| ADR | Decision |
|---|---|
| [010](architecture/adr/010-recruiter-fit-architecture.md) | Fit architecture — deterministic retrieval, no model in the matching path |
| [011](architecture/adr/011-recruiter-fit-quota.md) | Fit quota |
| [012](architecture/adr/012-recruiter-fit-security-data.md) | Fit security and data handling |
| [013](architecture/adr/013-csp-graph-opts-forces.md) | Self-hosted graph engine under a strict CSP |
| [014](architecture/adr/014-seo-aeo-baseline.md) | SEO/AEO baseline |
| [015](architecture/adr/015-design-token-system.md) | **Design token system** — the four adopter variables |
| [016](architecture/adr/016-adopter-config-boundary.md) | **Adopter-config boundary** — why identity is data, never code |
| [017](architecture/adr/017-prerender-and-editorial-contract.md) | **Prerendering, the editorial contract, one-command setup** |
| [018](architecture/adr/018-build-command-and-source-drafting.md) | `/build-recruit-me` and source drafting |
| [019](architecture/adr/019-fit-highlight-mode.md) | Fit is a highlight, not an audit |
| [020](architecture/adr/020-github-pages-target-and-agent-autonomy.md) | **GitHub Pages as the default target**, and what an agent may do alone |
| [021](architecture/adr/021-additive-only-adoption.md) | **Adoption is additive** — you add files, you never edit or delete them |
| [022](architecture/adr/022-mit-license-and-third-party-notices.md) | MIT, and attribution for what is actually redistributed |

> ADRs are dated records. Some name file paths from the layout at the time of
> the decision — the HTML templates moved into `public/`, for instance. The
> current tree is in [ARCHITECTURE.md](../ARCHITECTURE.md); where they
> disagree, the code wins. Rewriting an ADR to match a later layout would make
> it lie about what was true when the decision was taken.

## I want to run it in production

- [Bot and cost protection](ops/bot-and-cost-protection.md)
- [SEO visibility checklist](ops/seo-visibility-checklist.md)
- [Security policy](../SECURITY.md), and the fuller
  [security posture](strategy/recruit-me-security.md)

## I want to know why this exists

- [recruit-me PRD](strategy/recruit-me-prd.md) — the product
- [Recruiter Fit PRD](strategy/recruiter-fit-prd.md) — the module
- [Platform review, 2026-07](strategy/platform-review-2026-07.md) —
  standardization and adopter-UX findings, each with a repro
- [Design review, 2026-08](strategy/design-review-2026-08.md) — where the visual
  and editorial layer falls short of the dogfood site, each with a repro

## Project history

[`history/`](./history/README.md) holds unmaintained records of how the project
got here — the extraction analysis, the scaffold status, the original packaging
plan. Kept for the reasoning, not for the instructions.
