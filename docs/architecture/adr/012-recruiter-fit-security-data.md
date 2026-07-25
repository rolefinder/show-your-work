# ADR 012: Recruiter Fit — inputs, security, and data retention

**Status:** Accepted  
**Date:** 2026-07-09

## Context

Fit accepts arbitrary recruiter text and files. That input is untrusted:
prompt injection, oversized payloads, malicious PDFs, and pasted secrets
are in scope. Harrison also wants inputs and responses stored so briefs
can be reviewed and abuse investigated. The site’s baseline is a strict
CSP, publication-safety scanning (ADR 002), and no third-party analytics
scripts. Introducing a Function changes the threat model in
`docs/ops/bot-and-cost-protection.md` (Functions and AI usage become the
metered surface).

Product rules: [`docs/strategy/recruiter-fit-prd.md`](../../strategy/recruiter-fit-prd.md).
Architecture: ADR 010. Quota: ADR 011.

## Decision

### 1. Trust boundary

- Browser → same-origin `POST /api/fit` (and related routes) only.
- Worker validates content-type, size, quota, and authn-of-quota-identity
  **before** any model or Vectorize call.
- JD text is **untrusted data**, never instructions. System prompts state
  that JD content must not override citation rules, exfiltrate bindings,
  or fetch URLs.
- Retrieval corpus is **only** published, `visible` portfolio evidence
  (plus About / approved summaries). No private resume unless a future
  explicit public content file is added.

### 2. Input channels

| Channel | v1 rule |
|---------|---------|
| Paste | Max ~12k characters after normalize; strip nulls; reject empty |
| File | `.txt`, `.md`, `.pdf` only; max **1 MB** |
| `.docx` | Deferred |
| URL fetch | **Rejected** (SSRF / abuse) |

PDF text extraction runs in the Worker (or a Worker-compatible library).
Do not render JD HTML. Do not follow links inside the JD for retrieval or
egress.

### 3. Prompt-injection and output guardrails

- Model may only ground `aligned` / `partial` in retrieved chunks.
- Empty retrieval ⇒ `missing` or `not_evidenced_on_site`, never `aligned`.
- Strip or ignore JD directives such as “ignore previous instructions,”
  “reveal system prompt,” or “fetch https://…”.
- Responses must not include Cloudflare secrets, env bindings, or other
  users’ stored JDs.
- Publication-safety: index build excludes ADR 002 internal patterns and
  hidden projects/posts.

### 4. Storage

Store enough to debug product quality and abuse:

- `request_id`, timestamps, quota identity key (hashed), route version
- Model ids used (Fit + Request-more)
- JD: truncated plaintext and/or object key if stored in R2; prefer
  **R2 for large PDFs**, KV/D1 metadata row for the rest
- Full structured Fit JSON response
- Request-more verdict + reason
- Optional: embedding/retrieval debug ids (not required in v1)

**Retention:** default **90 days**, then delete or anonymize. Harrison may
shorten via config. No sale of JD data. No sending JD corpora to
third-party training APIs beyond the inference provider needed to serve
the request.

Access: Harrison (and automated ops he enables) only. No public list of
past briefs.

### 5. Abuse controls (stack)

- Application quota (ADR 011)
- Existing zone WAF / Bot Fight Mode / edge rate limit where applicable
- Optional **Turnstile** on submit after abuse appears (requires CSP
  `challenges.cloudflare.com` — deferred until needed, consistent with
  `bot-and-cost-protection.md`)
- Max concurrent in-flight Fit per identity = 1

### 6. Logging hygiene

Do not log raw JD bodies to third-party log drains by default. Prefer
structured logs with request id + sizes + status; bodies live in the
retention store above.

## Consequences

- Fit cannot ship as a pure static page; Functions + storage bindings are
  mandatory.
- Ops docs and Terraform notes must be updated when Functions/AI are
  enabled (human-applied where tokens require it).
- PDF support adds parser complexity and a malware/DoS surface; size caps
  and timeouts are mandatory.
- Stored JDs may contain personal data about candidates or companies;
  treat as sensitive operational data even though the portfolio answers
  only cite public site text.
- Recruiters should be told on `/fit` that submissions may be stored for
  quality and abuse prevention (short notice in UI).

## Alternatives considered

- **Store nothing.** Rejected. Blocks quality review and forensics
  Harrison asked for.
- **Store forever.** Rejected. Unnecessary retention risk.
- **Client-only PDF parse.** Rejected as sole path. Inconsistent across
  browsers; still must re-validate on server.
- **Allow URL paste of JD links.** Rejected for v1 SSRF and content-type
  chaos.
- **Accept `.docx` in v1.** Deferred. Extra attack surface and deps for
  little gain over PDF/TXT.
- **Widen CSP for Turnstile on day one.** Deferred until abuse justifies
  the first third-party script exception.
