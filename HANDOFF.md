# HANDOFF: recruit-me

> **Canonical copy** lives at repo root `HANDOFF.md` once the scaffold is
> pushed to `recruit-me`. This file is the harrison-site mirror for agents
> that only have this repo.

**For:** any agent with **push access** to [`hhalperin/recruit-me`](https://github.com/hhalperin/recruit-me)  
**From:** cloud agent on `harrison-site` (token scoped to that repo only ΓÇö cannot push `recruit-me`)  
**Date:** 2026-07-10  
**Owner:** Harrison Halperin (`harrison@quant-h2.com`)  
**Originating agent run:** [Personal website LLM](https://cursor.com/agents/bc-019f48b0-06b2-77e3-a127-658f8a7fe55a) (`bc-019f48b0-06b2-77e3-a127-658f8a7fe55a`)  
**Local scaffold HEAD:** `cb2cce6` (v0.2 + comprehensive `HANDOFF.md`; confirm with `git rev-parse --short HEAD`)  
**Repo:** private now ΓåÆ public later ┬╖ **License:** Apache-2.0 ┬╖ **Version:** 0.2.0

---

## 0. First actions (do these before new features)

1. **Confirm access**
   ```bash
   gh repo view hhalperin/recruit-me
   git ls-remote https://github.com/hhalperin/recruit-me.git
   ```
2. **Get the code onto `main`** (pick one):
   - **Preferred if this / a warm agent VM still has the tree:**
     ```bash
     cd /home/ubuntu/recruit-me   # or wherever the scaffold lives
     git remote -v                # should point at hhalperin/recruit-me
     git log --oneline -3         # expect handoff docs on top of 3e77e88
     git push -u origin main
     ```
   - **If starting fresh:** unpack the source artifact (┬º9), then:
     ```bash
     cd recruit-me
     # if tarball has no .git:
     git init && git add . && git commit -m "feat: v0.2 scaffold ΓÇö TS, Fit, ingest, infra"
     git branch -M main
     git remote add origin https://github.com/hhalperin/recruit-me.git
     git push -u origin main
     ```
     Prefer `/opt/cursor/artifacts/recruit-me-v0.tgz` (includes `.git`) when available.
   - **If Harrison already pushed commits:** `git pull --rebase` (or merge) before
     adding work. **Do not force-push** without explicit approval.
3. **Verify**
   ```bash
   pip install --user pyyaml
   npm ci && npm run test && npm run preview   # :4173 ΓÇö open /fit
   ```
4. **Then continue** from ┬º8. Do **not** re-scaffold from scratch.

---

## 1. Origin story (why this exists)

Harrison asked to train a micro/nano LLM on his personal-site text so visitors
could learn about him. Product discovery (via poteto-mode) concluded:

1. **Do not train** a tiny GPT on ~6ΓÇô7k words of site prose as the product.
   Corpus is enough for RAG, not trustworthy from-scratch training.
   Hallucinated bio facts are worse than no bot.
2. **Optimal use case:** Recruiter pastes/drops a **job description** ΓåÆ
   structured **Fit** brief mapping requirements to published `/work` and
   `/blog` evidence with links; mark gaps; never invent employers/years.
3. **Umbrella OSS product `recruit-me`:** open-source the website **template**
   + Fit + ingest + design/infra skills. Adopter owns `about/` / `work/` /
   `blog/`. Dogfood stays on private **harrison-site**; copy the harness ΓÇö
   do not convert the personal site into the public template.

---

## 2. What recruit-me is

**One-liner:** Open-source (Apache-2.0) personal portfolio **site template** +
agent toolkit: adopter-owned YAML content, free-tier Cloudflare Pages deploy,
ingest helpers, and a recruiter **Fit** surface (JD ΓåÆ cite-or-missing evidence
brief).

| Repo | Role | Visibility |
|------|------|------------|
| `hhalperin/recruit-me` | Template harness + Fit + ingest + skills + **demo** corpus | Private ΓåÆ public later |
| `hhalperin/harrison-site` | Personal production site + real content | **Stays private** |

---

## 3. Locked product decisions

| Topic | Decision |
|-------|----------|
| Routes | `/work`, `/blog` (not `/projects` / `/writing`) |
| Content dirs | `content/about/`, `content/work/`, `content/blog/` (+ later `research/`) |
| License | **Apache-2.0** (true OSI ΓÇö commercial use allowed) |
| Brand | Trademark `recruit-me` separately from code license (optional later) |
| Architecture | **Copy** patterns into recruit-me; do **not** convert harrison-site into the public template |
| LinkedIn | Official **data-export ZIP ΓåÆ parser** only. No scrapers / Voyager / cookie bots |
| Fit UX | Still open: single-shot panel (current) vs thin multi-turn shell later |
| Demo data | **Fake Name** / **Fake Project** placeholders only ΓÇö never HarrisonΓÇÖs real bio/projects |

Strategy docs live on **harrison-site** draft PRs (may be unmerged):

| Doc | Where |
|-----|--------|
| Fit PRD + ADRs 010ΓÇô013 | PR #86 `cursor/recruiter-fit-prd-adrs-e55a` |
| Umbrella PRD + OSS plan | PR #88ΓÇô#89 |
| Decisions + `recruit-me-security.md` | PR #90 |
| Apache-2.0 lock | PR #91 |
| Scaffold status + this handoff mirror | PR #92 |

Fetch examples:
```bash
git fetch origin cursor/recruit-me-decisions-security-e55a
git show origin/cursor/recruit-me-decisions-security-e55a:docs/strategy/recruit-me-prd.md
git show origin/cursor/recruiter-fit-prd-adrs-e55a:docs/architecture/adr/010-recruiter-fit-architecture.md
```

---

## 4. WhatΓÇÖs already built (v0.2)

Verified with `npm run test` (build + fit-smoke).

### Site template
- TypeScript SPA: `src/app.tsx`, `src/types.ts`, `src/globals.d.ts`
- Routes: `/`, `/about`, `/work`, `/work/<slug>`, `/blog`, `/blog/<slug>`, `/fit`
- YAML content + `scripts/emit-content.py` (splices typed `SITE_PROFILE` / `WORK` / `BLOG` into `src/app.tsx`)
- Build: `tsc --noEmit` + **esbuild** IIFE ΓåÆ `dist/app.js`
- React **vendored** under `assets/vendor/` (script tags); esbuild marks `react` **external** (CSP `script-src 'self'`)
- Strict CSP in `_headers`; SPA fallback in `_redirects`
- Default theme tokens under `tokens/`

### Fit (working, deterministic ΓÇö no LLM yet)
- UI: `src/fit/FitPage.tsx` ΓÇö paste or drop `.txt` / `.md` (1 MB / 12k char caps)
- Engine: `src/fit/{types,evidence,extract,match,index}.ts`
- Contract: `role_read`, per-requirement `aligned|partial|missing|not_evidenced_on_site`, evidence links, gaps, caveats
- **Hard rule:** `aligned` requires ΓëÑ1 citation
- `scripts/emit-evidence.py` ΓåÆ `dist/evidence.json`
- Pages Function: `functions/api/fit.ts` (`POST /api/fit`), optional KV `FIT_QUOTA` (2/day stub)
- Worker bundle: `npm run build:fit-worker` ΓåÆ `functions/_lib/fit-engine.js` (gitignored)
- Smoke: `scripts/fit-smoke.ts` ΓÇö CI/CD JD must cite Harbor Gate; Kubernetes must **not** be aligned on demo corpus

### Ingest (draft generators ΓÇö human review before copy into `content/`)
- `packages/ingest/from-resume-text.py`
- `packages/ingest/from-github.py` (public GitHub API)
- `packages/ingest/README.md` ΓÇö LinkedIn ZIP path documented, parser not built

### Ops / security baseline
- `skills/infra-pages/SKILL.md` ΓÇö Cloudflare Pages free-tier standup
- `.github/workflows/ci.yml`, `.github/dependabot.yml`
- `LICENSE` (Apache-2.0), `SECURITY.md`, `CONTRIBUTING.md`, `wrangler.example.toml` (placeholders only)

### Local commit history (feature spine + handoff docs)

```
<docs handoff commits>   # HANDOFF.md ΓÇö see git log (tip ~cb2cce6)
3e77e88 chore: restore dist/ in gitignore
91e28f6 chore: stop tracking dist/ build output
63c50a7 feat: Fit matcher UI, /api/fit scaffold, ingest + infra skill
93b43bc feat: migrate site and build scripts to TypeScript
cc9b089 feat: v0 scaffold ΓÇö YAML content, emit, CSP static build
```

---

## 5. How to run

```bash
pip install --user pyyaml
npm ci
npm run build          # emit ΓåÆ typecheck ΓåÆ esbuild ΓåÆ evidence.json ΓåÆ fit-worker
npm run preview        # http://localhost:4173
npm run fit:smoke      # after build
npm run test           # build + fit-smoke
```

Edit `content/**/*.yaml`, then rebuild. Never hand-edit the emitted blocks
between `/* BEGIN ΓÇª */` markers without understanding emit.

---

## 6. Architecture notes (do not regress)

1. **CSP first.** No CDN React, no third-party model SDKs in the browser. Fit
   stays same-origin (`connect-src 'self'`) when using `/api/fit`.
2. **Browser Fit works offline** (deterministic matcher over in-memory pack).
   Function is optional enhancement / future AI path.
3. **Output contract is stable.** When adding Workers AI + Vectorize, keep the
   same JSON shape; swap the engine behind it.
4. **Demo corpus Γëá production.** Never copy harrison-site real YAML into this repo.
5. **Secrets.** Never commit `wrangler.toml` with account IDs, tokens, or real
   PII. Example file only.
6. **`dist/` and `functions/_lib/` are gitignored.** CI builds them.

---

## 7. Security / ΓÇ£surface mapΓÇ¥ concern (Harrison)

Open-sourcing the **template** is not a map of production:

- Live site HTML/JS/CSP is already public to visitors
- Real content, CF account, Fit logs, Terraform stay in **private harrison-site**
- Harden **before** flipping recruit-me public: Dependabot (done), secret
  scanning, gitleaks, CodeQL/Semgrep, Scorecard, branch protection, Publish
  Guardian checklist, no prod IDs in docs

See `recruit-me-security.md` on harrison-site PR #90 when available.

---

## 8. Recommended next slices (in order)

1. **Land code on GitHub `main`** (┬º0) and green CI on the remote.
2. **Workers AI + Vectorize** behind `/api/fit` ΓÇö same response contract; keep
   deterministic path as fallback / local preview.
3. **Quota** ΓÇö implement ADR 011 dual caps (2/day **and** 10/week) + Request-more
   (larger model, 7-day cooldown, +2 grant) when AI path exists.
4. **LinkedIn export ZIP parser** ΓÇö adapt OSS ZIPΓåÆstructured patterns; human
   confirm before write. No scrapers.
5. **PDF JD** on Worker only (`.docx` deferred).
6. **2ΓÇô3 themes** + design skill (copyright-aware ΓÇ£inspiration,ΓÇ¥ not paste
   proprietary CSS).
7. **Publish Guardian / public flip** checklist, then Work card on harrison-site:
   `content/projects/recruit-me.yaml` with `note.href` ΓåÆ GitHub.

---

## 9. Artifacts (if the agent VM is gone)

Produced on the originating cloud agent (paths may only exist on that machine):

| Artifact | SHA-256 |
|----------|---------|
| `/home/ubuntu/recruit-me` | Working tree if warm ΓÇö **preferred** (HEAD `cb2cce6`) |
| `/opt/cursor/artifacts/recruit-me-v0.tgz` | `bccac6867b40d23b8985256680d0632de951edaab765690d6fdc0f31bd0c2cfc` (includes `.git`) |
| `/opt/cursor/artifacts/recruit-me-v0-source.tgz` | `6193d6e5214b57d39114f220040acdcc93f165b9667ee9e085e07e24db497fe3` |

Re-run `sha256sum` after any local change before trusting a tarball.

---

## 10. Related harrison-site PRs / branches (docs only)

These are mostly **draft / unmerged**. Useful context; **do not** treat
harrison-site as the home of recruit-me application code.

| PR | Branch | Topic |
|----|--------|--------|
| #86 | `cursor/recruiter-fit-prd-adrs-e55a` | Fit PRD + ADRs 010ΓÇô013 |
| #87 | `cursor/content-emit-modular-posts-e55a` | Modular posts + shared emit helpers |
| #88ΓÇô#89 | recruit-me vision branches | Umbrella PRD + OSS packaging |
| #90 | `cursor/recruit-me-decisions-security-e55a` | Routes, LinkedIn, security doc |
| #91 | `cursor/recruit-me-fully-oss-license-e55a` | Apache-2.0 lock |
| #92 | `cursor/recruit-me-scaffold-note-e55a` | Scaffold status + handoff mirror |

Also on harrison-site (related content plumbing): modular posts (`content/posts/`)
mirroring ADR 006 projects ΓÇö see PR #87 / ADR 013.

---

## 11. Open questions for Harrison (still)

1. Fit UX: keep single-shot panel, or add thin multi-turn on the same contract?
2. Starter theme set (which 2ΓÇô3 looks)?
3. Trademark filing for `recruit-me`?
4. How much Publish Guardian to vendor vs checklist-only?
5. When to flip repo public?
6. Finish clarifying GitHub App / collaborator access for agents on `recruit-me`
   (prior message was cut off at ΓÇ£You gave access toΓÇªΓÇ¥).

---

## 12. What NOT to do

- Do not scrape LinkedIn or ship unofficial LinkedIn APIs
- Do not put HarrisonΓÇÖs real portfolio YAML in this repo
- Do not widen CSP for browser WASM / third-party model CDNs in v1
- Do not train a micro-LLM on site text as the Fit product (RAG /
  retrieve-then-generate later; deterministic now)
- Do not `git push` to `harrison-site` `main` or edit protected CI paths there
  without following that repoΓÇÖs agent guide
- Do not force-push `recruit-me` `main` if Harrison already has commits you
  havenΓÇÖt seen ΓÇö coordinate first

---

## 13. Success criteria for the next agentΓÇÖs first session

- [ ] `main` on `hhalperin/recruit-me` contains the v0.2 scaffold + this `HANDOFF.md`
- [ ] Remote CI green (`npm run test`)
- [ ] `/fit` works in `npm run preview` with a sample JD
- [ ] Short PR or commit note: ΓÇ£landed scaffold from handoff; next = ΓÇªΓÇ¥
- [ ] No secrets in the tree

---

## 14. Contact / tone

Owner prefers concise updates. Prefer shipping verifiable slices over large
speculative refactors. When in doubt, re-read ┬º3 locked decisions and ┬º6
architecture notes.
