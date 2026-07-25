# PRD: recruit-me

**Status:** Draft (decisions locked 2026-07-09)  
**Date:** 2026-07-09  
**Owner:** Harrison Halperin  
**Public name / repo:** `<owner>/recruit-me` (private until hardened, then public)

Related: Fit module [`recruiter-fit-prd.md`](./recruiter-fit-prd.md) + ADR 010–013;
packaging [`recruiter-fit-oss-plan.md`](../history/recruiter-fit-oss-plan.md);
security [`recruit-me-security.md`](./recruit-me-security.md).

---

## 1. One-liner

**recruit-me** is an **open-source** (OSI) personal site template plus agent
toolkit: drop in your own `about` / `work` / `blog` (and later `research`)
data, stand up free-tier hosting, ingest from resume and profiles where
legally possible, and ship a recruiter **Fit** surface that maps a job
description to cited evidence on *your* site.

## 2. Locked decisions (2026-07-09)

| Topic | Decision |
|-------|----------|
| Template routes | **`/work`** and **`/blog`** (not `/projects` / `/writing`) |
| Repo | **`<owner>/recruit-me`** — **private now, public later** |
| Architecture vs harrison-site | **Copy** template/Fit onto the recruit-me harness. **harrison-site stays a separate private repo** and dogfoods Fit against real content. Not “make harrison-site the public template.” |
| License | **Fully open source:** [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) (OSI). Commercial use, forks, and paid hosting by others are **allowed**. See §9. Trademark on the name `recruit-me` is separate from the code license. |
| LinkedIn | Goal is **automatic pull** of profile/career data. Supported path is **official data-export ZIP → parser → content YAML** (semi-automatic). Full silent API sync of experience/education is **not** available on self-serve LinkedIn APIs today. Scrapers are **out of supported scope**. See §8. |
| Fit UX | **Open** — single-shot vs multi-turn shell undecided. |

## 3. Why it exists

Harrison’s live site is a private dogfood instance (strict CSP, modular
content, planned Fit). Other people want the same *shape* without his
biography. recruit-me is the reusable harness; harrison-site remains private
and copies or vendors modules as needed.

## 4. Users

| User | Job |
|------|-----|
| Job seeker / builder | Publish a portfolio from their data; enable Fit |
| Their coding agent | Ingest, theme, deploy free-tier infra |
| Recruiter | Paste/drop a JD; get a cite-or-missing brief |
| Harrison | Private dogfood on harrison-site; Work card once recruit-me is public |

## 5. Surfaces (modules)

| Module | Job | v1? |
|--------|-----|-----|
| **Site template** | Static SPA: `/`, `/about`, `/work`, `/work/<slug>`, `/blog`, `/blog/<slug>`; slot for `/research` later | **Yes** |
| **Content schema** | YAML under `content/about/`, `content/work/`, `content/blog/`, optional `research/` | **Yes** |
| **Fit module** | JD → structured evidence brief (Fit PRD / ADR 010–012) | **Yes** after template |
| **Ingest plugin** | Workflows + skills + sub-agents per source | Resume + GitHub + **LinkedIn export** in early wave; others gated |
| **Design templates + style skill** | 2–3 themes; skill to author/adapt (copyright-aware) | Themes v1; skill v1.1 |
| **Infra skill** | Cloudflare Pages free-tier standup | **Yes** |
| **Security baseline** | See [`recruit-me-security.md`](./recruit-me-security.md) | **Before public** |

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

Demo corpus only in the public repo. Harrison’s real YAML stays in private
harrison-site.

## 7. Ingest plugin

Workflow-driven (discover → extract → map → **human confirm** → write YAML).

**v1 sources:** resume (PDF/TXT), GitHub (official API), LinkedIn (**data
export ZIP**, §8).  
**Later:** papers, notes, YouTube (copyright-gated).

## 8. LinkedIn path (research verdict)

### What “automatic pull” can mean

| Approach | Gets experience/education? | ToS / access | Verdict for recruit-me |
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

## 9. License — fully open source (locked)

**Decision (Harrison, 2026-07-09):** ship recruit-me as **true open source**,
not source-available / Commons Clause / PolyForm. Prior anti-profit
experiment is **withdrawn**.

**Chosen license: [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).**

| Why Apache-2.0 over MIT | Why not AGPL / Commons Clause |
|-------------------------|-------------------------------|
| Explicit patent grant + clearer trademark non-grant | AGPL is still commercial-OK; Commons Clause is **not** OSI open source |
| Common for infra / agent tooling adopters | Matches “fully open source” literally |
| Compatible with most dependency graphs | Maximizes forks, stars, and corporate tryouts |

**Honest consequence:** anyone may use, modify, sell, or host recruit-me
(including paid products) without paying Harrison. Protection of the *brand*
is via **trademark** on `recruit-me` / marketing, not via the code license.
Protection of *your* live site remains the private harrison-site + security
baseline ([`recruit-me-security.md`](./recruit-me-security.md)).

**While the repo is private:** add `LICENSE` (Apache-2.0) as soon as the
scaffold exists so the public flip is a visibility change, not a relicensing
event. Optional `NOTICE` file if third-party attributions accumulate.

This section is product guidance, not legal advice.

## 10. What else to factor in (incl. security)

Full threat model and tooling: [`recruit-me-security.md`](./recruit-me-security.md).

Short list: LinkedIn ToS, copyright, PII redaction, Publish Guardian before
public, Fit quota/CSP, content-drift gates, template semver, agent ingest
cost, maintainer burden, trademark `recruit-me`, a11y/SEO, migration = copy
out of harrison-site (not in-place public conversion).

## 11. Free-tier infra

Cloudflare Pages + optional Functions for Fit. Infra skill uses **generic**
account setup docs — no harrison-site Terraform, account IDs, or production
hostnames in the public tree.

## 12. Work project on harrisonhalperin.com

After public launch: `content/projects/recruit-me.yaml` with `note.href` to
`https://github.com/<owner>/recruit-me`. Until then `visible: false` or
omit the file.

## 13. Sequencing

1. Private `<owner>/recruit-me` scaffold + demo corpus + theme + CSP.  
2. Security baseline (Dependabot, secret scanning, gitleaks, Scorecard-ready
   defaults) **before** public.  
3. Infra skill → throwaway Pages demo.  
4. Fit package; dogfood on **private** harrison-site.  
5. LinkedIn **export** ingest + resume + GitHub.  
6. Publish Guardian + public flip.  
7. Work card on harrison-site.  
8. Extra themes / style skill / other ingest sources.

## 14. Success metrics

- Stranger (or their agent) deploys demo corpus to Pages free tier via infra skill.  
- Fit fixtures: zero unevidenced `aligned` on demo corpus.  
- harrison-site runs Fit against real content without publishing that content
  in recruit-me.  
- LinkedIn export → reviewable YAML diff in one workflow run.

## 15. Remaining open questions

1. Fit UX: single-shot vs multi-turn (still open / depends)?  
2. Which 2–3 starter themes?  
3. Trademark filing for `recruit-me` (optional but recommended)?  
4. How much Publish Guardian to vendor vs checklist-only?  
5. How much of Publish Guardian to vendor into recruit-me vs document as
   external gate?
