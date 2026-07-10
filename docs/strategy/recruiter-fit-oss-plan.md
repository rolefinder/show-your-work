# recruit-me / Fit ΓÇö open-source packaging plan

**Status:** Draft (aligned to 2026-07-09 decisions)  
**Date:** 2026-07-09  
**Umbrella:** [`recruit-me-prd.md`](./recruit-me-prd.md)  
**Security:** [`recruit-me-security.md`](./recruit-me-security.md)  
**Fit module:** [`recruiter-fit-prd.md`](./recruiter-fit-prd.md), ADR 010ΓÇô013  

---

## 1. Architecture

| Repo | Role | Visibility |
|------|------|------------|
| **`hhalperin/recruit-me`** | Template harness + Fit + ingest + themes + infra skill + **demo** corpus | **Private now ΓåÆ public later** |
| **`hhalperin/harrison-site`** | Personal production site + real content + dogfood Fit | **Remains private** |

**Copy** modules onto the recruit-me harness (and vendor/copy back into
harrison-site as needed). Do **not** convert harrison-site into the public
template in-place.

---

## 2. Routes (template)

Canonical adopter routes: **`/work`**, **`/work/<slug>`**, **`/blog`**,
**`/blog/<slug>`**, plus `/` and `/about`. Extensible `/research` later.

(harrison-site may keep `/writing` until it chooses to align; that is a
private-site choice, not a template requirement.)

---

## 3. What adopters bring

Their `content/about|work|blog`, theme choice, and their own Cloudflare
account. Not HarrisonΓÇÖs corpus, JD logs, or secrets.

---

## 4. Repo shape

```text
recruit-me/
  apps/site/                 # SPA template (CSP-first); /work + /blog
  content/demo-persona/      # fake data only
  design/themes/
  packages/fit/
  packages/ingest/           # resume, GitHub, LinkedIn export workflows
  packages/content-schema/
  skills/infra-pages/
  skills/design-theme/
  docs/                      # generic free-tier setup ΓÇö no prod IDs
  wrangler.example.toml
  LICENSE                    # Apache-2.0 (OSI; PRD ┬º9)
  SECURITY.md
```

License: **Apache-2.0** ΓÇö fully open source (PRD ┬º9).

---

## 5. Fit module

Unchanged intent (ADR 010ΓÇô012): same-origin RAG, dual quota, cite-or-missing,
demo index only in public repo. Dogfood against real content only inside
private harrison-site.

Fit UX (single-shot vs multi-turn) remains **open**.

---

## 6. LinkedIn ingest packaging

Ship **export-ZIP ΓåÆ YAML** workflow as the supported ΓÇ£automaticΓÇ¥ path.
Document OIDC lite-profile as optional identity only. Do not ship scrapers.
Details: PRD ┬º8.

---

## 7. Security before public

Mandatory gate: [`recruit-me-security.md`](./recruit-me-security.md)
checklist (secret scanning, Dependabot, CodeQL/Semgrep, gitleaks, branch
protection, SECURITY.md, Publish Guardian, no prod IDs in docs).

---

## 8. Work card

After public flip: harrison-site `content/projects/recruit-me.yaml` with
`note.href` ΓåÆ `https://github.com/hhalperin/recruit-me`.

---

## 9. Sequencing

1. Create **private** `hhalperin/recruit-me`.  
2. Scaffold + security baseline.  
3. Demo deploy via infra skill.  
4. Fit package; dogfood on private harrison-site.  
5. Ingest: resume, GitHub, LinkedIn export.  
6. Publish Guardian ΓåÆ **public**.  
7. Work card on harrison-site.

---

## 10. Principles

Boundary Discipline (private site Γëá public template). Laziness (copy
harness, donΓÇÖt merge repos). Experience First (adopters run on free tier
with their data). Prove It Works (harden private repo before public).
