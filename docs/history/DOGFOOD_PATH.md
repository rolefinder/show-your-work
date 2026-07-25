# Dogfood path — harrison-site consuming recruit-me

After recruit-me `main` has Fit + graph + skill-bank, the private dogfood site
can adopt pieces without becoming the public template.

## Goals

- Keep Harrison’s real YAML / identity / publication-safety lists **private**.
- Prefer **vendoring or thin adapters** over rewriting site history overnight.
- Point a future public project card at the GitHub repo once the repo is public.

## Concrete next steps (site side)

1. **Fit matcher**
   - Extract or copy `recruit-me/src/fit/{match,extract,evidence,config,types}.ts`
     into a site-local module (or npm workspace later).
   - Map site `PROJECTS`/`POSTS` → `EvidenceDoc[]` (`work:` / `blog:` ids).
   - Keep site Fit UX (search palette) as a consumer; do not reverse-merge
     Harrison stopwords into OSS.

2. **Graph engine**
   - Site already ships a larger `graph/portfolio-graph-engine.mjs`.
   - Migration path: replace `window.HHPG_FORCES` with typed `opts.forces`
     (already done in recruit-me), then either:
     - vendor `recruit-me/graph/*` + `scripts/build-graph-vendor.mjs`, or
     - port the `resolveForces` pattern into the site engine in a small PR.
   - Keep site `buildKnowledgeGraph()` until ID prefixes are unified
     (`proj:` vs `work:` — see `PACKAGE_BOUNDARIES.md`).

3. **Skill bank**
   - Move site `SKILL_CATEGORY_MAP` out of `app.jsx` into tenant YAML
     (same shape as `content/config/skills.yaml` here).
   - Reuse `buildSkillBankGroups` / `?skill=` URL contract from
     `src/skills/SkillBank.tsx`.

4. **Optional project card (when repo is public)**
   - Add `content/projects/recruit-me.yaml` with `visible: false` until ready,
     then flip visible and set `note.href` → `https://github.com/hhalperin/recruit-me`.
   - Do **not** paste Avery Quill demo copy into the live site as if it were
     Harrison’s work.
   - First dogfood PR may land the hidden YAML only (no Fit/graph vendor yet).

## Explicit non-goals for the first dogfood PR

- Rewriting production `app.jsx` to import recruit-me packages in one shot
- Making the GitHub repo public from the OSS track alone
- Copying employer / PII banlists into recruit-me

## Verify after each site slice

```powershell
powershell -File scripts/org/verify-all.ps1
```
