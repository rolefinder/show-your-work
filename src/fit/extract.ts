import type { FitPriority } from "./types";

export type ExtractedRequirement = {
  text: string;
  priority: FitPriority;
};

const STOP = new Set([
  "a", "an", "the", "and", "or", "to", "of", "in", "on", "for", "with", "at",
  "by", "from", "as", "is", "are", "be", "been", "being", "this", "that",
  "these", "those", "we", "you", "our", "your", "their", "will", "can",
  "must", "should", "have", "has", "had", "do", "does", "did", "not",
  "experience", "experienced", "years", "year", "ability", "able", "strong",
  "working", "knowledge", "understanding", "familiarity", "proficient",
  "using", "use", "used", "including", "etc", "etc.", "role", "job",
  "position", "team", "company", "requirements", "responsibilities",
  "qualifications", "preferred", "required", "nice", "plus",
]);

/** Pull requirement-like lines from a JD. Deterministic, no LLM. */
export function extractRequirements(jd: string): ExtractedRequirement[] {
  const text = String(jd || "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const out: ExtractedRequirement[] = [];
  let section: FitPriority = "must";

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/^(requirements|must[- ]haves?|what you.?ll need|qualifications)\b/.test(lower)) {
      section = "must";
      continue;
    }
    if (/^(nice[- ]to[- ]haves?|preferred|bonus|plus)\b/.test(lower)) {
      section = "nice";
      continue;
    }
    if (/^(about (the )?(role|job|company)|responsibilities|what you.?ll do)\b/.test(lower)) {
      section = "soft";
      continue;
    }

    const bullet = line.replace(/^[-*•●]\s+/, "").replace(/^\d+[.)]\s+/, "").trim();
    if (bullet.length < 8) continue;
    if (bullet.length > 280) continue;
    // Skip pure title lines
    if (/^[A-Z][A-Za-z0-9 /|&,-]{3,60}$/.test(bullet) && !/\b(experience|ci\/cd|kubernetes|python|aws)\b/i.test(bullet)) {
      if (!/[.:,]/.test(bullet) && bullet.split(/\s+/).length <= 6) continue;
    }

    out.push({ text: bullet, priority: section });
  }

  // Fallback: sentence-split if no bullets found
  if (!out.length) {
    const sentences = text.split(/[.\n]+/).map((s) => s.trim()).filter((s) => s.length >= 12 && s.length <= 220);
    for (const s of sentences.slice(0, 12)) {
      out.push({ text: s, priority: "must" });
    }
  }

  return out.slice(0, 24);
}

export function tokenize(raw: string): string[] {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9+/#.\s-]/g, " ")
    .split(/[\s,/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

export function expandTerms(terms: string[]): string[] {
  const syn: Record<string, string[]> = {
    cicd: ["ci/cd", "ci", "cd", "github actions", "pipelines", "pipeline"],
    "ci/cd": ["cicd", "github actions", "pipelines", "pipeline", "continuous integration"],
    k8s: ["kubernetes"],
    kubernetes: ["kubernetes", "k8s"],
    iac: ["terraform", "infrastructure as code"],
    terraform: ["iac", "infrastructure as code"],
    js: ["javascript"],
    ts: ["typescript"],
    aws: ["amazon web services"],
  };
  const out = new Set<string>();
  for (const t of terms) {
    out.add(t);
    const key = t.replace(/\s+/g, " ");
    if (syn[key]) syn[key].forEach((s) => out.add(s));
  }
  return [...out];
}
