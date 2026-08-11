# show-your-work — security posture

**Status:** Draft  
**Date:** 2026-07-09  

Companion to [`show-your-work-prd.md`](./show-your-work-prd.md). Addresses the concern:
“Open-sourcing this gives attackers a surface map to hijack my site.”

---

## 1. Separation (the load-bearing control)

| Asset | Where it lives | Public? |
|-------|----------------|---------|
| Template app, Fit module, ingest skills, demo corpus | `<owner>/show-your-work` | Private → public |
| Real portfolio content, production Fit, personal ops | `<owner>/private-site` (+ CF account) | **Stays private** |
| Cloudflare tokens, AI bindings, JD retention store | Account secrets / private stores | **Never in git** |
| Personal Terraform / zone IDs / production hostnames | the dogfood site `infra/` | **Private** — not copied into show-your-work docs |

Attackers who clone show-your-work get a **generic** free-tier template and a
**fake** persona corpus. They do **not** get the maintainer’s content, bindings,
or account map.

Dogfood Fit on the private dogfood site. Public show-your-work ships demo data only.

---

## 2. Threat model (honest)

### What open-sourcing the template discloses

- How the SPA is built, CSP header *shape*, Fit API *patterns*, quota
  design, ingest workflows, theme tokens.
- Example `wrangler.toml` **placeholders** (`ACCOUNT_ID=`, binding names).

### What it does not disclose

- Production secrets, real Vectorize index contents, stored JDs, private
  content YAML, personal DNS/Terraform state.

### What attackers already have without OSS

The **live** site already exposes HTML, JS, CSP, routes, and public copy to
anyone who loads the maintainer's own site. “Surface map” of the *production*
instance is largely already public. OSS of a *separate* template does not
magically grant write access to Cloudflare.

### Real risks to manage

1. **Secret leak** into show-your-work git history (tokens in examples).  
2. **Dependency RCE** in build/Fit Worker deps.  
3. **Prototype pollution / XSS** in template JS if CSP is weakened.  
4. **Fit abuse** on adopter deploys (and on the dogfood site when Fit ships).  
5. **Confused docs** that paste production hostnames or real account IDs.  
6. **Supply chain** if adopters install a compromised release.

OSS done well **helps defenders** (many eyes, automated scanners, Scorecard)
more than it helps attackers — *if* production stays separated and secrets
stay out.

---

## 3. Controls before flipping show-your-work public

### Repository

- Private until the checklist below is green, then public.
- Branch protection on `main`: required reviews, no force-push, status checks.
- CODEOWNERS for sensitive paths (`packages/fit`, workflows, `wrangler*`).
- Signed commits preferred for maintainers.
- `SECURITY.md` with private vulnerability reporting (GitHub Security
  Advisories).
- No real secrets in tree; `wrangler.example.toml` only; `.env*` gitignored;
  pre-commit **gitleaks** / **trufflehog**.
- GitHub secret scanning + push protection enabled.
- **Dependabot** or **Renovate** for Actions and npm/pip.
- **CodeQL** and/or **Semgrep** on PRs.
- **OpenSSF Scorecard** monitored after public; fix easy wins (pinned Actions
  SHAs, branch protection, etc.).
- Run **Publish Guardian** (or equivalent checklist) before first public
  push — same spirit as the dogfood site’s publication-safety ADR 002.

### Template / runtime

- Default CSP as strict as the dogfood site (`connect-src 'self'` when Fit is
  same-origin). Document any Turnstile exception as optional and costly.
- Fit dual quota + Request-more (ADR 011) in the module by default.
- Demo Fit index contains only demo corpus.
- Docs use `example.com` / `YOUR_ACCOUNT` — never production IDs.

### Optional later

- Cosign / SLSA provenance on release artifacts.
- npm provenance if publishing packages.
- Periodic `npm audit` / `pip-audit` in CI.

---

## 4. The private dogfood instance

Mirror the same hygiene where it already fits (secret scanning, Dependabot,
publication-safety). Do **not** publish personal `infra/` or production
Fit logs to show-your-work “for completeness.”

When Fit is live on the personal site, edge WAF / Bot Fight Mode /
application quota remain the production shields — independent of whether
show-your-work is public.

---

## 5. “Surface map” mitigation checklist

- [ ] No production hostnames, account IDs, or real binding IDs in show-your-work.  
- [ ] No copy of the dogfood site `infra/cloudflare/terraform` into show-your-work.  
- [ ] Demo persona clearly fake; no accidental real email/phone.  
- [ ] SECURITY.md + private reporting before public.  
- [ ] gitleaks clean history (or history rewrite if a secret ever landed).  
- [ ] Scorecard / CodeQL / Dependabot green enough to sleep.  
- [ ] Publish Guardian (or written checklist) signed off by the maintainer.

---

## 6. Principles

- **Boundary Discipline.** Template boundary ≠ production boundary.  
- **Laziness.** Reuse existing OSS security tooling; don’t invent a custom
  WAF product.  
- **Prove It Works.** Private → scanners green → public, not the reverse.
