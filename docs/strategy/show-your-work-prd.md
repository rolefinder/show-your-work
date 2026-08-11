# PRD: show-your-work

**Status:** Draft (decisions locked 2026-07-09)  
**Date:** 2026-07-09  
**Public name / repo:** `<owner>/show-your-work` (private until hardened, then public)

Related: Fit module [`recruiter-fit-prd.md`](./recruiter-fit-prd.md) + ADR 010–013;
security [`show-your-work-security.md`](./show-your-work-security.md).

---

## 1. One-liner

**show-your-work** is an **open-source** (OSI) personal site template plus agent
toolkit: drop in your own `about` / `work` / `blog` (and later `research`)
data, stand up free-tier hosting, ingest from resume and profiles where
legally possible, and ship a recruiter **Fit** surface that maps a job
description to cited evidence on *your* site.

## 2. Locked decisions (2026-07-09)

| Topic | Decision |
|-------|----------|
| Template routes | **`/work`** and **`/blog`** (not `/projects` / `/writing`) |
| Repo | **`<owner>/show-your-work`** — **private now, public later** |
| Architecture vs the dogfood site | **Copy** template/Fit onto the show-your-work harness. **the dogfood site stays a separate private repo** and dogfoods Fit against real content. Not “make the dogfood site the public template.” |
| License | **Fully open source:** [MIT](https://opensource.org/license/mit) (OSI) — relicensed from Apache-2.0 on 2026-08-11. Commercial use, forks, and paid hosting by others are **allowed**. See §9. Trademark on the name `show-your-work` is separate from the code license. |
| LinkedIn | Goal is **automatic pull** of profile/career data. Supported path is **official data-export ZIP → parser → content YAML** (semi-automatic). Full silent API sync of experience/education is **not** available on self-serve LinkedIn APIs today. Scrapers are **out of supported scope**. See §8. |
| Fit UX | **Open** — single-shot vs multi-turn shell undecided. |

## 3. Why it exists

The maintainer’s live site is a private dogfood instance (strict CSP, modular
content, planned Fit). Other people want the same *shape* without their
biography. show-your-work is the reusable harness; the dogfood site remains private
and copies or vendors modules as needed.

## 4. Users

| User | Job |
|------|-----|
| Job seeker / builder | Publish a portfolio from their data; enable Fit |
| Their coding agent | Ingest, theme, deploy free-tier infra |
| Recruiter | Paste/drop a JD; get a cite-or-missing brief |
| The maintainer | Private dogfood on the dogfood site; Work card once show-your-work is public |

## 5. Surfaces (modules)

| Module | Job | v1? |
|--------|-----|-----|
| **Site template** | Static SPA: `/`, `/about`, `/work`, `/work/<slug>`, `/blog`, `/blog/<slug>`; slot for `/research` later | **Yes** |
| **Content schema** | YAML under `content/about/`, `content/work/`, `content/blog/`, optional `research/` | **Yes** |
| **Fit module** | JD → structured evidence brief (Fit PRD / ADR 010–012) | **Yes** after template |
| **Ingest plugin** | Workflows + skills + sub-agents per source | Resume + GitHub + **LinkedIn export** in early wave; others gated |
| **Design templates + style skill** | 2–3 themes; skill to author/adapt (copyright-aware) | Themes v1; skill v1.1 |
| **Infra skill** | Cloudflare Pages free-tier standup | **Yes** |
| **Security baseline** | See [`show-your-work-security.md`](./show-your-work-security.md) | **Before public** |

Non-goals: multi-tenant SaaS, training-first Fit, **login scraping** of
LinkedIn or any site as a supported feature.

## 6. Content model

```text
content/
  about/
  work/              # → /work, /work/<slug>
  blog/              # → /blog, /blog/<slug>
  research/          # later
design/themes/<name>/
```

Demo corpus only in the public repo. the maintainer’s real YAML stays in private
The maintainer's private site.

## 7. Ingest plugin

Workflow-driven (discover → extract → map → **human confirm** → write YAML).

**v1 sources:** resume (PDF/TXT), GitHub (official API), LinkedIn (**data
export ZIP**, §8).  
**Later:** papers, notes, YouTube (copyright-gated).

## 8. LinkedIn path (research verdict)

### What “automatic pull” can mean

| Approach | Gets experience/education? | ToS / access | Verdict for show-your-work |
|----------|----------------------------|--------------|-------------------------|
| **Sign In with LinkedIn (OIDC)** | Lite profile only (name, photo, email) — [Microsoft Learn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2) | Self-serve | Useful for identity, **not** a portfolio dump |
| **Community Management / Marketing APIs** | Org/page and partner analytics use cases; partner-gated; not a personal “sync my résumé” product — [Community Management API](https://developer.linkedin.com/product-catalog/marketing/community-management-api) | Org/commercial partner review | **Not** the personal ingest path |
| **Official “Download your data” ZIP** | Rich CSV/JSON: positions, education, skills, etc. | Member-initiated, allowed | **Recommended** |
| **Browser scrape / unofficial libs** | Often full profile | Violates LinkedIn User Agreement; ban/legal risk | **Unsupported** |
| **Profile-page bookmarklets** (e.g. linkedin-to-jsonresume) | Varies | Grey area / brittle | Optional personal tool; not a core supported workflow |

### Recommended product behavior (“automatic” enough)

1. Skill opens LinkedIn’s data-download settings (or documents the click path).
2. User requests archive once (LinkedIn emails when ready, often within ~24h).
3. User drops the ZIP on the ingest workflow (or points at a path).
4. **Deterministic parser** maps export → `content/about` + `work` (+ skills).
   Prefer adapting OSS export parsers (e.g. patterns from
   [linkedin2md](https://github.com/juanmanueldaza/linkedin2md),
   [linkedin-network-mcp](https://github.com/0xLT/linkedin-network-mcp))
   under compatible licensing — **do not** wrap scrapers.
5. Diff + confirm before write. Optional watch folder / re-run when a new
   ZIP appears (still user-triggered download).

This is **automatic after the official export**, not silent background
scraping. Document that limitation honestly in the README. Revisit if
LinkedIn ever ships a self-serve member career-data API.

## 9. License — fully open source (MIT)

**Decision (the maintainer, 2026-07-09):** ship show-your-work as **true open source**,
not source-available / Commons Clause / PolyForm. Prior anti-profit
experiment is **withdrawn**. That part still holds.

**Current license: [MIT](https://opensource.org/license/mit).**
Recorded in [ADR 022](../architecture/adr/022-mit-license-and-third-party-notices.md).

> **Superseded 2026-08-11.** This section originally locked
> [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0). The reasoning
> below is kept because the alternatives it rules out are still ruled out —
> only the choice between the two permissive licenses changed.
>
> | Why Apache-2.0 over MIT | Why not AGPL / Commons Clause |
> |-------------------------|-------------------------------|
> | Explicit patent grant + clearer trademark non-grant | AGPL is still commercial-OK; Commons Clause is **not** OSI open source |
> | Common for infra / agent tooling adopters | Matches "fully open source" literally |
> | Compatible with most dependency graphs | Maximizes forks, stars, and corporate tryouts |
>
> **What changed:** for a fork-and-own site template, the license is read by an
> individual deciding whether they may keep the fork, not by a legal team
> clearing a dependency. MIT is the one permissive license that audience reads
> without help, and every third-party line in the tree is already MIT
> ([`THIRD-PARTY-NOTICES.md`](../../THIRD-PARTY-NOTICES.md)), so the project
> now matches what it ships.
>
> **What was given up:** Apache-2.0's express patent grant and its explicit
> statement that the license conveys no trademark rights. MIT is silent on
> both. For a static site generator with no patented technique in it, that is
> a small exposure — but it is a real one, and it is the reason to revisit this
> if show-your-work ever grows a novel algorithm worth patenting.

**Honest consequence:** anyone may use, modify, sell, or host show-your-work
(including paid products) without paying the maintainer. Protection of the *brand*
is via **trademark** on `show-your-work` / marketing, not via the code license.
Protection of *your* live site remains the the private dogfood site + security
baseline ([`show-your-work-security.md`](./show-your-work-security.md)).

Third-party attribution lives in
[`THIRD-PARTY-NOTICES.md`](../../THIRD-PARTY-NOTICES.md), which covers only what
is redistributed in-tree — vendored React, and the graph engine bundled from
graphology and sigma. Build tooling never reaches `dist/`, so it is not listed.

This section is product guidance, not legal advice.

## 10. What else to factor in (incl. security)

Full threat model and tooling: [`show-your-work-security.md`](./show-your-work-security.md).

Short list: LinkedIn ToS, copyright, PII redaction, Publish Guardian before
public, Fit quota/CSP, content-drift gates, template semver, agent ingest
cost, maintainer burden, trademark `show-your-work`, a11y/SEO, migration = copy
out of the dogfood site (not in-place public conversion).

## 11. Free-tier infra

Cloudflare Pages + optional Functions for Fit. Infra skill uses **generic**
account setup docs — no the dogfood site Terraform, account IDs, or production
hostnames in the public tree.

## 12. Listing the template as a work project

After public launch: `content/projects/show-your-work.yaml` with `note.href` to
`https://github.com/<owner>/show-your-work`. Until then `visible: false` or
omit the file.

## 13. Sequencing

1. Private `<owner>/show-your-work` scaffold + demo corpus + theme + CSP.  
2. Security baseline (Dependabot, secret scanning, gitleaks, Scorecard-ready
   defaults) **before** public.  
3. Infra skill → throwaway Pages demo.  
4. Fit package; dogfood on **private** the dogfood site.  
5. LinkedIn **export** ingest + resume + GitHub.  
6. Publish Guardian + public flip.  
7. Work card on the dogfood site.  
8. Extra themes / style skill / other ingest sources.

## 14. Success metrics

- Stranger (or their agent) deploys demo corpus to Pages free tier via infra skill.  
- Fit fixtures: zero unevidenced `aligned` on demo corpus.  
- The maintainer's private site runs Fit against real content without publishing that content
  in show-your-work.  
- LinkedIn export → reviewable YAML diff in one workflow run.

## 15. Remaining open questions

1. Fit UX: single-shot vs multi-turn (still open / depends)?  
2. Which 2–3 starter themes?  
3. Trademark filing for `show-your-work` (optional but recommended)?  
4. How much Publish Guardian to vendor vs checklist-only?  
5. How much of Publish Guardian to vendor into show-your-work vs document as
   external gate?
