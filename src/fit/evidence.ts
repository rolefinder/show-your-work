import type { BlogPost, EvidenceDoc, ExperienceItem, SiteProfile, WorkItem } from "../types";
import { bodyText } from "../content/bodyText";

/** Build a flat evidence pack from site content (visible only). */
export function buildEvidencePack(
  profile: SiteProfile,
  work: WorkItem[],
  blog: BlogPost[],
  experience: ExperienceItem[] = [],
): EvidenceDoc[] {
  const docs: EvidenceDoc[] = [
    {
      id: "about",
      kind: "about",
      title: `${profile.name} — About`,
      url: "/about",
      text: [profile.summary, profile.tagline, profile.skills.join(" ")].join(" "),
      skills: profile.skills.slice(),
    },
  ];

  for (const w of work) {
    if (w.visible === false) continue;
    // Outcome and evidence bullets are already whole, self-contained
    // statements — exactly what a citation should be — so they are carried
    // separately from the flattened text and preferred as quotes.
    const claims = [w.outcome, ...(w.evidence || [])]
      .map((c) => String(c || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    docs.push({
      id: `work:${w.slug}`,
      kind: "work",
      title: w.title,
      url: `/work/${w.slug}`,
      text: [w.title, w.summary, bodyText(w.body), w.problem, ...claims, ...(w.decisions || []), w.skills.join(" ")]
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
      text: [b.title, b.summary, bodyText(b.body), b.skills.join(" ")].join(" "),
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
      text: [e.role, e.organization, e.summary, ...claims, e.skills.join(" ")]
        .filter(Boolean)
        .join(" "),
      skills: e.skills.slice(),
      claims,
    });
  }

  return docs;
}

export function packToJson(docs: EvidenceDoc[]): string {
  return JSON.stringify({ version: 1, docs }, null, 2);
}
