import type {
  BlogPost,
  EducationItem,
  EvidenceDoc,
  ExperienceItem,
  SiteProfile,
  WorkItem,
} from "../types";
import { bodyText } from "../content/bodyText";

/*
 * Skills are deliberately NOT joined into `text`.
 *
 * They already have their own, heavier match path (weights.skill), so putting
 * them in the corpus text too counted them twice: one tagged skill scored
 * skill + corpus = 20, which alone reached alignedMin. Worse, the corpus hit
 * manufactured a citation — `snippetAround` would return a window into the
 * skill list itself, so a requirement could come back `aligned` quoting
 * "…TypeScript Kubernetes". That is the F1 defect wearing a different hat: the
 * tag echoed back, dressed as prose.
 *
 * `text` is what can be QUOTED as well as what scores, so it holds prose only.
 */

/** Build a flat evidence pack from site content (visible only). */
export function buildEvidencePack(
  profile: SiteProfile,
  work: WorkItem[],
  blog: BlogPost[],
  experience: ExperienceItem[] = [],
  education: EducationItem[] = [],
): EvidenceDoc[] {
  const docs: EvidenceDoc[] = [
    {
      id: "about",
      kind: "about",
      title: `${profile.name} — About`,
      url: "/about",
      text: [profile.summary, profile.tagline].join(" "),
      skills: profile.skills.slice(),
    },
  ];

  for (const w of work) {
    if (w.visible === false) continue;
    // Outcome, evidence and decision bullets are already whole, self-contained
    // statements — exactly what a citation should be — so they are carried
    // separately from the flattened text and preferred as quotes. `decisions`
    // used to score (it was in `text`) but could never be quoted, so the
    // best-reasoned sentence on a project page was only ever citable as a
    // truncated window.
    const claims = [w.outcome, ...(w.evidence || []), ...(w.decisions || [])]
      .map((c) => String(c || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    docs.push({
      id: `work:${w.slug}`,
      kind: "work",
      title: w.title,
      url: `/work/${w.slug}`,
      text: [w.title, w.summary, bodyText(w.body), w.problem, ...claims]
        .filter(Boolean)
        .join(" "),
      skills: w.skills.slice(),
      claims,
      skillNotes: w.skillNotes,
    });
  }

  for (const b of blog) {
    if (b.visible === false) continue;
    docs.push({
      id: `blog:${b.slug}`,
      kind: "blog",
      title: b.title,
      url: `/blog/${b.slug}`,
      text: [b.title, b.summary, bodyText(b.body)].join(" "),
      skills: b.skills.slice(),
    });
  }

  // Roles last, and they matter: a JD asking for "N years doing X" is answered
  // by employment history, not by a project page. Highlights are already whole
  // authored statements, so they become claims — the same treatment work's
  // outcome and evidence bullets get, for the same reason.
  for (const e of experience) {
    if (e.visible === false) continue;
    const claims = e.highlights
      .map((h) => String(h || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    docs.push({
      id: `experience:${e.slug}`,
      kind: "experience",
      title: `${e.role} — ${e.organization}`,
      url: `/experience#${e.slug}`,
      text: [e.role, e.organization, e.summary, ...claims]
        .filter(Boolean)
        .join(" "),
      skills: e.skills.slice(),
      claims,
    });
  }

  // Education last, and narrowly: only `achievements`.
  //
  // ADR 027 kept education out of the pack over degree-name collisions, and
  // that objection is upheld here rather than revisited — "BS, Information
  // Systems" would hit a third of the postings in the industry on eight points
  // of title weight alone. So the credential names the citation and matches
  // nothing (`titleText: ""`), the institution never enters the text at all,
  // and the only matchable content is the achievement bullets.
  //
  // Those are whole authored sentences — "Capstone built a content pipeline a
  // department actually used" is structurally a work `evidence` bullet that
  // happens to live on a degree — so they are claims, and a coursework
  // citation is finally possible without the collision the ADR refused.
  for (const e of education) {
    if (e.visible === false) continue;
    const claims = e.achievements
      .map((a) => String(a || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (!claims.length) continue; // nothing citable; a bare degree line is not evidence
    docs.push({
      id: `education:${e.slug}`,
      kind: "education",
      title: e.credential,
      titleText: "",
      url: `/experience#${e.slug}`,
      text: claims.join(" "),
      skills: [],
      claims,
    });
  }

  return docs;
}

export function packToJson(docs: EvidenceDoc[]): string {
  return JSON.stringify({ version: 1, docs }, null, 2);
}
