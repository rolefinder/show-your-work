/**
 * Tenant-tunable Fit matcher config.
 * Core defaults are generic English + common tech synonyms — never person names.
 * Adopters pass extraStops / synonyms / weights from site config (see content/config/fit.yaml).
 */

export type FitScoreWeights = {
  /** Points when a term matches a published skill tag. */
  skill: number;
  /** Points when a term appears in doc body/summary text. */
  corpus: number;
  /** Points when a term appears in the doc title. */
  title: number;
  /** Minimum score to keep a hit. */
  minHit: number;
  /** Minimum top-hit score for status "aligned" (still requires ≥1 citation). */
  alignedMin: number;
  /** Minimum top-hit score for status "partial". */
  partialMin: number;
};

export type FitMatchConfig = {
  /** Extra stop tokens (e.g. demo persona first/last name). Merged with DEFAULT_STOP. */
  extraStops?: string[];
  /** Synonym map: token → expansions. Merged over DEFAULT_SYNONYMS (tenant wins on key clash). */
  synonyms?: Record<string, string[]>;
  /** Optional skill-weight multipliers: skill label (lowercased) → multiplier applied to skill hits. */
  skillWeights?: Record<string, number>;
  /** Scoring thresholds; omitted fields use DEFAULT_WEIGHTS. */
  weights?: Partial<FitScoreWeights>;
};

export const DEFAULT_STOP: ReadonlySet<string> = new Set([
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

/** Generic tech synonyms only — no tenant/person identity. */
export const DEFAULT_SYNONYMS: Readonly<Record<string, string[]>> = {
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

export const DEFAULT_WEIGHTS: FitScoreWeights = {
  skill: 14,
  corpus: 6,
  title: 8,
  minHit: 6,
  alignedMin: 20,
  partialMin: 10,
};

export function resolveWeights(cfg?: FitMatchConfig): FitScoreWeights {
  return { ...DEFAULT_WEIGHTS, ...(cfg?.weights || {}) };
}

export function resolveStopSet(cfg?: FitMatchConfig): Set<string> {
  const stops = new Set(DEFAULT_STOP);
  for (const t of cfg?.extraStops || []) {
    const s = String(t || "").toLowerCase().trim();
    if (s) stops.add(s);
  }
  return stops;
}

export function resolveSynonyms(cfg?: FitMatchConfig): Record<string, string[]> {
  return { ...DEFAULT_SYNONYMS, ...(cfg?.synonyms || {}) };
}
