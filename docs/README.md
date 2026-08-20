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
| [018](architecture/adr/018-build-command-and-source-drafting.md) | `/build-show-your-work` and source drafting |
| [019](architecture/adr/019-fit-highlight-mode.md) | Fit is a highlight, not an audit |
| [020](architecture/adr/020-github-pages-target-and-agent-autonomy.md) | **GitHub Pages as the default target**, and what an agent may do alone |
| [021](architecture/adr/021-additive-only-adoption.md) | **Adoption is additive** — you add files, you never edit or delete them |
| [022](architecture/adr/022-mit-license-and-third-party-notices.md) | MIT, and attribution for what is actually redistributed |
| [023](architecture/adr/023-bun-toolchain.md) | **bun installs and runs TypeScript**; Node still runs the gates |
| [024](architecture/adr/024-read-only-mcp-endpoint.md) | **A read-only MCP endpoint** — agents read the corpus without scraping |
| [025](architecture/adr/025-directory-skeleton-gate.md) | The directory tree is machine-checked against the one documented |
| [026](architecture/adr/026-copy-quality-gate.md) | Rendered copy is linted, because no other gate reads the words |
| [027](architecture/adr/027-experience-and-education-content.md) | **Experience and education** as content types — roles become Fit evidence |
| [028](architecture/adr/028-free-to-serve.md) | **Free to serve** — the template hosts your Pages site and provisions nothing else |

> ADRs are dated records. Some name file paths from the layout at the time of
> the decision — the HTML templates moved into `public/`, for instance. The
> current tree is in [ARCHITECTURE.md](../ARCHITECTURE.md); where they
> disagree, the code wins. Rewriting an ADR to match a later layout would make
> it lie about what was true when the decision was taken.

## I want to run it in production

- [Bot and cost protection](ops/bot-and-cost-protection.md)
- [SEO visibility checklist](ops/seo-visibility-checklist.md)
- [Security policy](../SECURITY.md), and the fuller
  [security posture](strategy/show-your-work-security.md)

## I want to know why this exists

- [show-your-work PRD](strategy/show-your-work-prd.md) — the product
- [Recruiter Fit PRD](strategy/recruiter-fit-prd.md) — the module
- [Platform review, 2026-07](strategy/platform-review-2026-07.md) —
  standardization and adopter-UX findings, each with a repro

## There is no project-history section

Deliberately. Planning docs, handoffs and status snapshots describe how *this*
project got built, which is of no use to someone building *their* site — and
they rot into contradictions of the current tree. Every decision worth keeping
is an ADR above, where the reasoning is dated and the rejected options are
recorded alongside it.
