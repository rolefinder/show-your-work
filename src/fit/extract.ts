import type { FitPriority } from "./types";
import {
  type FitMatchConfig,
  resolveStopSet,
  resolveSynonyms,
} from "./config";

export type ExtractedRequirement = {
  text: string;
  priority: FitPriority;
};

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

export function tokenize(raw: string, cfg?: FitMatchConfig): string[] {
  const stops = resolveStopSet(cfg);
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9+/#.\s-]/g, " ")
    .split(/[\s,/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !stops.has(t));
}

export function expandTerms(terms: string[], cfg?: FitMatchConfig): string[] {
  const syn = resolveSynonyms(cfg);
  const out = new Set<string>();
  for (const t of terms) {
    out.add(t);
    const key = t.replace(/\s+/g, " ");
    if (syn[key]) syn[key].forEach((s) => out.add(s));
  }
  return [...out];
}
