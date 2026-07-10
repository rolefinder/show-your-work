# Bot protection & cost control ΓÇö harrisonhalperin.com

Assessment and right-sized mitigation plan for a static Cloudflare Pages personal site.
Companion Terraform: `infra/cloudflare/terraform/security.tf`. Human-only steps: see
[checklist](#human-apply-checklist) at the bottom.

> **Dependency:** a prior session hit Cloudflare API token verify failures and a possibly
> pending NS/DNSSEC cutover. Until the token is fixed and the zone is fully active on
> Cloudflare nameservers, nothing here can be applied ΓÇö Terraform or dashboard. Treat all
> live changes as human-applied.

## 1. Threat / cost model

What actually costs money for this site:

| Vector | Exposure | Why |
|---|---|---|
| Bandwidth / static requests | **None** | Cloudflare Pages includes unlimited bandwidth and unlimited static-asset requests on the free plan. Bots downloading the site all day cost $0. |
| Pages Functions / Workers invocations | **None today** | The site has no Functions. If one is ever added, every request can invoke it and the 100k/day free quota becomes the pressure point. |
| Workers AI / Vectorize (planned Recruiter Fit) | **None today; planned** | [`docs/strategy/recruiter-fit-prd.md`](../strategy/recruiter-fit-prd.md) + ADR 010ΓÇô012 introduce same-origin `/api/fit`. Neuron/Vectorize spend becomes the metered risk; dual query caps (2/day **and** 10/week) and Request-more cooldown are mandatory before public launch. Update this table when Functions ship. |
| Pages builds | Negligible | 500 builds/month free; builds are triggered by git pushes, not visitors. Bots can't burn this. |
| DDoS | **None (cost), low (availability)** | Cloudflare's L3/4/7 DDoS protection is unmetered on all plans. Worst case is degraded availability, not a bill. |
| Malicious crawlers / scrapers | Nuisance only | Content is public portfolio material. Scraping costs nothing (see bandwidth row); the harm is log noise and, if you care, AI training use. |
| Plan upgrades | The real risk | The only way this site starts costing money is deliberately upgrading (Pro $20+/mo, Workers Paid $5/mo, Bot Management add-on). No bot can force that. |

**Bottom line:** on the current setup there is no metered resource a bot can run up.
The proportionate goal is hygiene (cut junk traffic, keep probe noise out of analytics)
and guardrails for the day a Function or paid product is added ΓÇö not an enterprise WAF.

## 2. Recommended mitigations

### Baseline (all free ΓÇö do these)

| Mitigation | Mechanism | IaC? |
|---|---|---|
| Bot Fight Mode | Challenges definitely-automated traffic zone-wide. Free-plan toggle. | Yes ΓÇö `cloudflare_bot_management.fight_mode` in `security.tf` (needs token scope *Zone ΓåÆ Bot Management ΓåÆ Edit*; otherwise dashboard toggle). |
| Rate-limiting rule (1 free) | Blocks an IP exceeding 300 req/10s, excluding verified bots (Googlebot etc.). Free plan fixes period and timeout at 10s and action at block. | Yes ΓÇö `cloudflare_ruleset.zone_rate_limit`. |
| WAF custom rule: block scanner probes | Blocks `/wp-login.php`, `/xmlrpc.php`, `/.env`, `/.git/ΓÇª` and similar paths that only vuln scanners request. Uses 1 of 5 free custom rules. | Yes ΓÇö `cloudflare_ruleset.zone_waf_custom`. |
| Free Managed Ruleset | Cloudflare's free managed WAF ruleset (high-confidence CVE mitigations) runs automatically on all free zones. | Nothing to do. |
| DDoS protection | Always on, unmetered, all plans. | Nothing to do. |
| Billing / usage notifications | Email alert if any paid product ever starts accruing usage. | No ΓÇö dashboard only (checklist). |

### Optional hardening (still free, off by default)

- **Block AI crawlers** ΓÇö `ai_bots_protection = "block"` on the bot-management resource
  (commented in `security.tf`). Left off because AI visibility is arguably *desirable*
  for a personal-brand site and AI crawlers cost nothing here.
- **Zone Cache Rule for long-lived assets** ΓÇö commented in `security.tf`. Pages already
  serves through Cloudflare's CDN and invalidates on deploy; a zone-level cache-everything
  rule can serve stale HTML after deploys. Only worth revisiting if origin-hit metrics
  ever matter (they don't on Pages free).
- **JavaScript Detections (`enable_js`)** ΓÇö improves bot classification but injects a
  script into HTML pages, which the site's strict CSP (`script-src 'self'`, no nonces in
  `_headers`) may block. Left disabled; enable only after verifying against the CSP.

### Paid tiers ΓÇö explicitly not recommended

- **Super Bot Fight Mode** (Pro, $20+/mo): adds likely-automated classification and
  static-resource protection. Not worth $240/yr to protect free bandwidth.
- **Full managed WAF rulesets / OWASP** (Pro+): there is no application behind this site
  to exploit ΓÇö it's static files. The free managed ruleset is sufficient.
- **Bot Management** (Enterprise): no.

## 3. Turnstile: N/A (today)

Checked `app.jsx` and `index.html` (production surface) ΓÇö there are **no forms** and no
user input anywhere; contact is a `mailto:` link and external profile links. Turnstile
protects interactive endpoints (form submissions, logins, APIs) from automation. With
nothing to submit, there is nothing for it to gate.

**Planned exception:** Recruiter Fit (`/fit` + Pages Function) will accept JD paste/upload.
ADR 012 defers Turnstile until abuse appears because it requires allowing
`challenges.cloudflare.com` in the CSP. Application-level dual quota (ADR 011) ships
first; Turnstile + endpoint rate limits become the escalation baseline when Fit is live.

## 4. What's in Terraform vs. human-applied

**Terraform (`infra/cloudflare/terraform/security.tf`):**

- `cloudflare_bot_management.main` ΓÇö Bot Fight Mode on.
- `cloudflare_ruleset.zone_rate_limit` ΓÇö the single free rate-limiting rule.
- `cloudflare_ruleset.zone_waf_custom` ΓÇö scanner-probe block rule.
- Commented, ready to uncomment: AI-crawler block, cache rule.

Applying requires the API token to gain two scopes beyond the current DNS/Settings/Pages
set: **Zone ΓåÆ Zone WAF ΓåÆ Edit** (rulesets) and **Zone ΓåÆ Bot Management ΓåÆ Edit**.

**Human-applied (can't or shouldn't be IaC'd on this plan):** see checklist below.

## Human-apply checklist

Prerequisites: fix the Cloudflare API token (verify failures in prior session) and
confirm NS/DNSSEC cutover is complete (zone "Active" in dashboard).

1. **Re-scope the API token** ΓÇö add *Zone ΓåÆ Zone WAF ΓåÆ Edit* and *Zone ΓåÆ Bot Management ΓåÆ
   Edit* so Terraform can own `security.tf`. Alternatively skip and do steps 2ΓÇô3 by hand.
2. **Bot Fight Mode** ΓÇö Security ΓåÆ Bots ΓåÆ toggle *Bot Fight Mode* on (only if not
   applying `security.tf` via Terraform).
3. **Verify rate-limit + WAF rules** after `terraform apply` ΓÇö Security ΓåÆ WAF ΓåÆ
   Rate limiting rules / Custom rules should each show one rule.
4. **Billing notifications** ΓÇö Manage Account ΓåÆ Notifications ΓåÆ add *Usage Based Billing*
   and *Billing* email notifications. This is the actual cost tripwire: it fires only if
   a paid product ever starts metering, which is the only way this site can cost money.
5. **(Optional) Security Events review** ΓÇö after a week, check Security ΓåÆ Events to
   confirm the rules are catching probe traffic and not challenging real visitors.
