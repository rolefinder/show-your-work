# ADR 010: Recruiter Fit — same-origin RAG, not training

**Status:** Accepted  
**Date:** 2026-07-09

## Context

Harrison wants a recruiter-facing tool: paste or upload a job description,
receive a structured fit brief with links into published `/work` and
`/writing` evidence. Earlier exploration considered training a micro/nano
LLM on site text (nanoGPT-style or a hosted “nano-gpt” API). The live site
is a static SPA on Cloudflare Pages with a strict CSP
(`connect-src 'self'`, no third-party scripts). There are no Pages
Functions today. The publishable corpus is small (~6–7k words of project
and post prose, plus About / `llms.txt`), skill-tagged, and already
exportable in rough form via `scripts/export-portfolio-corpus.py`.

A bio/chat bot that invents employers or stack depth is worse than no bot.
A JD-fit product is a **comparison** problem (requirements ↔ evidence),
which makes hallucination under fluent prose especially costly.

Product requirements and UX live in
[`docs/strategy/recruiter-fit-prd.md`](../../strategy/recruiter-fit-prd.md).
Quota and security are ADR 011 and ADR 012. Modular posts (writing
evidence) are ADR 013.

## Decision

1. **Architecture = retrieval-augmented generation behind a same-origin
   Pages Function**, not training from scratch and not fine-tuning as the
   knowledge path.
2. **Pipeline:** extract structured requirements from the JD → retrieve
   per requirement from an evidence index built from `visible` projects,
   posts, About, and approved summary fields → classify each requirement
   with citations → return the PRD output contract. Claims without
   retrieved evidence cannot be `aligned`.
3. **Inference host:** Cloudflare Workers AI (and Vectorize for embeddings)
   invoked only from the Worker/Pages Function so the browser keeps
   `connect-src 'self'`. No WebLLM / WASM path in v1 (would require
   `'wasm-unsafe-eval'` and model CDN allowlists).
4. **Optional later:** Worker-side proxy to an external model API if
   Workers AI quality is insufficient — still same-origin from the
   browser. Not required to start.
5. **Deterministic assist:** skill-tag / keyword overlay against the
   existing project `skills[]` inventory may pre-filter or backstop
   retrieval; it does not replace citation rules.
6. **Corpus ingest** runs at build or deploy from modular content
   (projects today; posts per ADR 013). Hidden (`visible: false`) and
   ADR 002-unsafe material never enters the index.

## Consequences

- Shipping Fit requires introducing Pages Functions (and AI/Vectorize
  bindings), which changes the cost/abuse model documented in
  `docs/ops/bot-and-cost-protection.md` (Functions were previously “none”).
- CSP stays strict for v1; no Hugging Face / OpenAI browser calls.
- Answers will often say `not_evidenced_on_site` for resume-shaped
  requirements (years, employers, Kubernetes, etc.). That is correct
  product behavior until a structured resume source exists.
- Eval fixtures (hand-labeled JDs) become a release gate for prompt or
  model changes.
- Training experiments remain allowed as offline demos; they are not the
  production Fit path.

## Alternatives considered

- **Train a tiny GPT on site text (nanoGPT / similar).** Rejected for
  production Fit. Corpus is far too small for reliable factual Q&A; the
  product needs requirement extraction and refusal, not next-token style
  mimicry.
- **Fine-tune a small instruct model on Q&A pairs as the sole knowledge
  store.** Rejected as v1 knowledge path. Fine-tuning is weak at injecting
  facts and hard to audit; may be revisited later for tone or “say
  missing” behavior only, still with RAG.
- **Browser-only WASM inference.** Rejected. Conflicts with CSP posture
  (ADR 007’s self-host rule is the precedent) and downloads large weights
  to visitors.
- **Third-party chat widget / browser `connect-src` to a model host.**
  Rejected. Breaks the site’s no-third-party CSP story and complicates
  secrets.
- **Static skill filter with no LLM.** Deferred as a degraded mode or
  abuse fallback; insufficient alone for detailed “why” prose recruiters
  want.
