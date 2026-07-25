# recruit-me — security posture

**Status:** Draft  
**Date:** 2026-07-09  
**Owner:** Harrison Halperin  

Companion to [`recruit-me-prd.md`](./recruit-me-prd.md). Addresses the concern:
“Open-sourcing this gives attackers a surface map to hijack my site.”

---

## 1. Separation (the load-bearing control)

| Asset | Where it lives | Public? |
|-------|----------------|---------|
| Template app, Fit module, ingest skills, demo corpus | `hhalperin/recruit-me` | Private → public |
| Real portfolio content, production Fit, personal ops | `hhalperin/harrison-site` (+ CF account) | **Stays private** |
| Cloudflare tokens, AI bindings, JD retention store | Account secrets / private stores | **Never in git** |
| Personal Terraform / zone IDs / production hostnames | harrison-site `infra/` | **Private** — not copied into recruit-me docs |

Attackers who clone recruit-me get a **generic** free-tier template and a
**fake** persona corpus. They do **not** get Harrison’s content, bindings,
or account map.

Dogfood Fit on private harrison-site. Public recruit-me ships demo data only.

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
anyone who loads harrisonhalperin.com. “Surface map” of the *production*
instance is largely already public. OSS of a *separate* template does not
magically grant write access to Cloudflare.

### Real risks to manage

1. **Secret leak** into recruit-me git history (tokens in examples).  
2. **Dependency RCE** in build/Fit Worker deps.  
3. **Prototype pollution / XSS** in template JS if CSP is weakened.  
4. **Fit abuse** on adopter deploys (and on harrison-site when Fit ships).  
5. **Confused docs** that paste production hostnames or real account IDs.  
6. **Supply chain** if adopters install a compromised release.

OSS done well **helps defenders** (many eyes, automated scanners, Scorecard)
more than it helps attackers — *if* production stays separated and secrets
stay out.

---

## 3. Controls before flipping recruit-me public

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
  push — same spirit as harrison-site’s publication-safety ADR 002.

### Template / runtime

- Default CSP as strict as harrison-site (`connect-src 'self'` when Fit is
  same-origin). Document any Turnstile exception as optional and costly.
- Fit dual quota + Request-more (ADR 011) in the module by default.
- Demo Fit index contains only demo corpus.
- Docs use `example.com` / `YOUR_ACCOUNT` — never production IDs.

### Optional later

- Cosign / SLSA provenance on release artifacts.
- npm provenance if publishing packages.
- Periodic `npm audit` / `pip-audit` in CI.

---

## 4. harrison-site (private dogfood)

Mirror the same hygiene where it already fits (secret scanning, Dependabot,
publication-safety). Do **not** publish personal `infra/` or production
Fit logs to recruit-me “for completeness.”

When Fit is live on the personal site, edge WAF / Bot Fight Mode /
application quota remain the production shields — independent of whether
recruit-me is public.

---

## 5. “Surface map” mitigation checklist

- [ ] No production hostnames, account IDs, or real binding IDs in recruit-me.  
- [ ] No copy of harrison-site `infra/cloudflare/terraform` into recruit-me.  
- [ ] Demo persona clearly fake; no accidental real email/phone.  
- [ ] SECURITY.md + private reporting before public.  
- [ ] gitleaks clean history (or history rewrite if a secret ever landed).  
- [ ] Scorecard / CodeQL / Dependabot green enough to sleep.  
- [ ] Publish Guardian (or written checklist) signed off by Harrison.

---

## 6. Principles

- **Boundary Discipline.** Template boundary ≠ production boundary.  
- **Laziness.** Reuse existing OSS security tooling; don’t invent a custom
  WAF product.  
- **Prove It Works.** Private → scanners green → public, not the reverse.
