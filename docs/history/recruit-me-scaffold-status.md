# recruit-me scaffold status (v0.2)

**Date:** 2026-07-10  
**Local path (agent machine):** `/home/ubuntu/recruit-me`  
**Intended remote:** `https://github.com/<owner>/recruit-me` (private)  
**HEAD:** `cb2cce6` (v0.2 + comprehensive `HANDOFF.md`)  
**Agent handoff:** [`recruit-me-handoff.md`](./recruit-me-handoff.md) (mirror of repo-root `HANDOFF.md`)  
**Originating run:** https://cursor.com/agents/bc-019f48b0-06b2-77e3-a127-658f8a7fe55a

## What shipped

| Area | Status |
|------|--------|
| TypeScript SPA (`src/app.tsx`) | Done |
| YAML `content/about\|work\|blog` + emit | Done |
| **Fit UI** `/fit` — paste/drop JD, cite-or-missing brief | Done (deterministic) |
| `src/fit/*` matcher + evidence pack | Done |
| `dist/evidence.json` + `POST /api/fit` Pages Function scaffold | Done |
| Optional KV daily quota stub | Done |
| Ingest: resume TXT + GitHub API drafts | Done |
| `skills/infra-pages` | Done |
| CI + Dependabot + `npm run fit:smoke` | Done |
| Demo persona Avery Quill | Fictional only |
| `HANDOFF.md` for next agent | Done |

Verified: `npm run test` (build + fit-smoke) green. Harbor Gate cites for CI/CD JDs; Kubernetes stays non-aligned on demo corpus.

## Blocker

Cloud-agent GitHub token for **harrison-site** cannot push `<owner>/recruit-me`
(`Repository not found` / 404). Harrison created the private repo; next agent
**with recruit-me access** must push local `main` (or unpack artifact) — see handoff §0.

## Artifacts

| File | SHA-256 |
|------|---------|
| `/opt/cursor/artifacts/recruit-me-v0-source.tgz` | `6193d6e5214b57d39114f220040acdcc93f165b9667ee9e085e07e24db497fe3` |
| `/opt/cursor/artifacts/recruit-me-v0.tgz` (includes `.git`) | `bccac6867b40d23b8985256680d0632de951edaab765690d6fdc0f31bd0c2cfc` |

## Push (agent with recruit-me access)

```bash
cd /home/ubuntu/recruit-me
git remote -v   # <owner>/recruit-me
git push -u origin main
```

Or unpack the full tarball and push.

## Run locally

```bash
cd /home/ubuntu/recruit-me
npm ci && npm run test && npm run preview   # :4173 — try /fit
```

## Next (after land on GitHub)

1. Workers AI + Vectorize behind same Fit contract  
2. Dual quota + Request-more (ADR 011)  
3. LinkedIn export ZIP parser  
4. PDF JD on Worker  
5. Extra themes  
6. Public flip + Work card on harrison-site  
