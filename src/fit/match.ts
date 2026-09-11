import { extractRequirements } from "./extract";
import { retrieveEvidence } from "./index";
import type { FitMatchConfig } from "./config";
import { CAVEAT_DURATION, resolveCaveats, resolveWeights, showGaps } from "./config";
import type { EvidenceDoc, FitBrief, FitEvidence, FitRequirement, FitStatus } from "./types";

/**
 * Deterministic Fit matcher.
 * Hard rule: status "aligned" requires ≥1 citation, and a bare skill label is
 * not a citation — see QUOTE_KIND in ./index and F1 in
 * docs/strategy/candidate-legibility-2026-08.md.
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
  let durationSeen = false;

  for (const req of requirements) {
    const hits = retrieveEvidence(req.text, docs, cfg);
    // A hit whose only quote is the skill tag itself is lexical overlap, not
    // evidence. It still scores, so such a row can reach `partial` — which is
    // the honest verdict: the skill is genuinely tagged, and nothing published
    // says anything about it.
    const cited = hits.filter((h) => h.quote_kind !== "label");
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
    } else if (hits[0].score >= weights.alignedMin && cited.length >= 1) {
      status = "aligned";
      why = `Matched published evidence (${cited[0].doc.title}).`;
    } else if (hits[0].score >= weights.partialMin) {
      status = "partial";
      why = `Partial overlap with ${hits[0].doc.title}; depth not fully evidenced.`;
    } else {
      status = "missing";
      why = "Only weak lexical overlap; treat as gap until stronger evidence exists.";
      gaps.push(req.text);
    }

    // Hard rule, restated as a guard: aligned requires a real citation.
    if (status === "aligned" && (evidence.length < 1 || cited.length < 1)) {
      status = "not_evidenced_on_site";
      why = "Aligned claims require at least one citation.";
    }

    /* A cited row answering a "5+ years" requirement is telling the truth about
       the SUBSTANCE and saying nothing about the TIME. Left alone it reads as
       if both had been checked. The status is deliberately not downgraded —
       that would invent a false negative for someone who does meet the
       duration, and they would have no way to correct it. The row says what
       was and was not evaluated instead. ADR 033. */
    const duration = statesDuration(req.text);
    if (duration && (status === "aligned" || status === "partial")) {
      why += ` Matched on substance only — "${duration}" is a length of time, which this matcher does not evaluate.`;
      durationSeen = true;
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
    /* Said once at the top as well as on each row: a reader who scans the
       verdict column and skips the reasons should still not come away thinking
       a duration was verified. */
    caveats: durationSeen
      ? [...resolveCaveats(cfg), CAVEAT_DURATION]
      : resolveCaveats(cfg),
  };
}

/**
 * The length-of-experience phrase in a requirement, if it states one.
 *
 * `DEFAULT_STOP` drops `years`, `year`, `experience` and `experienced` as noise
 * — correctly, for scoring: they carry no topic. The side effect is that "5+
 * years building delivery pipelines" scores exactly like "building delivery
 * pipelines", so one project about pipelines can answer it with a real
 * citation, against a requirement the author may not meet.
 *
 * The matcher cannot fix that, and this deliberately does not pretend
 * otherwise. `experience.start`/`end` are free text that ADR 027 promises never
 * to parse ("the template never parses or reformats a date it did not
 * generate"), so there is no reliable total to compare against. What the
 * matcher CAN do is stop letting the row read as if the duration had been
 * checked. See ADR 033.
 *
 * Returns the phrase itself, so the brief can quote the author's own words back
 * rather than paraphrasing a range it did not parse.
 */
const NUMBER_WORD = "one|two|three|four|five|six|seven|eight|nine|ten";
const DURATION = new RegExp(
  String.raw`\b(?:(?:\d{1,2}\s*(?:\+|-|–|\s+to\s+)?\s*\d{0,2}|${NUMBER_WORD})\s*\+?\s*(?:years?|yrs?\.?|months?)|a\s+decade)\b`,
  "i",
);

export function statesDuration(text: string): string {
  const m = DURATION.exec(String(text || ""));
  return m ? m[0].replace(/\s+/g, " ").trim() : "";
}

function inferRoleRead(jd: string): string {
  const first = String(jd || "").split(/\n/).map((l) => l.trim()).find(Boolean) || "";
  if (first.length >= 8 && first.length <= 120) return first;
  const m = String(jd || "").match(/\b([A-Z][A-Za-z0-9+/#. &-]{2,60}(?:Engineer|Developer|Architect|Manager|Lead|SRE))\b/);
  return m ? m[1] : "Role from pasted job description";
}
