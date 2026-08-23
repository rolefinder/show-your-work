import type { EvidenceDoc } from "./types";
import type { FitMatchConfig } from "./config";
import { resolveWeights } from "./config";
import { expandTerms, tokenize } from "./extract";

/**
 * Where a hit's quote came from, best first.
 *
 * `label` means the skill tag itself was echoed back, because the adopter
 * wrote no `skill_notes` entry for it and no prose on the page matched. That
 * is not a citation — it is the requirement restated — so match.ts refuses to
 * let a label-only hit carry `aligned`. See F1 in
 * docs/strategy/candidate-legibility-2026-08.md.
 */
export type QuoteKind = "claim" | "skill_note" | "snippet" | "label";

export type ScoredHit = {
  doc: EvidenceDoc;
  score: number;
  quote_or_skill: string;
  quote_kind: QuoteKind;
};

/** Score evidence docs against requirement terms (evidence index lookup). */
export function retrieveEvidence(
  reqText: string,
  docs: EvidenceDoc[],
  cfg?: FitMatchConfig,
): ScoredHit[] {
  const terms = expandTerms(tokenize(reqText, cfg), cfg);
  if (!terms.length) return [];

  const weights = resolveWeights(cfg);
  const skillWeights = cfg?.skillWeights || {};
  const hits: ScoredHit[] = [];

  for (const doc of docs) {
    const corpus = doc.text.toLowerCase();
    const skillLc = doc.skills.map((s) => s.toLowerCase());
    let score = 0;

    // Quote preference, best first: a whole authored claim (outcome, evidence
    // or decision bullet) reads as a citation; an authored skill note is a
    // sentence about this skill on this page; a text window is a real but
    // truncated fragment. The bare label ranks last and is not a citation at
    // all — it is the skill tag echoed back at the reader.
    let claimQuote = "";
    let skillNoteQuote = "";
    let snippetQuote = "";
    let labelQuote = "";

    for (const term of terms) {
      const skillMatch = doc.skills.find((s) => {
        const sl = s.toLowerCase();
        return sl === term || sl.includes(term) || term.includes(sl);
      });
      if (skillMatch) {
        const mult = skillWeights[skillMatch.toLowerCase()] ?? 1;
        score += weights.skill * mult;
        // "Delivery runs through merge gates…" is evidence; "CI/CD" is a
        // label. Keep them apart: only the note is quotable as a citation.
        //
        // An authored note also SCORES, and that is what makes the authoring
        // contract true — writing one is the thing that turns a tag into an
        // aligned claim. A tagged skill alone reaches `skill` (14), short of
        // alignedMin (20); backed by a note it reaches 20. The points are for
        // the note existing, not for it happening to repeat the requirement's
        // wording: a note reading "every content shape is a compile error" is
        // evidence for `TypeScript` whether or not it says "TypeScript".
        const note = doc.skillNotes?.[skillMatch];
        if (note) {
          score += weights.corpus;
          if (!skillNoteQuote) skillNoteQuote = note;
        }
        if (!labelQuote) labelQuote = skillMatch;
      }
      if (!claimQuote) {
        const claim = (doc.claims || []).find((c) => containsTerm(c, term));
        if (claim) claimQuote = claim;
      }
      if (corpus.includes(term)) {
        score += weights.corpus;
        if (!snippetQuote) snippetQuote = snippetAround(doc.text, term);
      }
      if (doc.title.toLowerCase().includes(term)) score += weights.title;
    }

    let quote = "";
    let quote_kind: QuoteKind = "label";
    if (claimQuote) { quote = claimQuote; quote_kind = "claim"; }
    else if (skillNoteQuote) { quote = skillNoteQuote; quote_kind = "skill_note"; }
    else if (snippetQuote) { quote = snippetQuote; quote_kind = "snippet"; }
    else { quote = labelQuote || doc.skills[0] || doc.title; quote_kind = "label"; }

    if (score >= weights.minHit) {
      hits.push({ doc, score, quote_or_skill: quote, quote_kind });
    }
  }

  hits.sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title));
  return hits.slice(0, 5);
}

/**
 * Whole-token containment, for picking a claim to QUOTE.
 *
 * A bare `includes` lets a two-letter token like "ci" (tokenize splits
 * "CI/CD") match inside "decisions", "efficiency" or "specific". Because a
 * claim is preferred over every other quote source, one spurious match
 * outranks a genuinely relevant skill note — so the citation shown to a
 * recruiter would be an unrelated sentence.
 *
 * Boundaries are non-word-character lookarounds rather than \b, so terms that
 * themselves contain punctuation ("ci/cd", "node.js") still match correctly.
 * Scoring deliberately still uses substring matching; changing that would move
 * every threshold in DEFAULT_WEIGHTS.
 */
export function containsTerm(haystack: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return new RegExp(`(^|[^\\w])${escaped}($|[^\\w])`, "i").test(haystack);
}

function snippetAround(text: string, term: string): string {
  const lc = text.toLowerCase();
  const i = lc.indexOf(term.toLowerCase());
  if (i < 0) return text.slice(0, 100).trim();
  const start = Math.max(0, i - 40);
  const end = Math.min(text.length, i + term.length + 60);
  return ((start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "")).slice(0, 160);
}
