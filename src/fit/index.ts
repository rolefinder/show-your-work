import type { EvidenceDoc } from "./types";
import { expandTerms, tokenize } from "./extract";

export type ScoredHit = {
  doc: EvidenceDoc;
  score: number;
  quote_or_skill: string;
};

/** Score evidence docs against requirement terms (evidence index lookup). */
export function retrieveEvidence(reqText: string, docs: EvidenceDoc[]): ScoredHit[] {
  const terms = expandTerms(tokenize(reqText));
  if (!terms.length) return [];

  const hits: ScoredHit[] = [];
  for (const doc of docs) {
    const corpus = doc.text.toLowerCase();
    const skillLc = doc.skills.map((s) => s.toLowerCase());
    let score = 0;
    let quote = "";

    for (const term of terms) {
      if (skillLc.some((s) => s === term || s.includes(term) || term.includes(s))) {
        score += 14;
        if (!quote) {
          const sk = doc.skills.find((s) => {
            const sl = s.toLowerCase();
            return sl === term || sl.includes(term) || term.includes(sl);
          });
          quote = sk || term;
        }
      }
      if (corpus.includes(term)) {
        score += 6;
        if (!quote) quote = snippetAround(doc.text, term);
      }
      if (doc.title.toLowerCase().includes(term)) score += 8;
    }

    if (score >= 6) {
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
