import { extractRequirements } from "./extract";
import { retrieveEvidence } from "./index";
import type { FitMatchConfig } from "./config";
import { resolveCaveats, resolveWeights, showGaps } from "./config";
import type { EvidenceDoc, FitBrief, FitEvidence, FitRequirement, FitStatus } from "./types";

/**
 * Deterministic Fit matcher.
 * Hard rule: status "aligned" requires ≥1 citation.
 * Optional cfg: tenant synonyms, extraStops, skillWeights, score thresholds.
 */
export function matchFit(jd: string, docs: EvidenceDoc[], cfg?: FitMatchConfig): FitBrief {
  const requirements = extractRequirements(jd);
  const role_read = inferRoleRead(jd);
  const weights = resolveWeights(cfg);
  const mapped: FitRequirement[] = [];
  const strongest: FitEvidence[] = [];
  const gaps: string[] = [];
  const seenUrls = new Set<string>();

  for (const req of requirements) {
    const hits = retrieveEvidence(req.text, docs, cfg);
    let status: FitStatus;
    let why: string;
    const evidence: FitEvidence[] = hits.slice(0, 3).map((h) => ({
      title: h.doc.title,
      url: h.doc.url,
      quote_or_skill: h.quote_or_skill,
    }));

    if (hits.length === 0) {
      status = "not_evidenced_on_site";
      why = "No published site evidence matched this requirement.";
      gaps.push(req.text);
    } else if (hits[0].score >= weights.alignedMin && evidence.length >= 1) {
      status = "aligned";
      why = `Matched published evidence (${hits[0].doc.title}).`;
    } else if (hits[0].score >= weights.partialMin) {
      status = "partial";
      why = `Partial overlap with ${hits[0].doc.title}; depth not fully evidenced.`;
    } else {
      status = "missing";
      why = "Only weak lexical overlap; treat as gap until stronger evidence exists.";
      gaps.push(req.text);
    }

    // Hard rule: aligned requires ≥1 citation
    if (status === "aligned" && evidence.length < 1) {
      status = "not_evidenced_on_site";
      why = "Aligned claims require at least one citation.";
    }

    mapped.push({
      text: req.text,
      priority: req.priority,
      status,
      why,
      evidence: status === "aligned" || status === "partial" ? evidence : [],
    });

    for (const e of evidence) {
      if (!seenUrls.has(e.url)) {
        seenUrls.add(e.url);
        strongest.push(e);
      }
    }
  }

  /*
   * Every requirement above was evaluated; this decides what the brief SHOWS.
   * In highlight mode (the default) it presents only what published work
   * covers — `missing` and `not_evidenced_on_site` are both dequalifying
   * verdicts, and both feed the Gaps list, so all three go together. The
   * caveats shift with the mode so the brief never reads as a full audit while
   * omitting rows.
   *
   * Note this is a DISPLAY filter, deliberately not a change to extraction:
   * silently dropping requirements before evaluation is a real bug that was
   * fixed in extract.ts, and re-introducing it here would also skew the
   * scoring the surviving rows are ranked by.
   */
  const audit = showGaps(cfg);
  const visible = audit
    ? mapped
    : mapped.filter((r) => r.status === "aligned" || r.status === "partial");

  return {
    role_read,
    requirements: visible,
    strongest_matches: strongest.slice(0, 6),
    gaps: audit ? [...new Set(gaps)].slice(0, 12) : [],
    caveats: resolveCaveats(cfg),
  };
}

function inferRoleRead(jd: string): string {
  const first = String(jd || "").split(/\n/).map((l) => l.trim()).find(Boolean) || "";
  if (first.length >= 8 && first.length <= 120) return first;
  const m = String(jd || "").match(/\b([A-Z][A-Za-z0-9+/#. &-]{2,60}(?:Engineer|Developer|Architect|Manager|Lead|SRE))\b/);
  return m ? m[1] : "Role from pasted job description";
}
