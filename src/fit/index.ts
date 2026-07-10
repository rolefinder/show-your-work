import type { EvidenceDoc } from "./types";
import type { FitMatchConfig } from "./config";
import { resolveWeights } from "./config";
import { expandTerms, tokenize } from "./extract";

export type ScoredHit = {
  doc: EvidenceDoc;
  score: number;
  quote_or_skill: string;
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
    let quote = "";

    for (const term of terms) {
      const skillMatch = doc.skills.find((s) => {
        const sl = s.toLowerCase();
        return sl === term || sl.includes(term) || term.includes(sl);
      });
      if (skillMatch) {
        const mult = skillWeights[skillMatch.toLowerCase()] ?? 1;
        score += weights.skill * mult;
        if (!quote) quote = skillMatch;
      }
      if (corpus.includes(term)) {
        score += weights.corpus;
        if (!quote) quote = snippetAround(doc.text, term);
      }
      if (doc.title.toLowerCase().includes(term)) score += weights.title;
    }

    if (score >= weights.minHit) {
      hits.push({
        doc,
        score,
        quote_or_skill: quote || doc.skills[0] || doc.title,
      });
    }
  }

  hits.sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title));
  return hits.slice(0, 5);
}

function snippetAround(text: string, term: string): string {
  const lc = text.toLowerCase();
  const i = lc.indexOf(term.toLowerCase());
  if (i < 0) return text.slice(0, 100).trim();
  const start = Math.max(0, i - 40);
  const end = Math.min(text.length, i + term.length + 60);
  return ((start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "")).slice(0, 160);
}
